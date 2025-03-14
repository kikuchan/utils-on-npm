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
   * Check if string or RegExp is matched at current position
   *
   * This function does NOT advance the position
   *
   * @param m string or RegExp
   * @returns matched strings, otherwise `null`
   */
  startsWith(m: string | RegExp) {
    if (this.eof()) return null;

    const sliced = this.#s.slice(this.position);

    return (typeof m === 'string' ? sliced.startsWith(m) && [m] : sliced.match(new RegExp(m, 'y'))) || null;
  }

  /**
   * Read if string or RegExp is matched at current position
   *
   * This function advances the position if matched
   *
   * @param m string or RegExp
   * @param translate result translate function
   * @returns matched strings (or translated result), otherwise `null`
   */
  match(m: string | RegExp): string[] | null;
  match<T>(m: string | RegExp, translate: (matched: string[]) => T): T | null;
  match<T>(m: string | RegExp, translate?: (matched: string[]) => T): string[] | T | null {
    const matched = this.startsWith(m);
    if (!matched) return null;

    this.skip(matched[0].length);
    return translate ? translate(matched) : matched;
  }

  #search<T>(m: string | RegExp, translate: (n: number) => T): T | null {
    const sliced = this.#s.slice(this.position);
    const n = typeof m === 'string' ? sliced.indexOf(m) : sliced.search(m);
    if (n < 0) return null;

    return translate(n);
  }

  /**
   * Search string or RegExp
   *
   * This function advances the position at the end of the matched string if found
   *
   * @param m string or RegExp
   * @param translate result translate function
   * @returns matched information object (or translated result), otherwise `null`
   */
  search(m: string | RegExp): { skipped: string; matched: string[] } | null;
  search<T>(m: string | RegExp, translate: (obj: { skipped: string; matched: string[] }) => T): T | null;
  search<T>(m: string | RegExp, translate?: (obj: { skipped: string; matched: string[] }) => T) {
    return this.#search(m, (n) => {
      const skipped = this.read(n);
      const matched = this.match(m);
      if (!matched) return null; // just in case
      const info = { skipped, matched };
      return translate ? translate(info) : info;
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
   * @returns read string, `null` on not found
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
