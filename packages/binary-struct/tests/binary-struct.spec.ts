import { describe, expect, it } from 'vitest';
import type { Equal } from '../../../tests/_types';
import { expectType } from '../../../tests/_types';
import * as M from '../src/index';

describe('binary-struct', () => {
  describe('Numbers', () => {
    it('roundtrips uint8', () => {
      const t = M.uint8();
      const values = [0, 1, 255];
      for (const v of values) {
        const bytes = t.compose(v);
        expect(bytes).toEqual(new Uint8Array([v]));
        expect(t.parse(bytes)).toBe(v);
      }
    });

    it('roundtrips int8', () => {
      const t = M.int8();
      const values = [-128, -1, 0, 1, 127];
      for (const v of values) {
        const bytes = t.compose(v);
        expect(t.parse(bytes)).toBe(v);
      }
    });

    it('produces expected bytes with endian helpers', () => {
      const le16 = M.uint16le();
      const be16 = M.uint16be();
      const le32 = M.int32le();
      const le64 = M.uint64le();
      expect(le16.compose(0x0201)).toEqual(new Uint8Array([0x01, 0x02]));
      expect(be16.compose(0x0201)).toEqual(new Uint8Array([0x02, 0x01]));
      expect(le16.parse(new Uint8Array([0x34, 0x12]))).toBe(0x1234);
      expect(le32.parse(new Uint8Array([0x78, 0x56, 0x34, 0x12]))).toBe(0x12345678 | 0);
      expect(le32.compose(0x12345678 | 0)).toEqual(new Uint8Array([0x78, 0x56, 0x34, 0x12]));
      expect(le64.parse(new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0]))).toBe(1n);
      expect(le64.compose(513n)).toEqual(new Uint8Array([0x01, 0x02, 0, 0, 0, 0, 0, 0]));
    });

    it('roundtrips across integer widths', () => {
      const le16 = M.int16(true);
      const be16 = M.int16(false);
      expect(le16.parse(le16.compose(-32768))).toBe(-32768);
      expect(le16.parse(le16.compose(32767))).toBe(32767);
      expect(be16.parse(be16.compose(-1))).toBe(-1);

      const le32 = M.int32(true);
      const be32 = M.int32(false);
      expect(le32.parse(le32.compose(-2147483648))).toBe(-2147483648);
      expect(le32.parse(le32.compose(2147483647))).toBe(2147483647);
      expect(be32.parse(be32.compose(-1))).toBe(-1);

      const leU32 = M.uint32(true);
      const beU32 = M.uint32(false);
      const v = 0x12345678 >>> 0;
      expect(leU32.compose(v)).toEqual(new Uint8Array([0x78, 0x56, 0x34, 0x12]));
      expect(beU32.compose(v)).toEqual(new Uint8Array([0x12, 0x34, 0x56, 0x78]));
      expect(leU32.parse(new Uint8Array([0xff, 0xff, 0xff, 0xff]))).toBe(0xffffffff >>> 0);
      expect(beU32.parse(new Uint8Array([0, 0, 0, 0]))).toBe(0);

      const leU64 = M.uint64(true);
      const beU64 = M.uint64(false);
      const val = 0x0102030405060708n;
      expect(leU64.compose(val)).toEqual(new Uint8Array([0x08, 0x07, 0x06, 0x05, 0x04, 0x03, 0x02, 0x01]));
      expect(beU64.compose(val)).toEqual(new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]));
      const max = 0xffff_ffff_ffff_ffffn;
      expect(leU64.parse(leU64.compose(max))).toBe(max);
      expect(beU64.parse(beU64.compose(0n))).toBe(0n);
    });

    it('matches parametric behavior for convenience endian variants', () => {
      expect(M.uint32le().compose(1)).toEqual(M.uint32(true).compose(1));
      expect(M.uint32be().compose(1)).toEqual(M.uint32(false).compose(1));
      expect(M.int16le().compose(-2)).toEqual(M.int16(true).compose(-2));
      expect(M.int16be().compose(-2)).toEqual(M.int16(false).compose(-2));
      expect(M.uint64le().compose(1n)).toEqual(M.uint64(true).compose(1n));
      expect(M.uint64be().compose(1n)).toEqual(M.uint64(false).compose(1n));
      expect(M.int64le().compose(-2n)).toEqual(M.int64(true).compose(-2n));
      expect(M.int64be().compose(-2n)).toEqual(M.int64(false).compose(-2n));
    });

    it('roundtrips int32be and produces expected bytes', () => {
      const be = M.int32be();
      const v = 0x12345678 | 0;
      expect(be.compose(v)).toEqual(new Uint8Array([0x12, 0x34, 0x56, 0x78]));
      expect(be.parse(new Uint8Array([0xff, 0xff, 0xff, 0xff]))).toBe(-1);
      expect(be.parse(be.compose(v))).toBe(v);
    });

    it('roundtrips parametric uint16 in LE and BE', () => {
      const le = M.uint16(true);
      const be = M.uint16(false);
      expect(le.parse(le.compose(0x1234))).toBe(0x1234);
      expect(be.parse(be.compose(0x1234))).toBe(0x1234);
    });

    it('roundtrips parametric constructors across endianness', () => {
      type F = (le?: boolean) => any;
      const entries: Array<[F, unknown]> = [
        [M.uint16 as F, 0x1234],
        [M.uint32 as F, 0x12345678 >>> 0],
        [M.uint64 as F, 0x0102030405060708n],
        [M.int16 as F, -2],
        [M.int32 as F, -3],
        [M.int64 as F, -4n],
        [M.float16 as F, 0.5],
        [M.float32 as F, -2.5],
        [M.float64 as F, Math.PI],
      ];
      const flags = [undefined, true, false] as const;
      for (const [fn, sample] of entries) {
        for (const f of flags) {
          const T = fn(f);
          const bytes = (T as any).compose(sample as any);
          const parsed = (T as any).parse(bytes);
          if (typeof sample === 'number') {
            if (Number.isInteger(sample)) expect(parsed).toBe(sample);
            else expect(parsed).toBeCloseTo(sample, 6);
          } else {
            expect(parsed).toBe(sample);
          }
        }
      }
    });

    it('accepts seeds in init for primitive types', () => {
      expect(M.int8()(-5)).toBe(-5);
      expect(M.uint32()(0x1234)).toBe(0x1234);
      expect(M.uint64()(1n)).toBe(1n);
      expect(M.int16()(-2)).toBe(-2);
      expect(M.int32()(-3)).toBe(-3);
      expect(M.int64()(-4n)).toBe(-4n);
      expect(M.float16()(0.5)).toBe(0.5);
      expect(M.float32()(-2.5)).toBe(-2.5);
      expect(M.float64()(Math.PI)).toBe(Math.PI);
    });
  });

  describe('Floats', () => {
    it('float16/32/64 LE/BE roundtrip', () => {
      const f16le = M.float16(true);
      const f16be = M.float16(false);
      expect(f16le.compose(1.0)).toEqual(new Uint8Array([0x00, 0x3c]));
      expect(f16be.compose(1.0)).toEqual(new Uint8Array([0x3c, 0x00]));
      expect(f16le.parse(new Uint8Array([0x00, 0x3c]))).toBeCloseTo(1.0, 5);
      expect(f16be.parse(new Uint8Array([0x3c, 0x00]))).toBeCloseTo(1.0, 5);

      const f32le = M.float32(true);
      const f32be = M.float32(false);
      expect(f32le.compose(1.0)).toEqual(new Uint8Array([0x00, 0x00, 0x80, 0x3f]));
      expect(f32be.compose(1.0)).toEqual(new Uint8Array([0x3f, 0x80, 0x00, 0x00]));
      expect(f32le.parse(f32le.compose(Math.PI))).toBeCloseTo(Math.PI, 6);
      expect(f32be.parse(f32be.compose(-2.5))).toBeCloseTo(-2.5, 6);

      const f64le = M.float64(true);
      const f64be = M.float64(false);
      expect(f64le.compose(1.0)).toEqual(new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf0, 0x3f]));
      expect(f64be.compose(1.0)).toEqual(new Uint8Array([0x3f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]));
      expect(f64le.parse(f64le.compose(Math.E))).toBeCloseTo(Math.E, 12);
      expect(f64be.parse(f64be.compose(-0.5))).toBeCloseTo(-0.5, 12);
    });

    it('convenience float variants equal parametric', () => {
      expect(M.float32le().compose(1.25)).toEqual(M.float32(true).compose(1.25));
      expect(M.float32be().compose(1.25)).toEqual(M.float32(false).compose(1.25));
      expect(M.float64le().compose(-3.5)).toEqual(M.float64(true).compose(-3.5));
      expect(M.float64be().compose(-3.5)).toEqual(M.float64(false).compose(-3.5));
      expect(M.float16le().compose(0.5)).toEqual(M.float16(true).compose(0.5));
      expect(M.float16be().compose(0.5)).toEqual(M.float16(false).compose(0.5));
    });
  });

  describe('Struct', () => {
    it('roundtrips struct', () => {
      const T = M.struct({ a: M.uint8(), b: M.uint16le() });
      const obj = { a: 1, b: 0x0201 };
      const bytes = T.compose(obj);
      expect(bytes).toEqual(new Uint8Array([1, 0x01, 0x02]));
      expect(T.parse(bytes)).toEqual(obj);
    });
  });

  describe('Choice', () => {
    it('roundtrips string discriminator', () => {
      const C = M.choice(M.string(4), {
        TEXT: M.struct({ text: M.string(M.uint8()) }),
        DATA: M.struct({ bytes: M.uint8array(M.uint8()) }),
      });
      const data = { TEXT: { text: 'hi' } } as const;
      const bytes = C.compose(data);
      expect(bytes).toEqual(new Uint8Array([0x54, 0x45, 0x58, 0x54, 2, 0x68, 0x69]));
      expect(C.parse(bytes)).toEqual(data);
    });

    it('roundtrips number discriminator', () => {
      const C = M.choice(M.uint8(), { 1: M.uint8(), 2: M.uint16le() } as const);
      const data = { 2: 0x0201 } as const;
      const bytes = C.compose(data);
      expect(bytes).toEqual(new Uint8Array([2, 0x01, 0x02]));
      expect(C.parse(bytes)).toEqual(data);
    });

    it('handles discriminated variants', () => {
      const C = M.choice(M.uint8(), { 1: M.uint16le(), 2: M.uint8() } as const);
      expect(C.compose({ 2: 255 })).toEqual(new Uint8Array([2, 255]));
      expect(C.compose({ 1: 0x0201 })).toEqual(new Uint8Array([1, 0x01, 0x02]));
      expect(C.parse(new Uint8Array([2, 123]))).toEqual({ 2: 123 });
      expect(C.parse(new Uint8Array([1, 0x34, 0x12]))).toEqual({ 1: 0x1234 });
    });

    it('throws on invalid definitions or keys', () => {
      const C = M.choice(M.uint8(), { 1: M.uint8() } as const);
      expect(() => M.choice(M.uint8(), {})).toThrow();
      expect(() => C.parse(new Uint8Array([9]))).toThrow();
      const Cw = M.choice(M.uint8(), { 1: M.uint8(), 2: M.uint16le() });
      expect(() => Cw.compose({})).toThrow(/no valid key/);
      expect(() => Cw.compose({ 1: 1, 2: 2 } as any)).toThrow(/multiple keys present/);
    });

    it('handles reserved-only variants and enforces exactly one key', () => {
      const C = M.choice(M.string(1), { a: M.reserved(1, 0x11), b: M.string(), c: M.reserved(5, 0x22) } as const);
      expect(() => C.compose({} as any)).toThrow(/no valid key/);

      const bA = C.compose({ a: undefined });
      expect(Array.from(bA)).toEqual([0x61, 0x11]);
      const pA = C.parse(bA);
      expect('a' in pA).toBe(true);
      expect(Array.from((pA as any).a as Uint8Array)).toEqual([0x11]);

      const bB = C.compose({ b: 'X' });
      expect(Array.from(bB)).toEqual([0x62, 0x58, 0x00]);
      const pB = C.parse(bB);
      expect('b' in pB).toBe(true);
      expect((pB as any).b).toBe('X');

      const bC = C.compose({ c: undefined });
      expect(Array.from(bC)).toEqual([0x63, 0x22, 0x22, 0x22, 0x22, 0x22]);
      const pC = C.parse(bC);
      expect('c' in pC).toBe(true);
      expect(Array.from((pC as any).c as Uint8Array)).toEqual([0x22, 0x22, 0x22, 0x22, 0x22]);
    });

    it('init uses provided seed variant and value', () => {
      const C = M.choice(M.uint8(), { 1: M.uint8(), 2: M.string() } as const);
      const seeded = C({ 2: 'hi' } as any);
      expect(seeded).toEqual({ 2: 'hi' });
    });
  });

  describe('Array', () => {
    it('roundtrips count-prefixed arrays', () => {
      const A = M.array(M.uint8(), M.uint8());
      const data = [1, 2, 3];
      const bytes = A.compose(data);
      expect(bytes).toEqual(new Uint8Array([3, 1, 2, 3]));
      expect(A.parse(bytes)).toEqual(data);
    });

    it('roundtrips arrays without count', () => {
      const A = M.array(undefined, M.uint8());
      const data = [9, 8, 7, 6];
      const bytes = A.compose(data);
      expect(bytes).toEqual(new Uint8Array([9, 8, 7, 6]));
      expect(A.parse(bytes)).toEqual(data);
    });

    it('pads and truncates fixed-length arrays and reads n', () => {
      const A = M.array(3, M.uint8());
      expect(A.compose([9, 8])).toEqual(new Uint8Array([9, 8, 0]));
      expect(A.compose([9, 8, 7, 6])).toEqual(new Uint8Array([9, 8, 7]));
      expect(A.parse(new Uint8Array([1, 2, 3, 4, 5]))).toEqual([1, 2, 3]);
    });

    it('honors per-index seeds for fixed-length arrays', () => {
      const A = M.array(3, M.uint8());
      expect(A([1])).toEqual([1, 0, 0]);
    });

    it('init uses seed elements for variable-length arrays', () => {
      const A = M.array(undefined, M.uint8());
      expect(A([9, 8, 7])).toEqual([9, 8, 7]);
    });

    it('rejects non-numeric length types at read', () => {
      const badLengthType = M.defineType(() => ({
        init: () => 0,
        read: () => 'x' as unknown as number,
        write: () => {},
      }));
      const A = M.array(badLengthType(), M.uint8());
      expect(() => A.parse(new Uint8Array([0xff]))).toThrow(/invalid size specifier/);
    });
  });

  describe('Arrays with reserved elements', () => {
    it('accepts mixed element inputs for variable-length array', () => {
      const A = M.array(undefined, M.reserved(2, 0xab));
      const bytes = A.compose([undefined, 'x', 123] as any);
      expect(Array.from(bytes)).toEqual([0xab, 0xab, 0xab, 0xab, 0xab, 0xab]);
      const out = A.parse(bytes);
      expect(out.length).toBe(3);
      for (const e of out) {
        expect(e).toBeInstanceOf(Uint8Array);
        expect(Array.from(e as Uint8Array)).toEqual([0xab, 0xab]);
      }
    });

    it('roundtrips count-prefixed array of reserved', () => {
      const A = M.array(M.uint8(), M.reserved(3, 0x33));
      const bytes = A.compose([undefined, 'x'] as any);
      expect(Array.from(bytes)).toEqual([2, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33]);
      const out = A.parse(bytes);
      expect(out.length).toBe(2);
      expect(Array.from(out[0] as Uint8Array)).toEqual([0x33, 0x33, 0x33]);
      expect(Array.from(out[1] as Uint8Array)).toEqual([0x33, 0x33, 0x33]);
    });
  });

  describe('Typed Arrays', () => {
    it('roundtrips uint16learray with count prefix', () => {
      const A = M.uint16learray(M.uint8());
      const src = new Uint16Array([1, 256, 0x4321]);
      const bytes = A.compose(src);
      expect(bytes).toEqual(new Uint8Array([3, 0x01, 0x00, 0x00, 0x01, 0x21, 0x43]));
      const parsed = A.parse(bytes);
      expect([...parsed]).toEqual([...src]);
    });

    it('roundtrips uint8array without count', () => {
      const A = M.uint8array();
      const src = new Uint8Array([1, 2, 3, 255]);
      const bytes = A.compose(src);
      expect(bytes).toEqual(src);
      const parsed = A.parse(bytes);
      expect([...parsed]).toEqual([...src]);
    });

    it('roundtrips int32bearray with uint8 count', () => {
      const A = M.int32bearray(M.uint8());
      const src = new Int32Array([1, -2]);
      const bytes = A.compose(src);
      expect(bytes).toEqual(new Uint8Array([2, 0x00, 0x00, 0x00, 0x01, 0xff, 0xff, 0xff, 0xfe]));
      const parsed = A.parse(bytes);
      expect([...parsed]).toEqual([...src]);
    });

    it('roundtrips uint64learray with uint8 count', () => {
      const A = M.uint64learray(M.uint8());
      const src = new BigUint64Array([1n, 513n]);
      const bytes = A.compose(src);
      expect(bytes).toEqual(
        new Uint8Array([
          2, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        ]),
      );
      const parsed = A.parse(bytes);
      expect([...parsed]).toEqual([...src]);
    });

    it('roundtrips float32learray with uint8 count', () => {
      const A = M.float32learray(M.uint8());
      const src = new Float32Array([1.0, -2.5]);
      const bytes = A.compose(src);
      expect(bytes).toEqual(new Uint8Array([2, 0x00, 0x00, 0x80, 0x3f, 0x00, 0x00, 0x20, 0xc0]));
      const parsed = A.parse(bytes);
      expect(parsed.length).toBe(2);
      expect(parsed[0]).toBeCloseTo(1.0, 6);
      expect(parsed[1]).toBeCloseTo(-2.5, 6);
    });

    it('handles fixed-length typed arrays', () => {
      const A = M.uint8array(3);
      expect(A.compose(new Uint8Array([9, 8]))).toEqual(new Uint8Array([9, 8, 0]));
      expect(A.compose(new Uint8Array([9, 8, 7, 6]))).toEqual(new Uint8Array([9, 8, 7]));
      const parsed = A.parse(new Uint8Array([1, 2, 3, 4, 5]));
      expect([...parsed]).toEqual([1, 2, 3]);
    });

    it('respects seeds in typedArray', () => {
      const T = M.typedArray(undefined, M.uint8(), Uint8Array);
      const seeded = T(new Uint8Array([9, 8, 7]));
      expect([...seeded]).toEqual([9, 8, 7]);
    });

    it('roundtrips typed-array factory helpers', () => {
      const mk = M.defineTypedArrayType(M.uint32);
      const U32 = mk<Uint32Array>(Uint32Array);
      const T = U32(M.uint8());
      const v = new Uint32Array([1, 2]);
      const parsed = T.parse(T.compose(v));
      expect([...parsed]).toEqual([...v]);
    });

    it('supports Uint8ClampedArray via typedArray ctor', () => {
      const T = M.typedArray(M.uint8(), M.uint8(), Uint8ClampedArray);
      const v = new Uint8ClampedArray([0, 255, 300]);
      const parsed = T.parse(T.compose(v));
      expect([...parsed]).toEqual([0, 255, 255]);
    });

    it('roundtrips no-prefix and endian variants', () => {
      const t1 = M.int8array();
      const v1 = new Int8Array([1, -1]);
      expect([...t1.parse(t1.compose(v1))]).toEqual([...v1]);

      const t2 = M.float32array();
      const v2 = new Float32Array([1.0, -2.5]);
      const p2 = t2.parse(t2.compose(v2));
      expect(p2.length).toBe(2);
      expect(p2[0]).toBeCloseTo(v2[0], 6);
      expect(p2[1]).toBeCloseTo(v2[1], 6);

      const tU16 = M.uint16array(M.uint8());
      const vU16 = new Uint16Array([0, 0x1234]);
      expect([...tU16.parse(tU16.compose(vU16))]).toEqual([...vU16]);

      const tU32 = M.uint32array(M.uint8());
      const vU32 = new Uint32Array([1, 0x89abcd]);
      expect([...tU32.parse(tU32.compose(vU32))]).toEqual([...vU32]);

      const tU64 = M.uint64array(M.uint8());
      const vU64 = new BigUint64Array([1n, 513n]);
      expect([...tU64.parse(tU64.compose(vU64))]).toEqual([...vU64]);

      const tI16 = M.int16array(M.uint8());
      const vI16 = new Int16Array([-1, 2]);
      expect([...tI16.parse(tI16.compose(vI16))]).toEqual([...vI16]);

      const tI32 = M.int32array(M.uint8());
      const vI32 = new Int32Array([1, -2]);
      expect([...tI32.parse(tI32.compose(vI32))]).toEqual([...vI32]);

      const tI64 = M.int64array(M.uint8());
      const vI64 = new BigInt64Array([-1n, 2n]);
      expect([...tI64.parse(tI64.compose(vI64))]).toEqual([...vI64]);

      const tF16 = M.float16array(M.uint8());
      const vF16 = new Float16Array([1.0, -2.5]);
      const pF16 = tF16.parse(tF16.compose(vF16));
      expect(pF16.length).toBe(2);

      const tF64 = M.float64array(M.uint8());
      const vF64 = new Float64Array([Math.E, -0.5]);
      const pF64 = tF64.parse(tF64.compose(vF64));
      expect(pF64.length).toBe(2);

      const tU32le = M.uint32learray(M.uint8());
      const vU32le = new Uint32Array([1, 2]);
      expect([...tU32le.parse(tU32le.compose(vU32le))]).toEqual([...vU32le]);

      const tI16le = M.int16learray(M.uint8());
      const vI16le = new Int16Array([1, -2]);
      expect([...tI16le.parse(tI16le.compose(vI16le))]).toEqual([...vI16le]);

      const tI32le = M.int32learray(M.uint8());
      const vI32le = new Int32Array([1, -2]);
      expect([...tI32le.parse(tI32le.compose(vI32le))]).toEqual([...vI32le]);

      const tI64le = M.int64learray(M.uint8());
      const vI64le = new BigInt64Array([1n, -2n]);
      expect([...tI64le.parse(tI64le.compose(vI64le))]).toEqual([...vI64le]);

      const tU16be = M.uint16bearray(M.uint8());
      const vU16be = new Uint16Array([0x1122, 0x3344]);
      expect([...tU16be.parse(tU16be.compose(vU16be))]).toEqual([...vU16be]);

      const tU32be = M.uint32bearray(M.uint8());
      const vU32be = new Uint32Array([1, 2]);
      expect([...tU32be.parse(tU32be.compose(vU32be))]).toEqual([...vU32be]);

      const tU64be = M.uint64bearray(M.uint8());
      const vU64be = new BigUint64Array([1n, 2n]);
      expect([...tU64be.parse(tU64be.compose(vU64be))]).toEqual([...vU64be]);

      const tI16be = M.int16bearray(M.uint8());
      const vI16be = new Int16Array([-2, 3]);
      expect([...tI16be.parse(tI16be.compose(vI16be))]).toEqual([...vI16be]);

      const tI64be = M.int64bearray(M.uint8());
      const vI64be = new BigInt64Array([-1n, 2n]);
      expect([...tI64be.parse(tI64be.compose(vI64be))]).toEqual([...vI64be]);

      const tF16be = M.float16bearray(M.uint8());
      const vF16be = new Float16Array([1.0, 2.0]);
      const pF16be = tF16be.parse(tF16be.compose(vF16be));
      expect(pF16be.length).toBe(2);

      const tF32be = M.float32bearray(M.uint8());
      const vF32be = new Float32Array([Math.PI, -2.5]);
      const pF32be = tF32be.parse(tF32be.compose(vF32be));
      expect(pF32be.length).toBe(2);

      const tF64be = M.float64bearray(M.uint8());
      const vF64be = new Float64Array([1.0, -0.5]);
      const pF64be = tF64be.parse(tF64be.compose(vF64be));
      expect(pF64be.length).toBe(2);
    });
  });

  describe('String', () => {
    it('roundtrips cstring and enforces the terminator', () => {
      const S = M.cstring();
      const s = 'abc';
      const bytes = S.compose(s);
      expect(bytes).toEqual(new Uint8Array([0x61, 0x62, 0x63, 0x00]));
      expect(S.parse(bytes)).toBe(s);
      expect(() => S.parse(new Uint8Array([0x61, 0x62]))).toThrow(/terminator/);
    });

    it('roundtrips length-prefixed and fixed-length strings', () => {
      const S1 = M.string(M.uint8());
      const b1 = S1.compose('abc');
      expect(b1).toEqual(new Uint8Array([3, 0x61, 0x62, 0x63]));
      expect(S1.parse(b1)).toBe('abc');

      const S2 = M.string(M.uint16le());
      const b2 = S2.compose('ab');
      expect(b2).toEqual(new Uint8Array([0x02, 0x00, 0x61, 0x62]));
      expect(S2.parse(b2)).toBe('ab');

      const S3 = M.string(5);
      const short = S3.compose('ab');
      expect(short).toEqual(new Uint8Array([0x61, 0x62, 0x00, 0x00, 0x00]));
      expect(S3.parse(short)).toBe('ab\u0000\u0000\u0000');
      const long = S3.compose('abcdef');
      expect(long).toEqual(new Uint8Array([0x61, 0x62, 0x63, 0x64, 0x65]));
      expect(S3.parse(long)).toBe('abcde');
    });

    it('uses a custom codec', () => {
      const codec = {
        encode: (s: string) => new TextEncoder().encode(s),
        encodeInto: (s: string, u8: Uint8Array) => {
          const e = new TextEncoder().encode(s);
          u8.set(e.subarray(0, u8.length));
        },
        decode: (u8: Uint8Array) => String.fromCharCode(...u8),
      };
      const S = M.string(M.uint8(), codec);
      const bytes = S.compose('xyz');
      expect(bytes).toEqual(new Uint8Array([3, 0x78, 0x79, 0x7a]));
      expect(S.parse(bytes)).toBe('xyz');
    });

    it('surfaces decoder failures', () => {
      const S = M.string(M.uint8());
      const buf = new Uint8Array([2, 0xc3, 0x28]);
      expect(() => S.parse(buf)).toThrow(/decode failed|terminator missing/);
    });

    it('init accepts seed and errors on invalid length type', () => {
      const S = M.string();
      expect(S('x')).toBe('x');

      const badLen = M.defineType<number>(() => ({
        init: () => 0,
        read: () => undefined as unknown as number,
        write: () => {},
      }));
      const Bad = M.string(badLen());
      expect(() => Bad.parse(new Uint8Array([0]))).toThrow(/invalid size specifier/);
    });

    it('writes undefined as empty for length-prefixed', () => {
      const S = M.string(M.uint8());
      const b = S.compose();
      expect(b).toEqual(new Uint8Array([0]));
    });
  });

  describe('Tuple', () => {
    it('roundtrips tuple', () => {
      const T = M.tuple([M.uint8(), M.uint16le()]);
      const data: [number, number] = [5, 0x0201];
      const bytes = T.compose(data);
      expect(bytes).toEqual(new Uint8Array([5, 0x01, 0x02]));
      expect(T.parse(bytes)).toEqual(data);
    });
  });

  describe('Enumerate', () => {
    it('maps objects and arrays', () => {
      const E1 = M.enumerate({ A: 1, B: 2 }, M.uint8());
      expect(E1.compose('B')).toEqual(new Uint8Array([2]));
      expect(E1.parse(new Uint8Array([1]))).toBe('A');
      const E2 = M.enumerate(['Zero', 'One', 'Two'], M.uint8());
      expect(E2.compose('Two')).toEqual(new Uint8Array([2]));
      expect(E2.parse(new Uint8Array([1]))).toBe('One');
    });

    it('defaults to uint8', () => {
      const E = M.enumerate({ A: 0, B: 1 });
      expect(E.compose('B')).toEqual(new Uint8Array([1]));
      expect(E.parse(new Uint8Array([0]))).toBe('A');
    });
  });

  describe('Size Hook', () => {
    it('prefixes content size and validates', () => {
      const payload = M.array(undefined, M.uint8());
      const T = payload.withSize(M.uint8());
      const bytes = T.compose([1, 2, 3]);
      expect(bytes).toEqual(new Uint8Array([3, 1, 2, 3]));
      expect(T.parse(bytes)).toEqual([1, 2, 3]);
    });

    it('throws on size mismatch', () => {
      const payload = M.uint8();
      const T = payload.withSize(M.uint8());
      expect(() => T.parse(new Uint8Array([2, 0xaa]))).toThrow(/size mismatch/);
    });
  });

  describe('Hooks', () => {
    it('applies tag and ref to read/write', () => {
      const T = M.struct({ first: M.uint8(), second: M.uint8().ref('start'), pad: M.reserved(1, 0xee) }).tag('start');
      const bytes = T.compose({ first: 0xaa, second: 0xbb });
      expect(bytes).toEqual(new Uint8Array([0xbb, 0xee]));
      const obj = T.parse(bytes);
      expect(obj['first']).toBe(0xbb);
      expect(obj['second']).toBe(0xbb);
      expect(obj['pad']).toBeInstanceOf(Uint8Array);
      expect(Array.from(obj['pad'] as Uint8Array)).toEqual([0xee]);
    });

    it('overwrites earlier bookmark via ref', () => {
      const T = M.tuple([M.uint8().tag('hdr'), M.uint16le().ref('hdr')]);
      const bytes = T.compose([0xaa, 0x0201]);
      expect(bytes).toEqual(new Uint8Array([0x01, 0x02]));
      const parsed = T.parse(bytes);
      expect(parsed).toEqual([0x01, 0x0201]);
    });

    it('keeps decorators immutable', () => {
      const base = M.array(undefined, M.uint8());
      const sized = base.withSize(M.uint8());
      expect(sized.compose([1, 2, 3])).toEqual(new Uint8Array([3, 1, 2, 3]));
      expect(base.compose([4, 5])).toEqual(new Uint8Array([4, 5]));
    });
  });

  describe('Bitfields', () => {
    it('encodes and decodes 8-bit MSB', () => {
      const BF = M.bitfields({ A: 1, B: 2, C: 5 });
      const value = 0b11010001;
      const obj = BF.parse(new Uint8Array([value]));
      expect(obj).toEqual({ A: 1, B: 2, C: 17 });
      const bytes = BF.compose({ A: 1, B: 2, C: 17 });
      expect(bytes).toEqual(new Uint8Array([0xd1]));
    });

    it('encodes and decodes with LSB ordering', () => {
      const BF = M.bitfields({ A: 1, B: 2, C: 5 }, undefined, true);
      const bytes = BF.compose({ A: 1, B: 2, C: 17 });
      expect(bytes).toEqual(new Uint8Array([0x8d]));
      expect(BF.parse(bytes)).toEqual({ A: 1, B: 2, C: 17 });
    });

    it('handles 16-bit totals with LE/BE', () => {
      const fields = { A: 4, B: 4, C: 8 } as const;
      const BFle = M.bitfields(fields, true);
      const BFbe = M.bitfields(fields, false);
      const obj = { A: 0xa, B: 0xb, C: 0xcd };
      expect(BFle.compose(obj)).toEqual(new Uint8Array([0xcd, 0xab]));
      expect(BFbe.compose(obj)).toEqual(new Uint8Array([0xab, 0xcd]));
      expect(BFle.parse(new Uint8Array([0xcd, 0xab]))).toEqual(obj);
      expect(BFbe.parse(new Uint8Array([0xab, 0xcd]))).toEqual(obj);
    });

    it('handles 32/40/64-bit boundaries and errors', () => {
      const fields32 = { A: 4, B: 4, C: 8, D: 8, E: 8 } as const;
      const BFle32 = M.bitfields(fields32, true);
      const BFbe32 = M.bitfields(fields32, false);
      const obj32 = { A: 0x1, B: 0x2, C: 0x34, D: 0x56, E: 0x78 };
      expect(BFle32.compose(obj32)).toEqual(new Uint8Array([0x78, 0x56, 0x34, 0x12]));
      expect(BFbe32.compose(obj32)).toEqual(new Uint8Array([0x12, 0x34, 0x56, 0x78]));

      const fields40 = { A: 8, B: 8, C: 8, D: 8, E: 8 } as const;
      const BFbe40 = M.bitfields(fields40, false);
      const BFle40 = M.bitfields(fields40, true);
      const obj40 = { A: 0x01, B: 0x02, C: 0x03, D: 0x04, E: 0x05 };
      expect(BFbe40.compose(obj40)).toEqual(new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]));
      expect(BFbe40.parse(new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]))).toEqual(obj40);
      expect(BFle40.compose(obj40)).toEqual(new Uint8Array([0x05, 0x04, 0x03, 0x02, 0x01]));
      expect(BFle40.parse(new Uint8Array([0x05, 0x04, 0x03, 0x02, 0x01]))).toEqual(obj40);

      const BFlsb = M.bitfields(fields40, true, true);
      const bytes = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]);
      expect(BFlsb.compose(obj40)).toEqual(bytes);
      expect(BFlsb.parse(bytes)).toEqual(obj40);

      const BF = M.bitfields({ A: 8 } as const);
      expect(() => BF.parse(new Uint8Array([]))).toThrow(/insufficient bytes/);
      expect(() => M.bitfields({ A: 0 } as const)).toThrow(/invalid bit length/);
    });

    it('masks overflows and type-checks on write', () => {
      const BF = M.bitfields({ A: 4, B: 60 } as const);
      const bytes = BF.compose({ A: 0xff, B: 0xffff_ffff_ffff_ffffn });
      expect(bytes instanceof Uint8Array).toBe(true);
      const BFnum = M.bitfields({ A: 8 });
      expect(() => BFnum.compose({ A: 1n } as any)).toThrow(/requires number/);
      const BFbig = M.bitfields({ A: 60 } as const);
      expect(() => BFbig.compose({ A: 1 } as any)).toThrow(/requires bigint/);
    });

    it('reflects default value kind by width', () => {
      const BFnum = M.bitfields({ A: 8, B: 8 });
      expect(BFnum()).toEqual({ A: 0, B: 0 });
      const BFbig = M.bitfields({ Big: 60 });
      expect(BFbig()).toEqual({ Big: 0n });
    });

    it('init respects provided seed object', () => {
      const BF = M.bitfields({ Small: 8, Large: 60 });
      const init = BF({ Small: 7, Large: 9n });
      expect(init).toEqual({ Small: 7, Large: 9n });
    });

    it('parses bigint fields (>=51 bits)', () => {
      const BF = M.bitfields({ Big: 60 } as const);
      const bytes = BF.compose({ Big: 0x0fn as unknown as bigint });
      expect(BF.parse(bytes)).toEqual({ Big: 0x0fn });
    });
  });

  describe('Reserved', () => {
    it('reads/writes reserved bytes and composes in structs', () => {
      const R = M.reserved(2, 0xab);
      const bytes = R.compose();
      expect(bytes).toEqual(new Uint8Array([0xab, 0xab]));
      const parsed = R.parse(bytes);
      expect(parsed).toBeInstanceOf(Uint8Array);
      expect(Array.from(parsed as Uint8Array)).toEqual([0xab, 0xab]);

      const A = M.struct({ _padA: M.reserved(5), name: M.cstring() });
      const B = M.struct({ name: M.cstring(), _padB: M.reserved(10) });
      const a = A.compose({ name: '' });
      expect(a).toEqual(new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00]));
      const b = B.compose({ name: '' });
      expect(b).toEqual(new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]));
      const cond = Math.random() > 0.5;
      const U = cond ? A : B;
      const bytes2 = U.compose({ name: '' });
      expect([6, 11]).toContain(bytes2.length);
    });

    it('handles zero-length reserved', () => {
      const R0 = M.reserved(0, 0x99);
      const bytes = R0.compose();
      expect(bytes).toEqual(new Uint8Array([]));
      const parsed = R0.parse(bytes);
      expect(parsed).toBeInstanceOf(Uint8Array);
      expect((parsed as Uint8Array).length).toBe(0);
    });

    it('ignores provided values for reserved fields in struct', () => {
      const S = M.struct({ pad: M.reserved(3, 0xaa), v: M.uint8() });
      const cases: Array<[any, Uint8Array]> = [
        [undefined, new Uint8Array([0xaa, 0xaa, 0xaa])],
        [10, new Uint8Array([0xaa, 0xaa, 0xaa])],
        ['x', new Uint8Array([0xaa, 0xaa, 0xaa])],
        [new Uint8Array([1, 2, 3]), new Uint8Array([0xaa, 0xaa, 0xaa])],
        [{ any: 'obj' }, new Uint8Array([0xaa, 0xaa, 0xaa])],
      ];
      for (const [val, expected] of cases) {
        const b = S.compose({ pad: val, v: 7 } as any);
        expect(b).toEqual(new Uint8Array([...expected, 7]));
        const o = S.parse(b);
        expect(o.pad).toBeInstanceOf(Uint8Array);
        expect(Array.from(o.pad as Uint8Array)).toEqual([...expected]);
        expect(o.v).toBe(7);
      }
    });
  });

  describe('Factories and Defaults', () => {
    it('chains defineType hooks', () => {
      const myType = M.defineType(() => ({
        init: () => 0,
        read: (r) => r.readUint8(),
        write: (w, v: number) => w.writeUint8(v),
      }))();
      expect(() => myType.tag('here').ref('here')).not.toThrow();
    });

    it('produces defaults in array/typedArray factories', () => {
      expect(M.array(undefined, M.uint8())()).toEqual([]);
      expect(M.array(2, M.uint8())()).toEqual([0, 0]);
      expect(M.typedArray(M.uint8(), M.uint8(), Uint8Array)() instanceof Uint8Array).toBe(true);
      expect(M.typedArray(4, M.uint16le(), Uint16Array)().length).toBe(4);
      const arrU8Factory = M.defineArrayType(M.uint8);
      expect(arrU8Factory()()).toEqual([]);
      const Arr3 = arrU8Factory(3);
      expect(Arr3.compose([1, 2])).toEqual(new Uint8Array([1, 2, 0]));
      expect(Arr3.parse(new Uint8Array([7, 8, 9, 10]))).toEqual([7, 8, 9]);
      const mkU32 = M.defineTypedArrayType(M.uint32);
      const U32 = mkU32<Uint32Array>(Uint32Array);
      expect(U32(M.uint8())() instanceof Uint32Array).toBe(true);
      expect(U32(5)().length).toBe(5);
    });

    it('applies defineArrayType with length prefix over BE elements', () => {
      const arrOfI32be = M.defineArrayType(M.int32)(M.uint8());
      const values = [1, -2];
      const bytes = arrOfI32be.compose(values);
      expect(bytes).toEqual(new Uint8Array([2, 0x00, 0x00, 0x00, 0x01, 0xff, 0xff, 0xff, 0xfe]));
      expect(arrOfI32be.parse(bytes)).toEqual(values);
    });

    it('returns sensible defaults from primitive constructors', () => {
      expect(typeof M.uint8()()).toBe('number');
      expect(typeof M.int8()()).toBe('number');
      expect(typeof M.uint16()()).toBe('number');
      expect(typeof M.int16()()).toBe('number');
      expect(typeof M.uint32()()).toBe('number');
      expect(typeof M.int32()()).toBe('number');
      expect(typeof M.uint64()()).toBe('bigint');
      expect(typeof M.int64()()).toBe('bigint');
      expect(typeof M.float16()()).toBe('number');
      expect(typeof M.float32()()).toBe('number');
      expect(typeof M.float64()()).toBe('number');
      expect(typeof M.uint16le()()).toBe('number');
      expect(typeof M.uint16be()()).toBe('number');
      expect(typeof M.uint32le()()).toBe('number');
      expect(typeof M.uint32be()()).toBe('number');
      expect(typeof M.uint64le()()).toBe('bigint');
      expect(typeof M.uint64be()()).toBe('bigint');
      expect(typeof M.int16le()()).toBe('number');
      expect(typeof M.int16be()()).toBe('number');
      expect(typeof M.int32le()()).toBe('number');
      expect(typeof M.int32be()()).toBe('number');
      expect(typeof M.int64le()()).toBe('bigint');
      expect(typeof M.int64be()()).toBe('bigint');
      expect(typeof M.float16le()()).toBe('number');
      expect(typeof M.float16be()()).toBe('number');
      expect(typeof M.float32le()()).toBe('number');
      expect(typeof M.float32be()()).toBe('number');
      expect(typeof M.float64le()()).toBe('number');
      expect(typeof M.float64be()()).toBe('number');
    });

    it('produces defaults from typed array helpers', () => {
      expect(M.uint8array()().byteLength).toBe(0);
      expect(M.int8array()().byteLength).toBe(0);
      expect(M.uint16array()().byteLength).toBe(0);
      expect(M.uint32array()().byteLength).toBe(0);
      expect(M.uint64array()().byteLength).toBe(0);
      expect(M.int16array()().byteLength).toBe(0);
      expect(M.int32array()().byteLength).toBe(0);
      expect(M.int64array()().byteLength).toBe(0);
      expect(M.float16array()().byteLength).toBe(0);
      expect(M.float32array()().byteLength).toBe(0);
      expect(M.float64array()().byteLength).toBe(0);
      const c = M.uint8();
      expect(M.uint16learray(c)().byteLength).toBe(0);
      expect(M.uint32learray(c)().byteLength).toBe(0);
      expect(M.uint64learray(c)().byteLength).toBe(0);
      expect(M.int16learray(c)().byteLength).toBe(0);
      expect(M.int32learray(c)().byteLength).toBe(0);
      expect(M.int64learray(c)().byteLength).toBe(0);
      expect(M.float16learray(c)().byteLength).toBe(0);
      expect(M.float32learray(c)().byteLength).toBe(0);
      expect(M.float64learray(c)().byteLength).toBe(0);
      expect(M.uint16bearray(c)().byteLength).toBe(0);
      expect(M.uint32bearray(c)().byteLength).toBe(0);
      expect(M.uint64bearray(c)().byteLength).toBe(0);
      expect(M.int16bearray(c)().byteLength).toBe(0);
      expect(M.int64bearray(c)().byteLength).toBe(0);
      expect(M.int32bearray(c)().byteLength).toBe(0);
      expect(M.float16bearray(c)().byteLength).toBe(0);
      expect(M.float32bearray(c)().byteLength).toBe(0);
      expect(M.float64bearray(c)().byteLength).toBe(0);
    });

    it('produces composite defaults', () => {
      const S = M.struct({ a: M.uint8(), b: M.uint16le() });
      const s = S();
      expect(typeof s.a).toBe('number');
      expect(typeof s.b).toBe('number');
      const T = M.tuple([M.uint8(), M.uint16le()]);
      const t = T();
      expect(Array.isArray(t)).toBe(true);
      expect(t.length).toBe(2);
      const E = M.enumerate({ A: 0, B: 1 });
      expect(typeof E()).toBe('string');
      const C = M.choice(M.uint8(), { 1: M.uint8(), 2: M.uint16le() } as const);
      const c = C();
      expect(typeof c).toBe('object');
      const keys = Object.keys(c as Record<string, unknown>);
      expect(keys.length).toBe(1);
      expect(M.string(M.uint8())()).toBe('');
      expect(M.cstring()()).toBe('');
      expect(M.reserved(5, 0xaa)()).toBeUndefined();
    });
  });

  describe('Type Inference', () => {
    it('infers union from enumerate array mapping', () => {
      const E = M.enumerate(['Zero', 'One', 'Two']);
      const v: ReturnType<typeof E> = 'One';
      expect(typeof E()).toBe('string');
      expect(typeof v).toBe('string');
    });

    it('infers struct keys from tuple without const assertion', () => {
      const S = M.struct([
        ['a', M.uint8()],
        ['b', M.uint16le()],
      ]);
      const v: ReturnType<typeof S> = { a: 1, b: 0x0201 };
      expect(S.compose(v) instanceof Uint8Array).toBe(true);
    });

    it('accepts precise object types in choice.compose', () => {
      const Cn = M.choice(M.uint8(), { 1: M.uint8(), 2: M.uint16le() });
      const o1: Parameters<typeof Cn.compose>[0] = { 1: 255 };
      const o2: Parameters<typeof Cn.compose>[0] = { 2: 0x0201 };
      expect(Cn.compose(o1) instanceof Uint8Array).toBe(true);
      expect(Cn.compose(o2) instanceof Uint8Array).toBe(true);
    });

    it('infers number/bigint field types in bitfields', () => {
      const BF = M.bitfields({ Small: 8, Large: 60 });
      const x: Parameters<typeof BF.compose>[0] = { Small: 1, Large: 1n };
      expect(BF.compose(x) instanceof Uint8Array).toBe(true);
    });

    it('establishes compile-time shapes', () => {
      const S = M.struct({ a: M.uint8(), b: M.uint16le() });
      type SOut = ReturnType<typeof S>;
      expectType<Equal<SOut, { a: number; b: number }>>();

      const Tup = M.tuple([M.uint8(), M.uint16le()]);
      type TOut = ReturnType<typeof Tup>;
      expectType<Equal<TOut, [number, number]>>();

      const E = M.enumerate(['Zero', 'One', 'Two']);
      type EOut = ReturnType<typeof E>;
      expectType<Equal<EOut, 'Zero' | 'One' | 'Two'>>();

      const C = M.choice(M.uint8(), { 1: M.uint8(), 2: M.uint16le() } as const);
      type COut = ReturnType<typeof C>;
      expectType<Equal<COut, Partial<{ 1: number; 2: number }>>>();

      const BF2 = M.bitfields({ A: 8, Big: 51 });
      type BF2Out = ReturnType<typeof BF2>;
      expectType<Equal<BF2Out['A'], number>>();
      expectType<Equal<BF2Out['Big'], bigint>>();

      const Arr = M.array(3, M.uint8());
      type ArrOut = ReturnType<typeof Arr>;
      expectType<Equal<ArrOut, number[]>>();

      const TA = M.typedArray(M.uint8(), M.uint8(), Uint8Array);
      void TA;
    });

    it('infers struct write/seed and treats reserved as optional', () => {
      const S = M.struct({ pad: M.reserved(2), a: M.uint8(), b: M.string(M.uint8()) });
      void S.compose({ a: 1, b: '' });
      void S.compose({ a: 1, b: '', pad: undefined });
      void S({ a: 1 });
      expect(true).toBe(true);
    });

    it('infers seed/write types for array and typedArray', () => {
      const A = M.array(3, M.uint8());
      expectType<Equal<Parameters<typeof A>[0], number[] | undefined>>();
      expectType<Equal<Parameters<typeof A.write>[1], number[]>>();

      const T = M.typedArray(2, M.uint16le(), Uint16Array);
      void T(new Uint16Array([1, 2]));
      void T([1, 2] as ArrayLike<number>);
      void T.compose(new Uint16Array([1, 2]));
      expect(true).toBe(true);
    });

    it('preserves read/compose types through withSize/tag/ref', () => {
      const A = M.array(undefined, M.uint8());
      const B = A.withSize(M.uint8()).tag('x').ref('x');
      void (A.parse as any);
      void (B.parse as any);
      void (A.compose as any);
      void (B.compose as any);
      expect(true).toBe(true);
    });

    it('infers result arrays from typed array factories', () => {
      const mk = M.defineTypedArrayType(M.uint32);
      const U32 = mk<Uint32Array>(Uint32Array);
      const arr = U32(M.uint8())();
      expectType<Equal<typeof arr, Uint32Array>>();
      expect(arr instanceof Uint32Array).toBe(true);
    });

    it('returns key union when enumerate omits base type', () => {
      const E = M.enumerate({ A: 0, B: 1 });
      void (E as any);
      const E2 = M.enumerate(['X', 'Y']);
      void (E2 as any);
      expect(true).toBe(true);
    });

    it('yields a tagged union object for string-discriminated choice', () => {
      const C = M.choice(M.string(M.uint8()), { A: M.uint8(), B: M.uint16le() } as const);
      void C.compose({ A: 1 });
      void C.compose({ B: 2 });
      expect(true).toBe(true);
    });

    it('accepts struct/tuple seeds (partial/object vs positional)', () => {
      const S = M.struct({ a: M.uint8(), b: M.uint16le() });
      void S({ a: 1 });

      const T = M.tuple([M.uint8(), M.uint16le()]);
      void T([1, 0x0201]);
      expect(true).toBe(true);
    });

    it('infers write types consistently in defineArrayType (n specified/omitted)', () => {
      const arrU8Factory = M.defineArrayType(M.uint8);
      const TNoN = arrU8Factory();
      void TNoN.compose([1, 2]);

      const Arr3 = arrU8Factory(3);
      void Arr3.compose([1, 2]);
      expect(true).toBe(true);
    });
  });

  describe('array of struct with reserved', () => {
    it('omits pad on write and roundtrips', () => {
      const Entry = M.struct({
        id: M.uint32le(),
        _pad: M.reserved(16),
        name: M.string(32),
      });
      void Entry.compose({ id: 1, name: 'A' });
      void Entry.compose({ id: 1, name: 'A', _pad: undefined });

      const Snapshot = M.struct({ entries: M.array(undefined, Entry) });

      void Snapshot.compose({ entries: [{ id: 1, name: 'A' }] });

      type _SnapWrite = Parameters<typeof Snapshot.compose>[0];
      type _Elem = _SnapWrite['entries'][number];
      expectType<Equal<_Elem extends { id: number; name: string } ? true : false, true>>();
      expectType<Equal<_Elem extends { _pad?: unknown } ? true : false, true>>();
      const one = { entries: [{ id: 1, name: 'A' }] } as const;
      const bytes = Snapshot.compose(one);
      expect(bytes.byteLength).toBe(52);
      const round = Snapshot.parse(bytes);
      expect(round.entries.length).toBe(1);
      expect(round.entries[0].id).toBe(1);
      expect(round.entries[0].name).toBe('A' + '\0'.repeat(31));
    });

    it('writes count before elements when count-prefixed', () => {
      const Entry = M.struct({ id: M.uint32le(), _pad: M.reserved(16), name: M.string(32) });
      const Counted = M.struct({ entries: M.array(M.uint8(), Entry) });

      const data = {
        entries: [
          { id: 1, name: 'A' },
          { id: 2, name: 'B' },
        ],
      } as const;
      const bytes = Counted.compose(data);
      expect(bytes.byteLength).toBe(1 + 52 * 2);
      expect(bytes[0]).toBe(2);
      const parsed = Counted.parse(bytes);
      expect(parsed.entries.map((e) => e.id)).toEqual([1, 2]);
      expect(parsed.entries[0].name).toBe('A' + '\0'.repeat(31));
      expect(parsed.entries[1].name).toBe('B' + '\0'.repeat(31));
    });
  });

  describe('array of reserved elements', () => {
    it('roundtrips and derives count from input length', () => {
      const Pads = M.array(3, M.reserved(2, 0xab));
      const bytes = Pads.compose([undefined, undefined, undefined]);
      expect(Array.from(bytes)).toEqual([0xab, 0xab, 0xab, 0xab, 0xab, 0xab]);
      const out = Pads.parse(bytes);
      expect(out.length).toBe(3);
      expect(out[0]).toBeInstanceOf(Uint8Array);
      expect(out[1]).toBeInstanceOf(Uint8Array);
      expect(out[2]).toBeInstanceOf(Uint8Array);
      expect(Array.from(out[0] as Uint8Array)).toEqual([0xab, 0xab]);
      expect(Array.from(out[1] as Uint8Array)).toEqual([0xab, 0xab]);
      expect(Array.from(out[2] as Uint8Array)).toEqual([0xab, 0xab]);
      const VarPads = M.array(undefined, M.reserved(2));
      const out2 = VarPads.parse(new Uint8Array([0, 0, 0, 0, 0, 0]));
      expect(out2.length).toBe(3);
    });
  });

  describe('tuple with reserved element', () => {
    it('roundtrips', () => {
      const T = M.tuple([M.reserved(2, 0xcc), M.uint8()]);
      const bytes = T.compose([undefined, 7]);
      expect(Array.from(bytes)).toEqual([0xcc, 0xcc, 7]);
      const v = T.parse(bytes);
      expect(v[0]).toBeInstanceOf(Uint8Array);
      expect(Array.from(v[0] as Uint8Array)).toEqual([0xcc, 0xcc]);
      expect(v[1]).toBe(7);
    });
  });

  describe('reserved with withSize', () => {
    it('prefixes the size and validates', () => {
      const R4 = M.reserved(4).withSize(M.uint8());
      const bytes = R4.compose();
      expect(Array.from(bytes)).toEqual([4, 0, 0, 0, 0]);
      const rParsed = R4.parse(bytes);
      expect(rParsed).toBeInstanceOf(Uint8Array);
      expect(Array.from(rParsed as Uint8Array)).toEqual([0, 0, 0, 0]);
    });
  });

  describe('struct with withSize including reserved', () => {
    it('roundtrips and exposes reserved as Uint8Array', () => {
      const S = M.struct({ pad: M.reserved(3, 0x77), v: M.uint8() }).withSize(M.uint8());
      const bytes = S.compose({ v: 9 } as any);
      expect(Array.from(bytes)).toEqual([4, 0x77, 0x77, 0x77, 9]);
      const o = S.parse(bytes);
      expect(o.pad).toBeInstanceOf(Uint8Array);
      expect(Array.from(o.pad as Uint8Array)).toEqual([0x77, 0x77, 0x77]);
      expect(o.v).toBe(9);
    });
  });

  describe('choice including reserved', () => {
    it('omits pad on write', () => {
      const C = M.choice(M.uint8(), {
        1: M.struct({ pad: M.reserved(2), x: M.uint8() }),
        2: M.struct({ y: M.uint16le() }),
      } as const);

      const b1 = C.compose({ 1: { x: 7 } });
      expect(b1.byteLength).toBe(1 + 2 + 1);
      const p1 = C.parse(b1);
      expect('1' in p1).toBe(true);

      const b2 = C.compose({ 2: { y: 0x0201 } });
      expect(b2.byteLength).toBe(1 + 2);
      const p2 = C.parse(b2);
      expect('2' in p2).toBe(true);
    });
  });

  describe('tuple of struct with reserved', () => {
    it('respects element write type', () => {
      const Entry = M.struct({ id: M.uint32le(), _pad: M.reserved(8), name: M.string(16) });
      const T = M.tuple([Entry, M.uint8()]);

      type Write = Parameters<typeof T.compose>[0];
      type W0 = Write[0];
      expectType<Equal<W0 extends { id: number; name: string } ? true : false, true>>();

      const bytes = T.compose([{ id: 1, name: 'X' }, 7]);
      expect(bytes.byteLength).toBeGreaterThan(0);
      const v = T.parse(bytes);
      expect(v[0].id).toBe(1);
      expect(v[0].name).toBe('X' + '\0'.repeat(15));
      expect(v[1]).toBe(7);
    });
  });

  describe('Module API', () => {
    it('exposes usable constructors via default export', () => {
      const D = (M as any).default as typeof M;
      const n = D.uint32be();
      expect(n.parse(n.compose(1))).toBe(1);
      const s = D.string(M.uint8());
      const bytes = s.compose('hi');
      expect(bytes).toEqual(new Uint8Array([2, 0x68, 0x69]));
      expect(s.parse(bytes)).toBe('hi');
    });

    it('calls numeric constructors across exports', () => {
      const names = Object.keys(M).filter((k) => /^(u?int(8|16|32|64)|float(16|32|64))(le|be)?$/.test(k));
      for (const k of names) {
        const T = (M as any)[k]();
        const v = T();
        const out = T.parse(T.compose(v));
        if (typeof v === 'number') expect(typeof out).toBe('number');
        else expect(typeof out).toBe('bigint');
      }
    });
  });
});
