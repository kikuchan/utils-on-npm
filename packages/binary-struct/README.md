# @kikuchan/binary-struct

TypeScript-first DSL for describing, parsing, and composing binary data. Build schemas once, get both runtime encoders/decoders and precise TypeScript types.

- Encode with `compose(obj)` → `Uint8Array`
- Decode with `parse(buffer)` → typed object
- Model structures, arrays, strings, choices (tagged unions), bitfields, and typed arrays
- Control position and sizes with `.tag()`, `.ref()`, `.withSize()`

## Install

```bash
npm i @kikuchan/binary-struct
```

## Quick Look

```ts
import {
  struct,
  choice,
  string,
  uint8,
  uint16le,
  uint16be,
  uint32be,
  uint8array,
} from '@kikuchan/binary-struct';

const Packet = struct({
  header: struct({
    magic: uint32be(),
    version: uint16le(),
    flags: uint16be(),
  }),
  body: choice(string(4), {
    TEXT: struct({
      // a string with a uint8 length prefix
      text: string(uint8()),
    }),
    DATA: struct({
      // a byte array with a uint16le count prefix
      bytes: uint8array(uint16le()),
    }),
  }),
});

const bytes = Packet.compose({
  header: { magic: 0x5041434b, version: 1, flags: 0x1234 },
  body: { TEXT: { text: 'hello' } },
});
// Uint8Array(18) [ 80,  65,  67,  75,  1, 0,  18, 52,  84,  69,  88, 84, 5, 104, 101, 108, 108, 111 ]

const obj = Packet.parse(bytes);
// {
//   header: { magic: 1346454347, version: 1, flags: 4660 },
//   body: { TEXT: { text: 'hello' } }
// }
```

## Basic Usage

### Structs

Build nested objects in the byte order you declare.

```ts
const Message = struct({
  id: uint16le(),
  flags: uint16be(),
  body: string(),
});

const out = Message.compose({
  id: 1,
  flags: 0x0201,
  body: 'Hello, world',
});
// Uint8Array(17) [ 1, 0, 2, 1, 72, 101, 108, 108, 111, 44, 32, 119, 111, 114, 108, 100, 0 ]

const back = Message.parse(out);
// {
//   id: 1,
//   flags: 513,
//   body: "Hello, world",
// }
```

### Arrays

Same element type, different count semantics. The count (when present) is the number of elements, not bytes.

```ts
// 1) Fixed-length: pads or truncates to exactly 3 elements
const FixedU8 = array(3, uint8());
FixedU8.compose([9, 8]);       // => [9, 8, 0]
FixedU8.compose([9, 8, 7, 6]); // => [9, 8, 7]
FixedU8.parse(new Uint8Array([1, 2, 3, 4]));
// => [1, 2, 3]

// 2) Count‑prefixed: count is written/read via the given number type
const CountedU16 = array(uint8(), uint16le());
const buf = CountedU16.compose([0x0201, 0x0403]);
// => [2, 0x01, 0x02, 0x03, 0x04]
const val = CountedU16.parse(buf);
// => [0x0201, 0x0403]

// 3) Until EOF: no count is written; parse reads to end
const ToEOF = array(undefined, uint8());
ToEOF.compose([1, 2, 3]);           // => [1, 2, 3]
ToEOF.parse(new Uint8Array([4, 5])); // => [4, 5]
```

Typed arrays follow the same rules but return native `TypedArray` instances:

```ts
const U16s = uint16learray(uint8()); // count‑prefixed by uint8
const roundtrip = U16s.parse(
  U16s.compose(new Uint16Array([1, 2, 0x4321]))
);
```

### Strings

One constructor covers C‑strings, fixed‑length, and length‑prefixed fields. All lengths refer to encoded bytes.

```ts
// 1) C‑string (null‑terminated). Missing terminator throws on parse.
const CStr = cstring();
const b1 = CStr.compose('abc'); // => [0x61, 0x62, 0x63, 0x00]
const s1 = CStr.parse(b1);      // => 'abc'

// 2) Fixed‑length. Short writes are NUL‑padded; read keeps all chars (NULs included).
const Fixed16 = string(16);
const b2 = Fixed16.compose('hi');
// => 'h','i',0x00 ... up to 16 bytes
const s2 = Fixed16.parse(b2);
// => 'hi' + '\\u0000'.repeat(14)

// 3) Length‑prefixed. Prefix is written/read via the given number type.
const Prefixed = string(uint16le());
const b3 = Prefixed.compose('abc'); // => [0x03, 0x00, 0x61, 0x62, 0x63]
const s3 = Prefixed.parse(b3);      // => 'abc'

// 4) Custom encoding (supply a codec)
const codec = {
  encode: (s: string) => new TextEncoder().encode(s),
  encodeInto: (s: string, u8: Uint8Array) => u8.set(new TextEncoder().encode(s)),
  decode: (u8: Uint8Array) => new TextDecoder('utf-8').decode(u8),
};
const Utf8 = string(uint8(), codec);
```

