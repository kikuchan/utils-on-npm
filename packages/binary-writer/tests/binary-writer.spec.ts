import { BinaryWriter } from '@kikuchan/binary-writer';
import { describe, expect, it } from 'vitest';

describe('BinaryWriter core state', () => {
  it('initializes a resizable buffer and zeroes size/position', () => {
    const bw = new BinaryWriter();
    expect(bw.position).toBe(0);
    expect(bw.size).toBe(0);
    expect(bw.capacity).toBeGreaterThanOrEqual(1024);
    expect(bw.remain).toBeGreaterThanOrEqual(1024);
  });

  it('throws on overflow when using fixed capacity', () => {
    const bw = new BinaryWriter(4);
    bw.writeBytes(new Uint8Array([1, 2, 3, 4]));
    expect(bw.size).toBe(4);
    expect(bw.capacity).toBe(4);
    expect(() => bw.writeUint8(5)).toThrow(Error);
  });
});

describe('BinaryWriter movement and seeking', () => {
  it('seeks, bookmarks, rewinds, and aligns', () => {
    const bw = new BinaryWriter();
    expect(bw.position).toBe(0);
    bw.seek(3);
    expect(bw.position).toBe(3);
    expect(bw.size).toBe(3);
    expect(bw.bookmark('m')).toBe(bw);
    bw.align(4);
    expect(bw.position).toBe(4);
    bw.seek('m');
    expect(bw.position).toBe(3);
    expect(() => bw.seek('unknown')).toThrow(Error);
    expect(bw.position).toBe(3);
    expect(bw.rewind()).toBe(bw);
    expect(bw.position).toBe(0);
  });

  it('grows capacity when seeking beyond current capacity', () => {
    const bw = new BinaryWriter();
    const cap0 = bw.capacity;
    bw.seek(cap0 + 1024);
    expect(bw.position).toBe(cap0 + 1024);
    expect(bw.capacity).toBeGreaterThanOrEqual(cap0 + 1024);
    expect(bw.remain).toBeGreaterThanOrEqual(0);
  });

  it('clamps position/size at capacity when seeking beyond capacity (fixed)', () => {
    const bw = new BinaryWriter(4);
    bw.seek(10);
    expect(bw.capacity).toBe(4);
    expect(bw.position).toBe(4); // clamped
    expect(bw.size).toBe(4); // also clamped
    expect(bw.remain).toBe(0);
    expect(() => bw.writeUint8(1)).toThrow();
  });
});

describe('BinaryWriter bounds and errors', () => {
  it('clamps negative seek to 0', () => {
    const bw = new BinaryWriter();
    bw.writeBytes(new Uint8Array([1, 2, 3]));
    bw.seek(-5 as unknown as number);
    expect(bw.position).toBe(0);
    bw.writeUint8(9);
    expect(Array.from(new Uint8Array(bw.buffer))).toEqual([9, 2, 3]);
  });
});

describe('BinaryWriter resizing', () => {
  it('auto-grows capacity by page size multiples', () => {
    const bw = new BinaryWriter();
    const big = new Uint8Array(1025).fill(0xaa);
    bw.writeBytes(big);
    expect(bw.size).toBe(1025);
    expect(bw.capacity).toBeGreaterThanOrEqual(2048);
    expect(bw.remain).toBe(bw.capacity - bw.position);
  });
});

