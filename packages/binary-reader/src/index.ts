export type BinaryLike = Uint8Array | Uint8ClampedArray | ArrayBufferLike | DataView;

type Options = {
  littleEndian?: boolean;
};
export class BinaryReader {
  #view: DataView;
  #pos: number;
  #littleEndian: boolean | undefined;
  #bookmarks: Record<string, number> = {};

  constructor(u8: BinaryLike, opts?: Options) {
    if (!ArrayBuffer.isView(u8)) {
      this.#view = new DataView(u8);
    } else {
      this.#view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    }
    this.#pos = 0;
    this.#littleEndian = opts?.littleEndian;
  }

  get position() {
    return this.#pos;
  }

  get size() {
    return this.#view.byteLength;
  }

  get remain() {
    return this.size - this.position;
  }

  eof() {
    return this.remain <= 0;
  }

  seek(n: number | string) {
    if (typeof n === 'string') {
      n = this.#bookmarks[n];
      if (typeof n === 'undefined') throw new Error('seek: no such bookmark');
    }
    if (typeof n === 'number') {
      this.#pos = Math.min(Math.max(n, 0), this.size);
    }
    return this;
  }

  bookmark(s: string) {
    this.#bookmarks[s] = this.#pos;
    return this;
  }

  rewind() {
    return this.seek(0);
  }

  skip(n?: number) {
    return this.seek(this.#pos + (n ?? 1));
  }

  align(n: number) {
    if (!(n > 0)) throw new RangeError('align(n): n must be > 0');
    if (this.position % n) {
      return this.skip(n - (this.position % n));
    }
    return this;
  }

  peekBytes(n?: number) {
    if (n === undefined) n = this.remain;

    const pos = this.#view.byteOffset + this.position;
    return new Uint8Array(this.#view.buffer.slice(pos, pos + n));
  }

  readUint8() {
    const r = this.#view.getUint8(this.position);
    this.skip(1);
    return r;
  }

  readUint16(littleEndian?: boolean) {
    const r = this.#view.getUint16(this.position, littleEndian ?? this.#littleEndian);
    this.skip(2);
    return r;
  }

  readUint16le() {
    return this.readUint16(true);
  }

  readUint16be() {
    return this.readUint16(false);
  }

  readUint32(littleEndian?: boolean) {
    const r = this.#view.getUint32(this.position, littleEndian ?? this.#littleEndian);
    this.skip(4);
    return r;
  }

  readUint32le() {
    return this.readUint32(true);
  }

  readUint32be() {
    return this.readUint32(false);
  }

  readUint64(littleEndian?: boolean) {
    const r = this.#view.getBigUint64(this.position, littleEndian ?? this.#littleEndian);
    this.skip(8);
    return r;
  }

  readUint64le() {
    return this.readUint64(true);
  }

  readUint64be() {
    return this.readUint64(false);
  }

  readInt8() {
    const r = this.#view.getInt8(this.position);
    this.skip(1);
    return r;
  }

  readInt16(littleEndian?: boolean) {
    const r = this.#view.getInt16(this.position, littleEndian ?? this.#littleEndian);
    this.skip(2);
    return r;
  }

  readInt16le() {
    return this.readInt16(true);
  }

  readInt16be() {
    return this.readInt16(false);
  }

  readInt32(littleEndian?: boolean) {
    const r = this.#view.getInt32(this.position, littleEndian ?? this.#littleEndian);
    this.skip(4);
    return r;
  }

  readInt32le() {
    return this.readInt32(true);
  }

  readInt32be() {
    return this.readInt32(false);
  }

  readInt64(littleEndian?: boolean) {
    const r = this.#view.getBigInt64(this.position, littleEndian ?? this.#littleEndian);
    this.skip(8);
    return r;
  }

  readInt64le() {
    return this.readInt64(true);
  }

  readInt64be() {
    return this.readInt64(false);
  }

  readFloat16(littleEndian?: boolean) {
    const r = this.#view.getFloat16(this.position, littleEndian ?? this.#littleEndian);
    this.skip(2);
    return r;
  }

  readFloat16le() {
    return this.readFloat16(true);
  }

  readFloat16be() {
    return this.readFloat16(false);
  }

  readFloat32(littleEndian?: boolean) {
    const r = this.#view.getFloat32(this.position, littleEndian ?? this.#littleEndian);
    this.skip(4);
    return r;
  }

  readFloat32le() {
    return this.readFloat32(true);
  }

  readFloat32be() {
    return this.readFloat32(false);
  }

  readFloat64(littleEndian?: boolean) {
    const r = this.#view.getFloat64(this.position, littleEndian ?? this.#littleEndian);
    this.skip(8);
    return r;
  }

  readFloat64le() {
    return this.readFloat64(true);
  }

  readFloat64be() {
    return this.readFloat64(false);
  }

  #strlen() {
    const remain = this.remain;
    for (let i = 0; i < remain; i++) {
      if (this.#view.getUint8(this.position + i) === 0) {
        return i;
      }
    }
    return undefined; // No termination
  }

  readBytes(n?: number) {
    const buffer = this.peekBytes(n);
    if (buffer) this.skip(buffer.byteLength);
    return buffer;
  }

  /**
   * @returns string. undefined on oversize or EOF.
   */
  readString(len?: number, encoding?: string | ((u8: Uint8Array) => string)) {
    const remain = this.remain;
    let extraLength = 0;

    if (len === undefined) {
      // C String Mode
      len = this.#strlen();
      extraLength = 1;
    }
    if (len === undefined || remain < len) return undefined; // EOF

    const buffer = this.peekBytes(len);
    try {
      if (typeof encoding === 'function') {
        const string = encoding(buffer);

        this.skip(len + extraLength);
        return string;
      } else {
        // XXX: encoding
        const string = new TextDecoder((encoding ?? 'utf-8') as 'utf-8', {
          fatal: true,
        }).decode(buffer);

        this.skip(len + extraLength);
        return string;
      }
    } catch {
      return undefined;
    }
  }
}

export default BinaryReader;
