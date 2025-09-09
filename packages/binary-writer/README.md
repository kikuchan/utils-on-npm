# @kikuchan/binary-writer

Small binary buffer writer for streaming-style, cursor-based encoding in Node.js and browsers.

## Install

```bash
npm install -D @kikuchan/binary-writer
```

## Quick Start

```ts
import { BinaryWriter } from '@kikuchan/binary-writer';

// Resizable by default, big-endian default
const w = new BinaryWriter()
  .writeUint16(0x1234)                   // BE
  .writeUint32le(0x89abcdef)
  .writeUint64be(0x0102030405060708n)
  .bookmark('sizeHere')                  // movement methods are chainable too
  .align(4);

const out = new Uint8Array(w.buffer);
```

## API

- Position/state:
  - `position`, `size`, `capacity`, `remain`
  - `seek(n | label)`, `bookmark(label)`, `rewind()`, `advance(n)`, `align(n)`

- Unsigned integers:
  - Base: `writeUint8(v)`, `writeUint16(v, le?)`, `writeUint32(v, le?)`, `writeUint64(v, le?)`
  - Suffix aliases: `writeUint16le/be(v)`, `writeUint32le/be(v)`, `writeUint64le/be(v)`

- Signed integers:
  - Base: `writeInt8(v)`, `writeInt16(v, le?)`, `writeInt32(v, le?)`, `writeInt64(v, le?)`
  - Suffix aliases: `writeInt16le/be(v)`, `writeInt32le/be(v)`, `writeInt64le/be(v)`

- Floating-point:
  - Base: `writeFloat16(v, le?)`, `writeFloat32(v, le?)`, `writeFloat64(v, le?)`
  - Suffix aliases: `writeFloat16le/be(v)`, `writeFloat32le/be(v)`, `writeFloat64le/be(v)`

- Bytes and strings:
  - `writeBytes(data)` — accepts `Uint8Array`/`Uint8ClampedArray`/`ArrayBuffer`/`DataView`
  - `writeString(str, { cstring?: boolean, fixedLength?: number, callback? })`

### Chainability

- All movement and write methods return the writer instance for chaining:
  - Movement: `seek`, `bookmark`, `rewind`, `advance`, `align`
  - Writes: all `write*` numeric methods, `writeBytes`, and `writeString`

## Endianness

- Default is big-endian.
- You can change the default per instance: `new BinaryWriter(sizeOrBuffer?, { littleEndian: true })`.
- Override per-call with the second parameter or use the `le/be` suffix methods.

## Notes

- Streaming-focused: the API models a moving cursor over a buffer. Methods write at the cursor and advance.
- By default, instances are resizable and grow automatically.