describe('BinaryWriter unsigned integers', () => {
  it('writes unsigned integers in BE by default', () => {
    const bw = new BinaryWriter(1 + 2 + 4 + 8);
    bw.writeUint8(0xab);
    bw.writeUint16(0x1234);
    bw.writeUint32(0x89abcdef);
    bw.writeUint64(0x0102030405060708n);

    const u8 = new Uint8Array(bw.buffer);
    expect(Array.from(u8)).toEqual([
      0xab, 0x12, 0x34, 0x89, 0xab, 0xcd, 0xef, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    ]);
  });

  it('writes little-endian via options and allows overrides', () => {
    const bw = new BinaryWriter(2 + 4 + 8, { littleEndian: true });
    bw.writeUint16(0x1234);
    bw.writeUint32(0x89abcdef);
    bw.writeUint64(0x0102030405060708n);

    const u8 = new Uint8Array(bw.buffer);
    expect(Array.from(u8)).toEqual([
      0x34, 0x12, 0xef, 0xcd, 0xab, 0x89, 0x08, 0x07, 0x06, 0x05, 0x04, 0x03, 0x02, 0x01,
    ]);

    const bw2 = new BinaryWriter(2, { littleEndian: true });
    bw2.writeUint16(0x1234, false);
    expect(Array.from(new Uint8Array(bw2.buffer))).toEqual([0x12, 0x34]);
  });

  it('writes via endianness-specific methods (uint16/32/64 le/be)', () => {
    const bw = new BinaryWriter(1 + 2 + 4 + 8);
    bw.writeUint8(0); // padding at start
    bw.writeUint16le(0x1234);
    bw.writeUint32be(0x89abcdef);
    bw.writeUint64le(0x0102030405060708n);

    const u8 = new Uint8Array(bw.buffer);
    expect(Array.from(u8)).toEqual([
      0x00, 0x34, 0x12, 0x89, 0xab, 0xcd, 0xef, 0x08, 0x07, 0x06, 0x05, 0x04, 0x03, 0x02, 0x01,
    ]);
  });
});

describe('Signed Integers', () => {
  it('writes signed 8/16/32/64 (BE)', () => {
    const bw = new BinaryWriter(1 + 2 + 4 + 8);
    bw.writeInt8(-2);
    bw.writeInt16(-2);
    bw.writeInt32(-2);
    bw.writeInt64(-2n);

    const u8 = new Uint8Array(bw.buffer);
    expect(Array.from(u8)).toEqual([
      0xfe, 0xff, 0xfe, 0xff, 0xff, 0xff, 0xfe, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xfe,
    ]);
  });

  it('endianness-specific methods (int16/32/64 le/be)', () => {
    const bw = new BinaryWriter(2 + 4 + 8);
    bw.writeInt16le(-2);
    bw.writeInt32be(-2);
    bw.writeInt64le(-2n);

    const dv = new DataView(bw.buffer);
    expect(dv.getInt16(0, true)).toBe(-2);
    expect(dv.getInt32(2, false)).toBe(-2);
    expect(dv.getBigInt64(6, true)).toBe(-2n);
  });
});

describe('BinaryWriter floating point', () => {
  it('writes float32/float64 in BE', () => {
    const bw = new BinaryWriter(4 + 8);
    bw.writeFloat32(1.0);
    bw.writeFloat64(1.5);
    const dv = new DataView(bw.buffer);
    expect(dv.getFloat32(0)).toBeCloseTo(1.0);
    expect(dv.getFloat64(4)).toBeCloseTo(1.5);
  });

  if ('setFloat16' in DataView.prototype && 'getFloat16' in DataView.prototype) {
    it('writes float16 when supported', () => {
      const bw = new BinaryWriter(2);
      bw.writeFloat16(1.0);
      const dv = new DataView(bw.buffer);
      expect(dv.getFloat16(0)).toBeCloseTo(1.0);
    });
  } else {
    it.skip('writes float16 when not supported', () => {});
  }

  it('writes float32/64 via endianness-specific methods', () => {
    const bw = new BinaryWriter(4 + 8);
    bw.writeFloat32le(1.0);
    bw.writeFloat64be(1.5);
    const dv = new DataView(bw.buffer);
    expect(dv.getFloat32(0, true)).toBeCloseTo(1.0);
    expect(dv.getFloat64(4, false)).toBeCloseTo(1.5);
  });
});

