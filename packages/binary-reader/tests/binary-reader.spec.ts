import { BinaryReader } from '@kikuchan/binary-reader';
import { describe, expect, it } from 'vitest';

describe('Core State', () => {
  it('positions, sizes, and computes eof', () => {
    const u8 = new Uint8Array([1, 2, 3, 4]);
    const br = new BinaryReader(u8);
    expect(br.position).toBe(0);
    expect(br.size).toBe(4);
    expect(br.remain).toBe(4);
    expect(br.eof()).toBe(false);
    br.skip(4);
    expect(br.position).toBe(4);
    expect(br.remain).toBe(0);
    expect(br.eof()).toBe(true);
  });

  it('seeks, bookmarks, and rewinds', () => {
    const u8 = new Uint8Array([0, 1, 2, 3, 4, 5]);
    const br = new BinaryReader(u8);
    br.skip(2);
    expect(br.bookmark('here')).toBe(br);
    br.skip(3);
    expect(br.position).toBe(5);
    br.seek('here');
    expect(br.position).toBe(2);
    expect(br.rewind()).toBe(br);
    expect(br.position).toBe(0);
  });

  it('skips within bounds and aligns', () => {
    const u8 = new Uint8Array(10);
    const br = new BinaryReader(u8);
    br.seek(3);
    br.align(4);
    expect(br.position).toBe(4);
    br.align(4);
    expect(br.position).toBe(4);
    br.seek(9);
    br.skip(5); // should clamp at end
    expect(br.position).toBe(10);
  });

  it('seeks by number and returns itself', () => {
    const u8 = new Uint8Array([1, 2, 3]);
    const br = new BinaryReader(u8);
    expect(br.seek(2)).toBe(br);
    expect(br.position).toBe(2);
  });

  it('ignores non-number non-string inputs', () => {
    const u8 = new Uint8Array([1, 2, 3]);
    const br = new BinaryReader(u8);
    br.seek({} as unknown as number);
    expect(br.position).toBe(0);
  });
});

describe('Buffer Access', () => {
  it('peeks and reads byte ranges', () => {
    const u8 = new Uint8Array([10, 20, 30, 40]);
    const br = new BinaryReader(u8);
    const peek2 = br.peekBytes(2)!;
    expect(peek2.byteLength).toBe(2);
    expect(Array.from(new Uint8Array(peek2))).toEqual([10, 20]);
    expect(br.position).toBe(0);

    const read2 = br.readBytes(2)!;
    expect(read2.byteLength).toBe(2);
    expect(Array.from(new Uint8Array(read2))).toEqual([10, 20]);
    expect(br.position).toBe(2);

    const readRemain = br.readBytes();
    expect(readRemain).toBeDefined();
    expect(readRemain!.byteLength).toBe(2);
    expect(Array.from(new Uint8Array(readRemain!))).toEqual([30, 40]);
    expect(br.position).toBe(4);
  });

  it('reads zero bytes without advancing', () => {
    const u8 = new Uint8Array([1, 2, 3, 4]);
    const br = new BinaryReader(u8);
    const buf = br.readBytes(0)!;
    expect(buf.byteLength).toBe(0);
    expect(br.position).toBe(0);
  });

  it('does not advance when peekBytes returns undefined', () => {
    class NullPeekReader extends BinaryReader {
      peekBytes() {
        return undefined as unknown as Uint8Array;
      }
    }

    const br = new NullPeekReader(new Uint8Array([1, 2, 3, 4]));
    const buf = br.readBytes(2);
    expect(buf).toBeUndefined();
    expect(br.position).toBe(0);
  });
});

describe('Construction', () => {
  it('handles views with offsets', () => {
    const base = new Uint8Array([99, 1, 2, 3, 4, 100]);
    const view = base.subarray(1, 5); // [1,2,3,4]
    const br = new BinaryReader(view);
    expect(br.size).toBe(4);
    expect(br.readUint8()).toBe(1);
    expect(br.readUint8()).toBe(2);
    expect(br.readUint8()).toBe(3);
    expect(br.readUint8()).toBe(4);
    expect(br.eof()).toBe(true);
  });
});