### Tagged unions

Use a discriminator type to select one variant. Exactly one key must be present when writing.

```ts
const Body = choice(uint8(), { 1: uint16le(), 2: uint8() } as const);
Body.compose({ 2: 255 });                    // => [2, 255]
Body.parse(new Uint8Array([1, 0x34, 0x12])); // => { 1: 0x1234 }
```

## Advanced Usage

- Size prefixing with backfill: `.withSize(sizeType)`
  - On write: emits a placeholder size, writes the value, then backfills the actual byte length.
  - On read: validates that the consumed bytes match the prefixed size.
  ```ts
  const Payload = array(uint8(), uint8());
  const SizedPayload = Payload.withSize(uint8());
  // compose → [size, count, ...elements]
  // parse   → validates size, then returns the inner value
  ```

- Position control with `.tag(label)` and `.ref(label)`
  - `tag(label)`: bookmark the current position for subsequent fields.
  - `ref(label)`: temporarily seek to a bookmark while reading/writing that field, then restore.

  Typical uses: there is a gap between data and its length.
  ```ts
  // Count is stored in the header, away from the array
  import { struct, uint32be, uint32le, uint8array } from '@kikuchan/binary-struct';

  const Packet = struct({
    header: struct({
      magic: uint32be(),
      payloadSize: uint32le().tag('PAYLOAD_SIZE'),
    }),
    // Write/read the count at the tagged header field via ref()
    payload: uint8array(uint32le().ref('PAYLOAD_SIZE')),
  });

  const payload = new Uint8Array([1, 2, 3, 4, 5]);
  const bytes = Packet.compose({
    header: { magic: 0x5041434b, payloadSize: 0 },
    payload,
  });
  ```

- Bitfields in one go
  - Pack/unpack named bit slices; per-field result type is `number` (0..50 bits) or `bigint` (51+ bits).
  

  ```ts
  const Flags = bitfields({ A: 1, B: 2, C: 5 });
  Flags.compose({ A: 1, B: 2, C: 17 });  // Uint8Array([0xd1])
  Flags.parse(new Uint8Array([0xd1]));   // { A: 1, B: 2, C: 17 }
  ```

- Enumerations with strong types
  ```ts
  const Color = enumerate(['Red', 'Green', 'Blue']); // defaults to uint8
  const bytes = Color.compose('Green');              // [1]
  const name = Color.parse(new Uint8Array([2]));     // 'Blue'
  ```

- Padding and sentinels
  ```ts
  const Entry = struct({
    id: uint32be(),
    _pad: reserved(16), // always writes zeros; parse returns the raw bytes to help your debugging
    name: string(32),   // fixed-length (NULs are kept on read)
  });
  ```

## How It Works

- A schema is a value of type `Type<T>` with methods: `read`, `write`, `parse`, `compose`, and decorators `.tag()`, `.ref()`, `.withSize()`.
- All constructors return `Type<...>` values. Calling a type like `T()` produces a default value (optionally seeded: `T(seed)`).
- You compose larger types from smaller ones; TypeScript infers the precise result and write shapes.

## Edge Cases

- Fixed-length strings: decoding returns the full width, including any NULs.
- C-strings: missing terminator throws during parse.
- Counted arrays/typed arrays: the count prefix is the number of elements (not bytes). If the stream ends early, parsing stops at EOF.
- Fixed-length arrays/typed arrays: writes pad/truncate to the declared length using element defaults.
- Bitfields: passing a `number` for a 51+ bit field (or `bigint` for <=50) throws; values are masked to field width. Endianness: `littleEndian` controls byte order; `lsbFirst` controls bit numbering.
- Choice: exactly one variant key must be present on write; unknown discriminators throw on read.
- Reserved: write ignores any provided value and emits the configured fill; parse returns a `Uint8Array` of those bytes.
- Forward references are not allowed: `ref('X')` requires a prior `tag('X')` in write order (e.g., tag the struct or an earlier field).
- Enumerations: unknown numeric values on read yield `undefined`.

## Tips

- Trim fixed-length strings manually if needed.
- Remember counts are element counts, not bytes.
- Decorators are immutable: `T.withSize(...).tag(...).ref(...)` returns a new type; the original `T` is unchanged.

## See Also

- `@kikuchan/binary-reader` and `@kikuchan/binary-writer` provide the low-level I/O used by this library.
