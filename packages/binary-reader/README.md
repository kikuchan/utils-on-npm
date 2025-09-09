# @kikuchan/binary-reader

Small binary buffer reader for streaming-style, cursor-based parsing in Node.js and browsers.

## Install

```bash
npm install -D @kikuchan/binary-reader
```

## Quick Start

```ts
import { BinaryReader } from '@kikuchan/binary-reader';

const u8 = new Uint8Array([0x12, 0x34, 0x89, 0xab, 0xcd, 0xef]);
const r = new BinaryReader(u8); // default: big-endian

r.readUint16();     // 0x1234 (BE)
r.readUint32();     // 0x89ABCDEF (BE)

// Force endian per read
r.seek(0);
r.readUint16le();   // 0x3412

// Strings
const s = new BinaryReader(new TextEncoder().encode('Hi\0A'));
s.readString();     // 'Hi' (C-string, consumes trailing NUL)
s.readUint8();      // 0x41 ('A')

// Raw bytes
const r2 = new BinaryReader(new Uint8Array([1,2,3,4]));
const bytes = r2.peekBytes(2); // Uint8Array [1,2], does not advance
const next  = r2.readBytes(3); // Uint8Array [1,2,3], advances by 3
```

## API

- Position/state:
  - `position`, `size`, `remain`, `eof()`
  - `seek(n | label)`, `bookmark(label)`, `rewind()`, `skip(n?)`, `align(n)`

- Unsigned integers:
  - Base: `readUint8()`, `readUint16(le?)`, `readUint32(le?)`, `readUint64(le?)`
  - Suffix aliases: `readUint16le/be()`, `readUint32le/be()`, `readUint64le/be()`

- Signed integers:
  - Base: `readInt8()`, `readInt16(le?)`, `readInt32(le?)`, `readInt64(le?)`
  - Suffix aliases: `readInt16le/be()`, `readInt32le/be()`, `readInt64le/be()`

- Floating-point:
  - Base: `readFloat16(le?)`, `readFloat32(le?)`, `readFloat64(le?)`
  - Suffix aliases: `readFloat16le/be()`, `readFloat32le/be()`, `readFloat64le/be()`

- Bytes and strings:
  - `peekBytes(n?) -> Uint8Array` — peek without advancing (default: all remaining)
  - `readBytes(n?) -> Uint8Array` — read bytes and advance (default: all remaining)
  - `readString(len?, encoding?) -> string | undefined`
    - `len` omitted: C-string (null-terminated). Missing terminator returns `undefined` and does not advance.
    - `len` provided: reads exactly `len` bytes; decode failure returns `undefined` and does not advance.

## Endianness

- Default endianness is big-endian.
- You can set a default via constructor: `new BinaryReader(u8, { littleEndian: true })`.
- Per-call overrides use either the second param (e.g. `readUint16(true)`) or the `le/be` suffix methods.

## Notes

- Streaming-focused: the API models a moving cursor over a buffer. Methods read at the cursor and advance.
- `seek()` and `skip()` clamp positions to `[0, size]`.
