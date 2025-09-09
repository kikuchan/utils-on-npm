# @kikuchan/hexdump

Tiny, configurable hex dump utility for Node.js and browsers.

## Install

```bash
npm install -D @kikuchan/hexdump
```

## Usage

```ts
import { hexdump } from '@kikuchan/hexdump';

const bytes = Uint8Array.from([
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
  0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
]);

hexdump.log(bytes);
```

output:

```
00000000:  00 01 02 03 04 05 06 07  08 09 0a 0b 0c 0d 0e 0f  |................|
00000010:                                                    |                |
```

## API

### Basic Functions

- `hexdump.log|warn|error(data, options?)`: outputs to `console.log|warn|error` respectively.
- `hexdump(data, options?)`: returns the full string instead of printing.
- `hexdump.create(printer)`: returns a hexdump function that prints to `printer` (a function that takes a string).

### `data`
- Binary-like data: `Uint8Array`, `Uint8ClampedArray`, `ArrayBufferLike` or `DataView`;

### `options?`
- `addrOffset: number` — Starting address for the first byte. Default `0`.
- `addrLength: number` — Hex digits shown for the address. Default `8 - prefix.length` (clamped to `>= 0`).
- `prefix: string` — Printed before the address (e.g. `"0x"`). Default `""`.
- `foldSize: number` — Bytes per row. Default `16`.
- `printChars: boolean` — Show the ASCII gutter at right. Default `true`.
- `footer: boolean` — Print a trailing line showing the next address. Default `true`.
- `color: boolean | 'simple' | 'html' | ((s: string, ctx: Context) => ColorizerOperation | undefined)` —
  - `true` or `'simple'`: add ANSI colors in terminals.
  - `'html'`: wrap parts with semantic spans like `hexdump-address`, `hexdump-ascii`, etc., and escape content.
- `printer?: (line: string) => void | null` — Provide a per-line sink directly in options. Set to `null` to disable printing even if a default printer is configured.
- `formatter: (s: string, ctx: Context) => string | undefined` — Transform each fragment before it is appended. Return `undefined` to drop that fragment.