describe('Unsigned Integers', () => {
  it('reads big-endian by default', () => {
    const bytes = new Uint8Array([
      0xab, // u8
      0x12,
      0x34, // u16 BE = 0x1234
      0x89,
      0xab,
      0xcd,
      0xef, // u32 BE = 0x89ABCDEF
      0x01,
      0x02,
      0x03,
      0x04,
      0x05,
      0x06,
      0x07,
      0x08, // u64 BE = 0x0102030405060708n
    ]);
    const br = new BinaryReader(bytes);
    expect(br.readUint8()).toBe(0xab);
    expect(br.readUint16be()).toBe(0x1234);
    expect(br.readUint32be()).toBe(0x89abcdef);
    expect(br.readUint64be()).toBe(0x0102030405060708n);

    // Default endianness (no explicit arg, no option) should be big-endian.
    const be16 = new BinaryReader(new Uint8Array([0x12, 0x34]));
    expect(be16.readUint16()).toBe(0x1234);
    const be32 = new BinaryReader(new Uint8Array([0x89, 0xab, 0xcd, 0xef]));
    expect(be32.readUint32()).toBe(0x89abcdef);
    const be64 = new BinaryReader(new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]));
    expect(be64.readUint64()).toBe(0x0102030405060708n);
  });

  it('reads little-endian when defaulted via options', () => {
    const bytesLE = new Uint8Array([
      0x34,
      0x12, // 0x1234
      0xef,
      0xcd,
      0xab,
      0x89, // 0x89ABCDEF
      0x08,
      0x07,
      0x06,
      0x05,
      0x04,
      0x03,
      0x02,
      0x01, // 0x0102030405060708n
    ]);
    const br = new BinaryReader(bytesLE, { littleEndian: true });
    expect(br.readUint16()).toBe(0x1234);
    expect(br.readUint32()).toBe(0x89abcdef);
    expect(br.readUint64()).toBe(0x0102030405060708n);
  });

  it('overrides default endianness explicitly', () => {
    const bytes = new Uint8Array([0x34, 0x12]);
    const br = new BinaryReader(bytes, { littleEndian: true });
    expect(br.readUint16(false)).toBe(0x3412); // force BE
  });
});

describe('Signed Integers', () => {
  it('reads signed 8/16/32/64', () => {
    // For signed tests, craft BE values
    const bytes = new Uint8Array([
      0xfe, // int8 = -2
      0xff,
      0xfe, // int16 = -2
      0xff,
      0xff,
      0xff,
      0xfe, // int32 = -2
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
      0xfe, // int64 = -2n
    ]);
    const br = new BinaryReader(bytes);
    expect(br.readInt8()).toBe(-2);
    expect(br.readInt16()).toBe(-2);
    expect(br.readInt32()).toBe(-2);
    expect(br.readInt64()).toBe(-2n);
  });

  it('reads signed via LE/BE methods', () => {
    // int16le(-2) bytes: 0xFE 0xFF
    const br16 = new BinaryReader(new Uint8Array([0xfe, 0xff]));
    expect(br16.readInt16le()).toBe(-2);

    // int32be(-2) bytes: 0xFF 0xFF 0xFF 0xFE
    const br32 = new BinaryReader(new Uint8Array([0xff, 0xff, 0xff, 0xfe]));
    expect(br32.readInt32be()).toBe(-2);

    // int64le(-2n) bytes: 0xFE 0xFF 0xFF 0xFF 0xFF 0xFF 0xFF 0xFF
    const br64 = new BinaryReader(new Uint8Array([0xfe, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]));
    expect(br64.readInt64le()).toBe(-2n);
  });
});