describe('BinaryWriter byte I/O', () => {
  it('writes bytes from ArrayBuffer', () => {
    const bw = new BinaryWriter(4);
    bw.writeBytes(new Uint8Array([1, 2, 3, 4]).buffer);
    expect(Array.from(new Uint8Array(bw.buffer))).toEqual([1, 2, 3, 4]);
  });

  it('writes bytes from Uint8Array', () => {
    const bw = new BinaryWriter(3);
    bw.writeBytes(new Uint8Array([5, 6, 7]));
    expect(Array.from(new Uint8Array(bw.buffer))).toEqual([5, 6, 7]);
  });

  it('writes bytes from Uint8ClampedArray', () => {
    const bw = new BinaryWriter(2);
    bw.writeBytes(new Uint8ClampedArray([8, 9]));
    expect(Array.from(new Uint8Array(bw.buffer))).toEqual([8, 9]);
  });

  it('writes bytes from DataView', () => {
    const backing = new Uint8Array([10, 11, 12, 13]);
    const dv = new DataView(backing.buffer, backing.byteOffset + 1, 2);
    const bw = new BinaryWriter(2);
    bw.writeBytes(dv);
    expect(Array.from(new Uint8Array(bw.buffer))).toEqual([11, 12]);
  });
});

describe('BinaryWriter strings', () => {
  it('writes utf-8 by default', () => {
    const bw = new BinaryWriter();
    bw.writeString('Hi');
    expect(Array.from(new Uint8Array(bw.buffer))).toEqual(Array.from(new TextEncoder().encode('Hi')));
  });

  it('writes cstrings and appends NUL', () => {
    const bw = new BinaryWriter();
    bw.writeString('A', { cstring: true });
    expect(Array.from(new Uint8Array(bw.buffer))).toEqual([0x41, 0x00]);
  });

  it('writes fixedLength strings and pads/truncates', () => {
    const bw1 = new BinaryWriter();
    bw1.writeString('ABC', { fixedLength: 5 });
    expect(Array.from(new Uint8Array(bw1.buffer))).toEqual([0x41, 0x42, 0x43, 0x00, 0x00]);

    const bw2 = new BinaryWriter();
    bw2.writeString('ABCDEFG', { fixedLength: 3 });
    expect(Array.from(new Uint8Array(bw2.buffer))).toEqual([0x41, 0x42, 0x43]);
  });

  it('transforms encoded bytes via callback', () => {
    const bw = new BinaryWriter();
    bw.writeString('ab', {
      callback: (encoded) => {
        const out = new Uint8Array(encoded.length);
        for (let i = 0; i < encoded.length; i++) {
          const c = encoded[i];
          out[i] = c >= 0x61 && c <= 0x7a ? c - 32 : c;
        }
        return out;
      },
    });
    expect(Array.from(new Uint8Array(bw.buffer))).toEqual([0x41, 0x42]);
  });
});

describe('BinaryWriter overwrite and gaps', () => {
  it('creates a zero gap when seeking beyond end then writes', () => {
    const bw = new BinaryWriter();
    bw.seek(4);
    bw.writeUint8(0xaa);
    const u8 = new Uint8Array(bw.buffer);
    expect(u8.length).toBe(5);
    expect(Array.from(u8)).toEqual([0x00, 0x00, 0x00, 0x00, 0xaa]);
  });

  it('preserves max size when overwriting via seek', () => {
    const bw = new BinaryWriter();
    bw.writeBytes(new Uint8Array([1, 2, 3, 4]));
    bw.seek(2);
    bw.writeBytes(new Uint8Array([9, 9]));
    expect(Array.from(new Uint8Array(bw.buffer))).toEqual([1, 2, 9, 9]);
  });
});

describe('BinaryWriter alignment', () => {
  it('throws on zero alignment', () => {
    const bw = new BinaryWriter();
    expect(() => bw.align(0)).toThrow(RangeError);
  });

  it('throws on negative alignment', () => {
    const bw = new BinaryWriter();
    expect(() => bw.align(-8)).toThrow(RangeError);
  });

  it('no-op when already aligned and returns this', () => {
    const bw = new BinaryWriter();
    const ret = bw.align(4);
    expect(ret).toBe(bw);
    expect(bw.position).toBe(0);
  });
});

