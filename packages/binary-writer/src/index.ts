export type BinaryLike = Uint8Array | Uint8ClampedArray | ArrayBufferLike | DataView;

type StringEncoder = {
  encode(s: string): Uint8Array;
  encodeInto(s: string, u8: Uint8Array): void;
};

export type Options = {
  littleEndian?: boolean;
};

export class BinaryWriter {
  #view: DataView;
  #pos: number;
  #littleEndian: boolean | undefined;
  #bookmarks: Record<string, number> = {};

  #pageSize = 1024;

  #size: number = 0;

  #resizable = false;

  constructor(u8?: BinaryLike | number, opts?: Options) {
    if (u8 === undefined) {
      u8 = new ArrayBuffer(this.#pageSize);
      this.#resizable = true;
    } else if (typeof u8 === 'number') {
      u8 = new ArrayBuffer(u8);
    }

    if (!ArrayBuffer.isView(u8)) {
      this.#view = new DataView(u8);
    } else {
      this.#view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    }
    this.#pos = 0;
    if (!this.#resizable) this.#size = this.#view.byteLength;
    this.#littleEndian = opts?.littleEndian;
  }

  get position() {
    return this.#pos;
  }

  get capacity() {
    return this.#view.byteLength;
  }

  get size() {
    return this.#size;
  }

  get remain() {
    return Math.max(0, this.capacity - this.position);
  }

  seek(n: number | string) {
    if (typeof n === 'string') {
      n = this.#bookmarks[n];
      if (typeof n === 'undefined') throw new Error('seek: no such bookmark');
    }

    this.#pos = Math.max(n, 0);
    if (this.#resizable) {
      this.#require(this.#pos - this.capacity);
    } else {
      this.#pos = Math.min(this.#pos, this.capacity);
    }
    if (this.#pos > this.#size) this.#size = this.#pos;
    return this;
  }

  bookmark(s: string) {
    this.#bookmarks[s] = this.#pos;
    return this;
  }

  rewind() {
    return this.seek(0);
  }

  #require(n: number = 1) {
    if (n > this.remain) {
      if (!this.#resizable) {
        throw new Error(`Out of buffer size. size = ${this.size}`);
      }
      const buffer = new Uint8Array(Math.ceil((this.#pos + n) / this.#pageSize) * this.#pageSize);
      buffer.set(new Uint8Array(this.#view.buffer, this.#view.byteOffset, this.#view.byteLength));
      this.#view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }
    return this;
  }

  advance(n: number) {
    this.seek(this.#pos + n);
    return this;
  }

  align(n: number) {
    if (!(n > 0)) throw new RangeError('align(n): n must be > 0');
    if (this.position % n) {
      return this.advance(n - (this.position % n));
    }
    return this;
  }

  get buffer() {
    return this.#view.buffer.slice(this.#view.byteOffset, this.#view.byteOffset + this.#size);
  }

  writeUint8(value: number) {
    this.#require(1);
    this.#view.setUint8(this.position, value);
    this.advance(1);
    return this;
  }

  writeUint16(value: number, littleEndian?: boolean) {
    this.#require(2);
    this.#view.setUint16(this.position, value, littleEndian ?? this.#littleEndian);
    this.advance(2);
    return this;
  }

  writeUint16le(value: number) {
    return this.writeUint16(value, true);
  }

  writeUint16be(value: number) {
    return this.writeUint16(value, false);
  }

  writeUint32(value: number, littleEndian?: boolean) {
    this.#require(4);
    this.#view.setUint32(this.position, value, littleEndian ?? this.#littleEndian);
    this.advance(4);
    return this;
  }

  writeUint32le(value: number) {
    return this.writeUint32(value, true);
  }

  writeUint32be(value: number) {
    return this.writeUint32(value, false);
  }

  writeUint64(value: bigint, littleEndian?: boolean) {
    this.#require(8);
    this.#view.setBigUint64(this.position, value, littleEndian ?? this.#littleEndian);
    this.advance(8);
    return this;
  }

  writeUint64le(value: bigint) {
    return this.writeUint64(value, true);
  }

  writeUint64be(value: bigint) {
    return this.writeUint64(value, false);
  }

  writeInt8(value: number) {
    this.#require(1);
    this.#view.setInt8(this.position, value);
    this.advance(1);
    return this;
  }

  writeInt16(value: number, littleEndian?: boolean) {
    this.#require(2);
    this.#view.setInt16(this.position, value, littleEndian ?? this.#littleEndian);
    this.advance(2);
    return this;
  }

  writeInt16le(value: number) {
    return this.writeInt16(value, true);
  }

  writeInt16be(value: number) {
    return this.writeInt16(value, false);
  }

  writeInt32(value: number, littleEndian?: boolean) {
    this.#require(4);
    this.#view.setInt32(this.position, value, littleEndian ?? this.#littleEndian);
    this.advance(4);
    return this;
  }

  writeInt32le(value: number) {
    return this.writeInt32(value, true);
  }

  writeInt32be(value: number) {
    return this.writeInt32(value, false);
  }

  writeInt64(value: bigint, littleEndian?: boolean) {
    this.#require(8);
    this.#view.setBigInt64(this.position, value, littleEndian ?? this.#littleEndian);
    this.advance(8);
    return this;
  }

  writeInt64le(value: bigint) {
    return this.writeInt64(value, true);
  }

  writeInt64be(value: bigint) {
    return this.writeInt64(value, false);
  }

  writeFloat16(value: number, littleEndian?: boolean) {
    this.#require(2);
    this.#view.setFloat16(this.position, value, littleEndian ?? this.#littleEndian);
    this.advance(2);
    return this;
  }

  writeFloat16le(value: number) {
    return this.writeFloat16(value, true);
  }

  writeFloat16be(value: number) {
    return this.writeFloat16(value, false);
  }

  writeFloat32(value: number, littleEndian?: boolean) {
    this.#require(4);
    this.#view.setFloat32(this.position, value, littleEndian ?? this.#littleEndian);
    this.advance(4);
    return this;
  }

  writeFloat32le(value: number) {
    return this.writeFloat32(value, true);
  }

  writeFloat32be(value: number) {
    return this.writeFloat32(value, false);
  }

  writeFloat64(value: number, littleEndian?: boolean) {
    this.#require(8);
    this.#view.setFloat64(this.position, value, littleEndian ?? this.#littleEndian);
    this.advance(8);
    return this;
  }

  writeFloat64le(value: number) {
    return this.writeFloat64(value, true);
  }

  writeFloat64be(value: number) {
    return this.writeFloat64(value, false);
  }

  writeBytes(buffer: BinaryLike) {
    const u8 = !ArrayBuffer.isView(buffer)
      ? new Uint8Array(buffer)
      : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    this.#require(u8.byteLength);
    new Uint8Array(this.#view.buffer, this.#view.byteOffset + this.position, u8.byteLength).set(u8);
    this.advance(u8.byteLength);
    return this;
  }

  writeString(
    value: string,
    opts?: {
      cstring?: boolean;
      fixedLength?: number;
      callback?: (encoded: Uint8Array<ArrayBufferLike>) => BinaryLike | undefined | void;
      encoder?: StringEncoder;
    },
  ) {
    const encoder = opts?.encoder ?? new TextEncoder();
    if (opts?.cstring) value = value + '\0';

    let encoded;
    if (opts?.fixedLength) {
      encoded = new Uint8Array(opts.fixedLength);
      encoder.encodeInto(value, encoded);
    } else {
      encoded = encoder.encode(value);
    }
    this.writeBytes(opts?.callback?.(encoded) ?? encoded);
    return this;
  }
}

export default BinaryWriter;