describe('Floating Point', () => {
  it('reads float32/float64', () => {
    // BE: float32(1.0) = 0x3F800000, float64(1.5) = 0x3FF8000000000000
    const bytes = new Uint8Array([0x3f, 0x80, 0x00, 0x00, 0x3f, 0xf8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const br = new BinaryReader(bytes);
    expect(br.readFloat32()).toBeCloseTo(1.0);
    expect(br.readFloat64()).toBeCloseTo(1.5);
  });

  it('reads float32/64 via LE/BE methods', () => {
    // float32(1.0) LE = 00 00 80 3F
    const br32le = new BinaryReader(new Uint8Array([0x00, 0x00, 0x80, 0x3f]));
    expect(br32le.readFloat32le()).toBeCloseTo(1.0);

    // float64(1.5) BE = 3F F8 00 00 00 00 00 00
    const br64be = new BinaryReader(new Uint8Array([0x3f, 0xf8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]));
    expect(br64be.readFloat64be()).toBeCloseTo(1.5);
  });
});

describe('Strings', () => {
  it('reads fixed-length strings', () => {
    const bytes = new TextEncoder().encode('Hi!');
    const br = new BinaryReader(bytes);
    const s = br.readString(2);
    expect(s).toBe('Hi');
    expect(br.position).toBe(2);
  });

  it('reads a C-string and consumes NUL', () => {
    const bytes = new Uint8Array([...new TextEncoder().encode('Hi'), 0x00, 0x41]);
    const br = new BinaryReader(bytes);
    const s = br.readString();
    expect(s).toBe('Hi');
    // should consume terminating null as well
    expect(br.position).toBe(3);
    // Next byte should be 'A'
    expect(br.readUint8()).toBe(0x41);
  });

  it('returns undefined and does not advance when C-string has no terminator', () => {
    const bytes = new TextEncoder().encode('NoTerminator');
    const br = new BinaryReader(bytes);
    const s = br.readString();
    expect(s).toBeUndefined();
    expect(br.position).toBe(0);
  });

  it('returns undefined and does not advance when oversize', () => {
    const bytes = new TextEncoder().encode('Hi');
    const br = new BinaryReader(bytes);
    const s = br.readString(5);
    expect(s).toBeUndefined();
    expect(br.position).toBe(0);
  });
});

describe('Construction - more', () => {
  it('reads from ArrayBuffer', () => {
    const buf = new Uint8Array([1, 2, 3, 4]).buffer;
    const br = new BinaryReader(buf);
    expect(br.readUint8()).toBe(1);
    expect(br.readUint8()).toBe(2);
    expect(br.readUint8()).toBe(3);
    expect(br.readUint8()).toBe(4);
    expect(br.eof()).toBe(true);
  });

  it('reads from Uint8ClampedArray', () => {
    const clamped = new Uint8ClampedArray([5, 6, 7, 8]);
    const br = new BinaryReader(clamped);
    expect(br.size).toBe(4);
    expect(br.readUint8()).toBe(5);
    expect(br.readUint8()).toBe(6);
    expect(br.readUint8()).toBe(7);
    expect(br.readUint8()).toBe(8);
    expect(br.eof()).toBe(true);
  });

  it('reads from DataView', () => {
    const u8 = new Uint8Array([9, 10, 11, 12]);
    const view = new DataView(u8.buffer);
    const br = new BinaryReader(view);
    expect(br.readUint8()).toBe(9);
    expect(br.readUint8()).toBe(10);
    expect(br.readUint8()).toBe(11);
    expect(br.readUint8()).toBe(12);
  });
});

describe('Unsigned Integers - more', () => {
  it('reads uint16/32/64 via little-endian methods', () => {
    const br16 = new BinaryReader(new Uint8Array([0x34, 0x12]));
    expect(br16.readUint16le()).toBe(0x1234);

    const br32 = new BinaryReader(new Uint8Array([0xef, 0xcd, 0xab, 0x89]));
    expect(br32.readUint32le()).toBe(0x89abcdef);

    const br64 = new BinaryReader(new Uint8Array([0x08, 0x07, 0x06, 0x05, 0x04, 0x03, 0x02, 0x01]));
    expect(br64.readUint64le()).toBe(0x0102030405060708n);
  });
});

describe('Buffer Access - more', () => {
  it('returns remain when peekBytes length omitted', () => {
    const u8 = new Uint8Array([1, 2, 3, 4, 5]);
    const br = new BinaryReader(u8);
    br.seek(2);
    const buf = br.peekBytes();
    expect(buf.byteLength).toBe(3);
    expect(Array.from(new Uint8Array(buf))).toEqual([3, 4, 5]);
    expect(br.position).toBe(2);
  });

  it('clamps oversize readBytes to remain and advances to end', () => {
    const u8 = new Uint8Array([1, 2, 3, 4, 5]);
    const br = new BinaryReader(u8);
    br.seek(1);
    const buf = br.readBytes(999)!;
    expect(buf.byteLength).toBe(4);
    expect(Array.from(new Uint8Array(buf))).toEqual([2, 3, 4, 5]);
    expect(br.position).toBe(5);
  });
});

describe('Floating Point - float16', () => {
  if ('getFloat16' in DataView.prototype) {
    it('reads float16 (if supported)', () => {
      // 1.0 in IEEE 754 half precision = 0x3C00
      const bytes = new Uint8Array([0x3c, 0x00]);
      const br = new BinaryReader(bytes);
      expect(br.readFloat16()).toBeCloseTo(1.0);
    });

    it('reads float16 via LE/BE methods (if supported)', () => {
      // 1.0 in IEEE 754 half precision = 0x3C00
      const brLE = new BinaryReader(new Uint8Array([0x00, 0x3c]));
      expect(brLE.readFloat16le()).toBeCloseTo(1.0);

      const brBE = new BinaryReader(new Uint8Array([0x3c, 0x00]));
      expect(brBE.readFloat16be()).toBeCloseTo(1.0);
    });
  } else {
    it.skip('float16 (not supported in this runtime)', () => {});
  }
});

describe('Strings - more', () => {
  it('returns empty and does not advance with len=0', () => {
    const bytes = new TextEncoder().encode('Hi');
    const br = new BinaryReader(bytes);
    const s = br.readString(0);
    expect(s).toBe('');
    expect(br.position).toBe(0);
  });

  it('consumes NUL when C-string is empty at start', () => {
    const bytes = new Uint8Array([0x00, 0x41]);
    const br = new BinaryReader(bytes);
    const s = br.readString();
    expect(s).toBe('');
    expect(br.position).toBe(1);
    expect(br.readUint8()).toBe(0x41);
  });

  it('returns undefined and does not advance on partial UTF-8', () => {
    const bytes = new TextEncoder().encode('あ'); // 3 bytes in UTF-8
    const br = new BinaryReader(bytes);
    const s = br.readString(2);
    expect(s).toBeUndefined();
    expect(br.position).toBe(0);
  });

  it('decodes multibyte when length matches exactly', () => {
    const bytes = new TextEncoder().encode('あ');
    const br = new BinaryReader(bytes);
    const s = br.readString(3);
    expect(s).toBe('あ');
    expect(br.position).toBe(3);
  });

  it('decodes utf-16le when supported by TextDecoder', () => {
    // 'A' in UTF-16LE is [0x41, 0x00]
    const bytes = new Uint8Array([0x41, 0x00]);
    const br = new BinaryReader(bytes);
    const s = br.readString(2, 'utf-16le');
    // Some runtimes may not support utf-16le and return undefined
    if (s !== undefined) {
      expect(s).toBe('A');
      expect(br.position).toBe(2);
    } else {
      expect(br.position).toBe(0);
    }
  });
});

describe('Bounds and Errors', () => {
  it('throws on read beyond end (Uint16)', () => {
    const br = new BinaryReader(new Uint8Array([0x01]));
    expect(() => br.readUint16()).toThrow(RangeError);
  });

  it('throws on read beyond end (Float64)', () => {
    const br = new BinaryReader(new Uint8Array([0x00, 0x00, 0x00]));
    expect(() => br.readFloat64()).toThrow(RangeError);
  });

  it('throws on seek to unknown bookmark and leaves position unchanged', () => {
    const br = new BinaryReader(new Uint8Array([1, 2, 3]));
    br.seek(2);
    expect(() => br.seek('nope')).toThrow(Error);
    expect(br.position).toBe(2);
  });

  it('clamps negative seek to 0', () => {
    const br = new BinaryReader(new Uint8Array([1, 2, 3]));
    br.seek(-1 as unknown as number);
    expect(br.position).toBe(0);
    expect(br.readUint8()).toBe(1);
  });

  it('advances by 1 on default skip and stays at end', () => {
    const br = new BinaryReader(new Uint8Array([1]));
    expect(br.position).toBe(0);
    br.skip();
    expect(br.position).toBe(1);
    br.skip(); // already at end
    expect(br.position).toBe(1);
  });
});

describe('Alignment', () => {
  it('throws on non-positive alignment (0)', () => {
    const br = new BinaryReader(new Uint8Array([1, 2, 3]));
    // @ts-expect-error runtime should throw RangeError
    expect(() => br.align(0)).toThrow(RangeError);
  });

  it('throws on non-positive alignment (negative)', () => {
    const br = new BinaryReader(new Uint8Array([1, 2, 3]));
    // @ts-expect-error runtime should throw RangeError
    expect(() => br.align(-4)).toThrow(RangeError);
  });
});

describe('Specific endianness methods', () => {
  it('reads int16be as expected', () => {
    const br = new BinaryReader(new Uint8Array([0xff, 0xfe])); // -2
    expect(br.readInt16be()).toBe(-2);
  });

  it('reads int32le as expected', () => {
    // -2 in LE: fe ff ff ff
    const br = new BinaryReader(new Uint8Array([0xfe, 0xff, 0xff, 0xff]));
    expect(br.readInt32le()).toBe(-2);
  });

  it('reads int64be as expected', () => {
    // -2n in BE
    const br = new BinaryReader(new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xfe]));
    expect(br.readInt64be()).toBe(-2n);
  });

  it('reads float32be as expected', () => {
    // 1.0 BE: 3f 80 00 00
    const br = new BinaryReader(new Uint8Array([0x3f, 0x80, 0x00, 0x00]));
    expect(br.readFloat32be()).toBeCloseTo(1.0);
  });

  it('reads float64le as expected', () => {
    // 1.5 LE: 00 00 00 00 00 00 f8 3f
    const br = new BinaryReader(new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf8, 0x3f]));
    expect(br.readFloat64le()).toBeCloseTo(1.5);
  });
});
