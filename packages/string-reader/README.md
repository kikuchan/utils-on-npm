# @kikuchan/string-reader

Lightweight sequential string reader with simple matching helpers.

## Install

```bash
npm install -D @kikuchan/string-reader
```

## Quick Start

```ts
import { StringReader } from '@kikuchan/string-reader';

const r = new StringReader('key=value;rest');
r.read(3);                // 'key'
r.match('=');             // advances
const val = r.readUntil(';'); // 'value'

r.rewind();
r.startsWith('key');      // ['key'] (does not advance)
```

## API

- Position/state:
  - `position`, `size`, `remain`, `eof()`
  - `seek(n)`, `skip(n?)` (both clamp to range 0..size)

- Matching:
  - `startsWith(string | RegExp) -> string[] | null` (anchored at current position; does not advance)
  - `match(string | RegExp, translate?) -> T | string[] | null` (advances on match)
  - `search(string | RegExp, translate?) -> { skipped, matched } | T | null` (advances to end of match when found)
  - `skipUntil(string | RegExp) -> boolean` (advances to start of match when found)
  - `readUntil(string | RegExp) -> string | null` (reads up to but not including match; does not consume match)

- Reading:
  - `read(n?: number) -> string`
    - Defaults to 1 char; requires `n > 0` (throws `RangeError` otherwise).
    - Clamps at end-of-string; returns empty string at EOF.

## Notes

- `RegExp` behavior: `startsWith` is anchored (sticky-like), while `search`/`readUntil` scan forward.