describe('BinaryWriter specific endianness methods', () => {
  it('writes uint16be in big-endian', () => {
    const bw = new BinaryWriter(2);
    bw.writeUint16be(0x1234);
    expect(Array.from(new Uint8Array(bw.buffer))).toEqual([0x12, 0x34]);
  });

  it('writes uint32le in little-endian', () => {
    const bw = new BinaryWriter(4);
    bw.writeUint32le(0x89abcdef);
    expect(Array.from(new Uint8Array(bw.buffer))).toEqual([0xef, 0xcd, 0xab, 0x89]);
  });

  it('writes uint64be in big-endian', () => {
    const bw = new BinaryWriter(8);
    bw.writeUint64be(0x0102030405060708n);
    expect(Array.from(new Uint8Array(bw.buffer))).toEqual([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
  });

  it('writes int16be in big-endian', () => {
    const bw = new BinaryWriter(2);
    bw.writeInt16be(-2);
    const dv = new DataView(bw.buffer);
    expect(dv.getInt16(0, false)).toBe(-2);
  });

  it('writes int32le in little-endian', () => {
    const bw = new BinaryWriter(4);
    bw.writeInt32le(-2);
    const dv = new DataView(bw.buffer);
    expect(dv.getInt32(0, true)).toBe(-2);
  });

  it('writes int64be in big-endian', () => {
    const bw = new BinaryWriter(8);
    bw.writeInt64be(-2n);
    const dv = new DataView(bw.buffer);
    expect(dv.getBigInt64(0, false)).toBe(-2n);
  });

  it('writes float32be in big-endian', () => {
    const bw = new BinaryWriter(4);
    bw.writeFloat32be(1.0);
    const dv = new DataView(bw.buffer);
    expect(dv.getFloat32(0, false)).toBeCloseTo(1.0);
  });

  it('writes float64le in little-endian', () => {
    const bw = new BinaryWriter(8);
    bw.writeFloat64le(1.5);
    const dv = new DataView(bw.buffer);
    expect(dv.getFloat64(0, true)).toBeCloseTo(1.5);
  });

  if ('setFloat16' in DataView.prototype && 'getFloat16' in DataView.prototype) {
    it('writes float16le/be when supported', () => {
      const bw = new BinaryWriter(4);
      bw.writeFloat16le(1.0);
      bw.writeFloat16be(1.0);
      const dv = new DataView(bw.buffer);
      expect(dv.getFloat16(0, true)).toBeCloseTo(1.0);
      expect(dv.getFloat16(2, false)).toBeCloseTo(1.0);
    });
  } else {
    it.skip('writes float16le/be when not supported', () => {});
  }
});

describe('BinaryWriter chainability', () => {
  it('returns this from write* and supports chaining', () => {
    const bw = new BinaryWriter();
    expect(bw.writeUint8(0x01)).toBe(bw);
    expect(bw.writeUint16be(0x2233)).toBe(bw);
    expect(bw.writeBytes(new Uint8Array([0x09]))).toBe(bw);
    expect(bw.writeString('A', { cstring: true })).toBe(bw);

    const out = Array.from(new Uint8Array(bw.buffer));
    expect(out).toEqual([0x01, 0x22, 0x33, 0x09, 0x41, 0x00]);
  });
});

describe('BinaryWriter constructor views', () => {
  it('constructs from a Uint8Array view with offset/length', () => {
    const backing = new Uint8Array([9, 9, 9, 9]);
    const view = new Uint8Array(backing.buffer, 1, 2);
    const bw = new BinaryWriter(view);
    bw.writeUint8(0x11);
    bw.writeUint8(0x22);
    expect(Array.from(backing)).toEqual([9, 0x11, 0x22, 9]);
  });
});
