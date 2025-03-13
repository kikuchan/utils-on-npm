function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}
export class StringReader {
  #s: string;
  #pos: number = 0;
  #length: number;

  constructor(s: string) {
    this.#s = s;
    this.#length = s.length;
  }

  get position() {
    return this.#pos;
  }

  get size() {
    return this.#length;
  }

  get remain() {
    return this.size - this.position;
  }

  /**
   * Whether the reader is at the end of the string
   */
  eof() {
    return this.remain <= 0;
  }

  /**
   * Seek to a position
   * @param n position to seek
   * @returns this
   */
  seek(n: number) {
    this.#pos = clamp(n, 0, this.size);
    return this;
  }

  /**
   * Skip n characters
   * @param n number of characters to skip
   * @returns this
   */
  skip(n?: number) {
    return this.seek(this.#pos + (n ?? 1));
  }

  /**
   * Match string or RegExp at current position
   *
   * This function does NOT advance the position
   *
   * @param m string or RegExp
   * @returns matched strings, otherwise `false`
   */
  startsWith(m: string | RegExp) {
    if (this.eof()) return false;

    const sliced = this.#s.slice(this.position);

    return (typeof m === 'string' ? sliced.startsWith(m) && [m] : sliced.match(new RegExp(m, 'y'))) || false;
  }

  /**
   * Match string or RegExp at current position
   *
   * This function advances the position if matched
   *
   * @param m string or RegExp
   * @param cb callback function
   * @returns matched strings, otherwise `false`
   */
  match(m: string | RegExp, cb?: (matched: string[]) => void) {
    const matched = this.startsWith(m);
    if (!matched) return false;

    this.skip(matched[0].length);
    cb?.(matched);
    return matched;
  }

  #search<T>(m: string | RegExp, cb: (n: number) => T): T | false {
    const sliced = this.#s.slice(this.position);
    const n = typeof m === 'string' ? sliced.indexOf(m) : sliced.search(m);
    if (n < 0) return false;

    return cb(n);
  }

  /**
   * Search string or RegExp
   *
   * This function advances the position at the end of the matched string if found
   *
   * @param m string or RegExp
   * @param cb callback function
   * @returns matched information object, otherwise `false`
   */
  search(m: string | RegExp, cb?: (obj: { skipped: string; matched: string[] }) => void) {
    return this.#search(m, (n) => {
      const skipped = this.read(n);
      const matched = this.match(m);
      if (!matched) return false; // just in case
      cb?.({ skipped, matched });
      return { skipped, matched };
    });
  }

  /**
   * Skip until string or RegExp is found
   *
   * This function advances the position at the beginning of the matched string if found
   *
   * @param m string or RegExp
   * @returns whther found or not
   */
  skipUntil(m: string | RegExp) {
    return this.#search(m, (n) => this.skip(n)) && true;
  }

  /**
   * Read until string or RegExp is found
   *
   * This function advances the position at the beginning of the matched string if found
   *
   * @param m string or RegExp
   * @returns read string, `false` on not found
   */
  readUntil(m: string | RegExp) {
    return this.#search(m, (n) => this.read(n));
  }

  /**
   * Read n characters
   *
   * @param n number of characters to read
   * @returns read string, '' on EOF
   */
  read(n?: number) {
    if (this.eof()) return '';

    n = n ?? 1;
    if (n <= 0) n = this.remain + n;

    const read = this.#s.slice(this.position, this.position + n);
    this.skip(n);
    return read;
  }
}
