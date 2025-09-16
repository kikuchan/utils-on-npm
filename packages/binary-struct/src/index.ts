/* eslint-disable @typescript-eslint/no-explicit-any */
import { BinaryReader } from '@kikuchan/binary-reader';
import { BinaryWriter } from '@kikuchan/binary-writer';

export type BinaryLike = Uint8Array | Uint8ClampedArray | ArrayBufferLike | DataView;

export type Type<T, W = T, S = W> = {
  (init?: S): T;
  read(r: BinaryReader): T;
  write(w: BinaryWriter, data: W): void;
  parse(buffer: BinaryLike): T;
  compose(): Uint8Array;
  compose(data: W): Uint8Array;

  tag(s: string): Type<T, W, S>;
  ref(s: string): Type<T, W, S>;
  withSize(t: Type<number, number, number>): Type<T, W, S>;
};

type TypeDef<T, W = T, S = W> = {
  init: (seed?: S) => T;
  read: (r: BinaryReader) => T;
  write: (w: BinaryWriter, data: W) => void;
};

type FindAssoc<A extends readonly unknown[], K extends string> = A extends readonly [K, infer V] ? V : never;
type ExtractTypeValue<V> = V extends Type<infer X, any, any> ? X : never;
type ExtractTypeValueMap<V> = V extends readonly [Type<infer X, any, any>, ...infer Y]
  ? [X, ...ExtractTypeValueMap<Y>]
  : [];
type ExtractWriteValue<V> = V extends Type<any, infer W, any> ? W : never;
type ExtractSeedValue<V> = V extends Type<any, any, infer S> ? S : never;
type ExtractWriteValueMap<V> = V extends readonly [Type<any, infer W, any>, ...infer R]
  ? [W, ...ExtractWriteValueMap<R extends readonly Type<any, any, any>[] ? R : never>]
  : [];
type ExtractSeedValueMap<V> = V extends readonly [Type<any, any, infer S>, ...infer R]
  ? [S, ...ExtractSeedValueMap<R extends readonly Type<any, any, any>[] ? R : never>]
  : [];

type StructObject<T> =
  T extends Record<string, Type<any, any, any>>
    ? { -readonly [k in keyof T]: ExtractTypeValue<T[k]> }
    : T extends [string, Type<any, any, any>][]
      ? { -readonly [k in T[number][0]]: ExtractTypeValue<FindAssoc<T[number], k>> }
      : never;

// IsExactlyUnknown<T> -> true when T is exactly unknown
type IsUnknown<T> = unknown extends T ? ([T] extends [unknown] ? true : false) : false;
type RelaxArrayWrite<W> = W extends any[] ? W | Readonly<W> : W;
type ReqValue<W> = Exclude<W, undefined>;

// Compute write type: required for all fields except those whose write type is `undefined`.
type RecordWrite<R extends Record<string, Type<any, any, any>>> = {
  [K in keyof R as IsUnknown<ExtractWriteValue<R[K]>> extends true
    ? never
    : ExtractWriteValue<R[K]> extends undefined
      ? never
      : K & string]: RelaxArrayWrite<ReqValue<ExtractWriteValue<R[K]>>>;
} & {
  [K in keyof R as IsUnknown<ExtractWriteValue<R[K]>> extends true
    ? K & string
    : ExtractWriteValue<R[K]> extends undefined
      ? K & string
      : never]?: RelaxArrayWrite<ExtractWriteValue<R[K]>>;
};

type TupleDefs<A extends [string, Type<any, any, any>][]> = A[number];
type TupleReq<A extends [string, Type<any, any, any>][]> = {
  [E in TupleDefs<A> as IsUnknown<ExtractWriteValue<E[1]>> extends true
    ? never
    : ExtractWriteValue<E[1]> extends undefined
      ? never
      : E[0]]: ReqValue<ExtractWriteValue<E[1]>>;
};
type TupleOpt<A extends [string, Type<any, any, any>][]> = {
  [E in TupleDefs<A> as IsUnknown<ExtractWriteValue<E[1]>> extends true
    ? E[0]
    : ExtractWriteValue<E[1]> extends undefined
      ? E[0]
      : never]?: ExtractWriteValue<E[1]>;
};
type TupleWrite<A extends [string, Type<any, any, any>][]> = TupleReq<A> & TupleOpt<A>;

type StructWrite<T> =
  T extends Record<string, Type<any, any, any>>
    ? RecordWrite<T>
    : T extends [string, Type<any, any, any>][]
      ? TupleWrite<T>
      : never;

type StructSeed<T> =
  T extends Record<string, Type<any, any, any>>
    ? { [K in keyof T]?: ExtractSeedValue<T[K]> }
    : T extends [string, Type<any, any, any>][]
      ? { [E in TupleDefs<T> as E[0]]?: ExtractSeedValue<E[1]> }
      : never;

export function defineType<T, W = T, S = W, A extends readonly unknown[] = readonly unknown[]>(
  def: (...args: A) => TypeDef<T, W, S>,
): (...args: A) => Type<T, W, S> {
  return function (...args: A) {
    const { init, read, write } = def(...args);

    type Hooks = {
      preR: ((r: BinaryReader) => void)[];
      postR: ((r: BinaryReader) => void)[];
      preW: ((w: BinaryWriter, d: W) => void)[];
      postW: ((w: BinaryWriter, d: W) => void)[];
    };

    const makeType = (h?: Hooks, p: Partial<Hooks> = {}): Type<T, W, S> => {
      h = {
        preR: [...(h?.preR ?? []), ...(p.preR ?? [])],
        postR: [...(h?.postR ?? []), ...(p.postR ?? [])],
        preW: [...(h?.preW ?? []), ...(p.preW ?? [])],
        postW: [...(h?.postW ?? []), ...(p.postW ?? [])],
      };

      const t = ((seed?: S) => init(seed)) as Type<T, W, S>;
      t.read = (r) => {
        h.preR.forEach((f) => f(r));
        const v = read(r);
        h.postR.forEach((f) => f(r));
        return v;
      };
      t.write = (w, d) => {
        h.preW.forEach((f) => f(w, d));
        write(w, d);
        h.postW.forEach((f) => f(w, d));
      };
      t.compose = (...args: any[]) => {
        const w = new BinaryWriter();
        const obj = (args.length ? args[0] : undefined) as W;
        t.write(w, obj as W);
        return new Uint8Array(w.buffer);
      };
      t.parse = (buffer: BinaryLike) => {
        const r = new BinaryReader(buffer);
        return t.read(r);
      };

      t.tag = (s) => {
        return makeType(h, {
          preR: [(r) => r.bookmark(s)],
          preW: [(w) => w.bookmark(s)],
        });
      };

      t.ref = (s) => {
        let backupR = 0;
        let backupW = 0;
        return makeType(h, {
          preR: [
            (r) => {
              backupR = r.position;
              r.seek(s);
            },
          ],
          preW: [
            (w) => {
              backupW = w.position;
              w.seek(s);
            },
          ],
          postR: [(r) => r.seek(backupR)],
          postW: [(w) => w.seek(backupW)],
        });
      };

      t.withSize = (len) => {
        let start = 0;
        let backup = 0;
        let size = 0;
        return makeType(h, {
          preR: [
            (r) => {
              size = len.read(r);
              start = r.position;
            },
          ],
          postR: [
            (r) => {
              if (start + size !== r.position) {
                throw new Error('withSize: size mismatch');
              }
            },
          ],
          preW: [
            (w) => {
              backup = w.position;
              len.write(w, 0);
              start = w.position;
            },
          ],
          postW: [
            (w) => {
              const curr = w.position;
              const size = curr - start;
              w.seek(backup);
              len.write(w, size);
              w.seek(curr);
            },
          ],
        });
      };

      return t;
    };

    return makeType();
  };
}

type StructDef = [string, Type<any, any, any>][] | Record<string, Type<any, any, any>>;

export const struct = defineType(
  <const D extends StructDef>(defs_: D): TypeDef<StructObject<D>, StructWrite<D>, Partial<StructSeed<D>>> => {
    const defs = (Array.isArray(defs_) ? defs_ : Object.entries(defs_)) as D & [string, Type<any, any>][];

    return {
      init: (seed?: Partial<StructSeed<D>>) =>
        Object.fromEntries(
          defs.map(([key, data]) => [key, (data as Type<any, any, any>)(seed?.[key as keyof StructSeed<D>])]),
        ),
      read: (r) => Object.fromEntries(defs.map(([key, data]) => [key, data.read(r)])),
      write: (w, o) => defs.forEach(([key, data]) => (data as Type<any, any>).write(w, (o as any)[key])),
    } as TypeDef<StructObject<D>, StructWrite<D>, Partial<StructSeed<D>>>;
  },
);

export const uint8 = defineType(() => ({
  init: (v?: number) => (typeof v === 'number' ? v : 0),
  read: (r) => r.readUint8(),
  write: (w, v) => w.writeUint8(v),
}));
export const int8 = defineType(() => ({
  init: (v?: number) => (typeof v === 'number' ? v : 0),
  read: (r) => r.readInt8(),
  write: (w, v) => w.writeInt8(v),
}));

export const uint16 = defineType((le?: boolean) => ({
  init: (v?: number) => (typeof v === 'number' ? v : 0),
  read: (r) => r.readUint16(le),
  write: (w, v) => w.writeUint16(v, le),
}));
export const uint32 = defineType((le?: boolean) => ({
  init: (v?: number) => (typeof v === 'number' ? v : 0),
  read: (r) => r.readUint32(le),
  write: (w, v) => w.writeUint32(v, le),
}));
export const uint64 = defineType((le?: boolean) => ({
  init: (v?: bigint) => (typeof v === 'bigint' ? v : 0n),
  read: (r) => r.readUint64(le),
  write: (w, v) => w.writeUint64(v, le),
}));
export const int16 = defineType((le?: boolean) => ({
  init: (v?: number) => (typeof v === 'number' ? v : 0),
  read: (r) => r.readInt16(le),
  write: (w, v) => w.writeInt16(v, le),
}));
export const int32 = defineType((le?: boolean) => ({
  init: (v?: number) => (typeof v === 'number' ? v : 0),
  read: (r) => r.readInt32(le),
  write: (w, v) => w.writeInt32(v, le),
}));
export const int64 = defineType((le?: boolean) => ({
  init: (v?: bigint) => (typeof v === 'bigint' ? v : 0n),
  read: (r) => r.readInt64(le),
  write: (w, v) => w.writeInt64(v, le),
}));
export const float16 = defineType((le?: boolean) => ({
  init: (v?: number) => (typeof v === 'number' ? v : 0),
  read: (r) => r.readFloat16(le),
  write: (w, v) => w.writeFloat16(v, le),
}));
export const float32 = defineType((le?: boolean) => ({
  init: (v?: number) => (typeof v === 'number' ? v : 0),
  read: (r) => r.readFloat32(le),
  write: (w, v) => w.writeFloat32(v, le),
}));
export const float64 = defineType((le?: boolean) => ({
  init: (v?: number) => (typeof v === 'number' ? v : 0),
  read: (r) => r.readFloat64(le),
  write: (w, v) => w.writeFloat64(v, le),
}));

export const uint16le = () => uint16(true);
export const uint32le = () => uint32(true);
export const uint64le = () => uint64(true);
export const int16le = () => int16(true);
export const int32le = () => int32(true);
export const int64le = () => int64(true);
export const float16le = () => float16(true);
export const float32le = () => float32(true);
export const float64le = () => float64(true);

export const uint16be = () => uint16(false);
export const uint32be = () => uint32(false);
export const uint64be = () => uint64(false);
export const int16be = () => int16(false);
export const int32be = () => int32(false);
export const int64be = () => int64(false);
export const float16be = () => float16(false);
export const float32be = () => float32(false);
export const float64be = () => float64(false);

function readLength<T extends number | Type<number> | undefined>(
  r: BinaryReader,
  n: T,
): T extends undefined ? undefined : number {
  if (n === undefined) return undefined as any;
  if (typeof n === 'number') return n as any;
  const len = (n as Type<number>).read(r);
  if (typeof len !== 'number') throw new Error('readLength: invalid size specifier');
  return len as any;
}

function writeLength(w: BinaryWriter, n: number | Type<number> | undefined, v: number) {
  if (typeof n === 'function') n.write(w, v);
}

type TypedArray =
  | Uint8Array
  | Uint8ClampedArray
  | Uint16Array
  | Uint32Array
  | BigUint64Array
  | Int8Array
  | Int16Array
  | Int32Array
  | BigInt64Array
  | Float16Array
  | Float32Array
  | Float64Array;

function writeCollection<T, E>(
  w: BinaryWriter,
  n: number | Type<number> | undefined,
  v: ArrayLike<T> | TypedArray,
  type: Type<E>,
) {
  if (typeof n === 'number') {
    const def = type();
    for (let i = 0; i < n; i++) {
      const value = i < v.length ? v[i] : def;
      type.write(w, value as E);
    }
  } else {
    writeLength(w, n, v.length);
    for (let i = 0; i < v.length; i++) type.write(w, v[i] as E);
  }
}

function* arrayReader<T>(r: BinaryReader, n: number | Type<number> | undefined, type: Type<T>) {
  n = readLength(r, n);
  while (!r.eof() && (n === undefined || n-- > 0)) {
    yield type.read(r);
  }
}

export const array = defineType(<T, W = T, S = W>(n: number | Type<number> | undefined, type: Type<T, W, S>) => {
  return {
    init: (seed?: S[]): T[] => {
      if (typeof n === 'number') return [...new Array(n)].map((_, i) => (type as Type<T, W, S>)(seed?.[i]));
      if (seed && typeof (seed as any).length === 'number')
        return [...Array.from(seed as S[])].map((v) => (type as Type<T, W, S>)(v));
      return [];
    },
    read: (r: BinaryReader) => Array.from(arrayReader(r, n, type as unknown as Type<T>)),
    write: (w: BinaryWriter, v: W[]) =>
      writeCollection(w, n, v as unknown as ArrayLike<unknown>, type as unknown as Type<any>),
  } as TypeDef<T[], W[], S[]>;
});

export const typedArray = defineType(
  <T extends TypedArray, N extends number | bigint>(
    n: number | Type<number> | undefined,
    type: Type<N>,
    ctor: new (a: N[] | number) => T,
  ) => {
    return {
      init: (seed?: ArrayLike<N> | TypedArray): T => {
        if (typeof n === 'number') {
          // Build from per-element seeds or defaults
          const vals = [...new Array(n)].map((_, i) => type(seed?.[i] as N));
          return new ctor(vals as N[]);
        }
        if (seed && typeof seed.length === 'number') return new ctor(seed as N[]);
        return new ctor([]);
      },
      read: (r: BinaryReader) => new ctor([...arrayReader(r, n, type)]),
      write: (w: BinaryWriter, v: T) => writeCollection(w, n, v, type),
    };
  },
);

export const defineArrayType =
  <T, const A extends unknown[], W = T, S = W>(type: (...args: A) => Type<T, W, S>) =>
  (n?: number | Type<number>, ...args: A) =>
    array(n, type(...args));

export const defineTypedArrayType =
  <N extends number | bigint, const A extends unknown[]>(type: (...args: A) => Type<N>) =>
  <T extends TypedArray>(ctor: new (a: N[] | number) => T) =>
  (n?: number | Type<number>, ...args: A) =>
    typedArray(n, type(...args), ctor);

export const uint8array = defineTypedArrayType(uint8)<Uint8Array>(Uint8Array);
export const int8array = defineTypedArrayType(int8)<Int8Array>(Int8Array);

export const uint16array = defineTypedArrayType(uint16)<Uint16Array>(Uint16Array);
export const uint32array = defineTypedArrayType(uint32)<Uint32Array>(Uint32Array);
export const uint64array = defineTypedArrayType(uint64)<BigUint64Array>(BigUint64Array);
export const int16array = defineTypedArrayType(int16)<Int16Array>(Int16Array);
export const int32array = defineTypedArrayType(int32)<Int32Array>(Int32Array);
export const int64array = defineTypedArrayType(int64)<BigInt64Array>(BigInt64Array);
export const float16array = defineTypedArrayType(float16)<Float16Array>(Float16Array);
export const float32array = defineTypedArrayType(float32)<Float32Array>(Float32Array);
export const float64array = defineTypedArrayType(float64)<Float64Array>(Float64Array);

export const uint16learray = defineTypedArrayType(uint16le)<Uint16Array>(Uint16Array);
export const uint32learray = defineTypedArrayType(uint32le)<Uint32Array>(Uint32Array);
export const uint64learray = defineTypedArrayType(uint64le)<BigUint64Array>(BigUint64Array);
export const int16learray = defineTypedArrayType(int16le)<Int16Array>(Int16Array);
export const int32learray = defineTypedArrayType(int32le)<Int32Array>(Int32Array);
export const int64learray = defineTypedArrayType(int64le)<BigInt64Array>(BigInt64Array);
export const float16learray = defineTypedArrayType(float16le)<Float16Array>(Float16Array);
export const float32learray = defineTypedArrayType(float32le)<Float32Array>(Float32Array);
export const float64learray = defineTypedArrayType(float64le)<Float64Array>(Float64Array);

export const uint16bearray = defineTypedArrayType(uint16be)<Uint16Array>(Uint16Array);
export const uint32bearray = defineTypedArrayType(uint32be)<Uint32Array>(Uint32Array);
export const uint64bearray = defineTypedArrayType(uint64be)<BigUint64Array>(BigUint64Array);
export const int16bearray = defineTypedArrayType(int16be)<Int16Array>(Int16Array);
export const int32bearray = defineTypedArrayType(int32be)<Int32Array>(Int32Array);
export const int64bearray = defineTypedArrayType(int64be)<BigInt64Array>(BigInt64Array);
export const float16bearray = defineTypedArrayType(float16be)<Float16Array>(Float16Array);
export const float32bearray = defineTypedArrayType(float32be)<Float32Array>(Float32Array);
export const float64bearray = defineTypedArrayType(float64be)<Float64Array>(Float64Array);

export type StringCodec = {
  encode: (s: string) => Uint8Array;
  encodeInto: (s: string, u8: Uint8Array) => void;
  decode: (u8: Uint8Array) => string;
};

export const string = defineType((n?: number | Type<number>, codec?: StringCodec) => {
  return {
    init: (v?: string) => (typeof v === 'string' ? v : ''),
    read: (r: BinaryReader) => {
      let l: number | undefined = undefined;
      if (typeof n === 'number') l = n;
      else if (typeof n === 'function') {
        const v = (n as Type<number>).read(r);
        if (typeof v !== 'number') throw new Error('readLength: invalid size specifier');
        l = v;
      }
      const s = r.readString(l, codec?.decode ?? 'utf-8');
      if (s === undefined) {
        throw new Error('string: decode failed or terminator missing');
      }
      return s;
    },
    write: (w: BinaryWriter, str: string | undefined) => {
      w.writeString(str ?? '', {
        cstring: typeof n === 'undefined',
        fixedLength: typeof n === 'number' ? n : undefined,
        encoder: codec,
        callback: (enc) => {
          writeLength(w, n, enc.length);
        },
      });
    },
  };
});

export const cstring = (codec?: StringCodec) => string(undefined, codec);

export const tuple = defineType(
  <const A extends readonly Type<any, any, any>[]>(
    args: A,
  ): TypeDef<ExtractTypeValueMap<A>, ExtractWriteValueMap<A>, ExtractSeedValueMap<A>> => {
    return {
      init: (seed?: ExtractSeedValueMap<A>) =>
        args.map((arg, i) => (arg as Type<unknown, unknown, unknown>)(seed?.[i] as unknown)) as ExtractTypeValueMap<A>,
      read: (r: BinaryReader) => args.map((arg) => arg.read(r)) as ExtractTypeValueMap<A>,
      write: (w: BinaryWriter, d: ExtractWriteValueMap<A>) =>
        args.forEach((arg, i) => (arg as Type<unknown, unknown>).write(w, (d as unknown as unknown[])[i] as unknown)),
    };
  },
);

type EnumerateKeys<T> = T extends Record<string, number> ? keyof T : T extends readonly string[] ? T[number] : never;

export const enumerate = defineType(
  <const T extends Record<string, number> | readonly string[]>(
    mapping: T,
    type: Type<number> = uint8(),
  ): TypeDef<EnumerateKeys<T>> => {
    const kvs = Array.isArray(mapping)
      ? (mapping as readonly string[]).map((k, v) => [k, v] as [string, number])
      : Object.entries(mapping);
    const map = new Map<string, number>(kvs);
    const revMap = new Map<number, string>(kvs.map(([k, v]) => [v, k]));
    return {
      init: (seed?: EnumerateKeys<T>): EnumerateKeys<T> => (seed ?? kvs[0][0]) as EnumerateKeys<T>,
      read: (r: BinaryReader) => {
        const raw = type.read(r);
        const key = revMap.get(raw);
        if (typeof key === 'undefined') {
          throw new Error(`enumerate: unknown value ${raw}`);
        }
        return key as EnumerateKeys<T>;
      },
      write: (w: BinaryWriter, d: EnumerateKeys<T>) => type.write(w, map.get(d as string)!),
    };
  },
);

type ChoiceMap<T extends string | number> = Record<T, Type<any, any>>;
type ChoiceObject<C extends ChoiceMap<string | number>> = Partial<{
  -readonly [K in keyof C]-?: ExtractTypeValue<C[K]>;
}>;
type ChoiceWrite<C extends ChoiceMap<string | number>> = Partial<{
  -readonly [K in keyof C]-?: ExtractWriteValue<C[K]>;
}>;

export const choice = defineType(
  <T extends string | number, const C extends { readonly [K in T]: Type<any, any, any> }>(
    type: Type<any>,
    choices: C,
  ): TypeDef<ChoiceObject<C>, ChoiceWrite<C>> => {
    if (Object.keys(choices).length === 0) throw new Error('choice: invalid definition');
    return {
      init: (seed?: ChoiceObject<C>) => {
        const keys = Object.keys(choices) as (keyof C)[];
        const provided = seed ? keys.filter((k) => k in (seed as object)) : [];
        const key = (provided[0] ?? keys[0]) as keyof C;
        const innerSeed = seed ? (seed as ChoiceObject<C>)[key] : undefined;
        return { [key]: (choices[key] as Type<unknown>)(innerSeed) } as unknown as ChoiceObject<C>;
      },
      read: (r: BinaryReader) => {
        const key = type.read(r) as T;
        const ch = choices[key as keyof C];
        if (!ch) throw new Error(`choice: ${String(key)} not found`);
        const v = (ch as Type<any, any>).read(r) as ExtractTypeValue<C[typeof key]>;
        return { [key]: v } as unknown as ChoiceObject<C>;
      },
      write: (w: BinaryWriter, data: ChoiceWrite<C>) => {
        const found = (Object.keys(choices) as (keyof C)[]).filter((k) => k in data);
        if (found.length !== 1)
          throw new Error(
            found.length === 0 ? 'choice: no valid key present in object' : 'choice: multiple keys present in object',
          );
        const key = found[0]! as T;
        (type as Type<any, any>).write(w, key as any);
        (choices[key] as Type<any, any>).write(w, (data as any)[key]);
      },
    };
  },
);

// Bitfields type inference: 0..50 bits -> number, 51+ bits -> bigint
type SmallBits =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | 23
  | 24
  | 25
  | 26
  | 27
  | 28
  | 29
  | 30
  | 31
  | 32
  | 33
  | 34
  | 35
  | 36
  | 37
  | 38
  | 39
  | 40
  | 41
  | 42
  | 43
  | 44
  | 45
  | 46
  | 47
  | 48
  | 49
  | 50;
type BitFieldValue<N extends number> = N extends SmallBits ? number : bigint;
export type BitfieldsResult<T extends Record<string, number>> = { [K in keyof T]: BitFieldValue<T[K]> };

export const bitfields = defineType(
  <const T extends Record<string, number>>(
    fields: T,
    littleEndian?: boolean,
    lsbFirst?: boolean,
  ): TypeDef<BitfieldsResult<T>> => {
    const entries = Object.entries(fields) as [string, number][];
    const nbits = entries.reduce((acc, [, val]) => acc + Math.floor(val), 0);
    const nbytes = Math.ceil(nbits / 8);

    // Precompute bit shifts, masks, and value kinds per field for simpler loops
    type Meta = { key: string; bits: number; shift: bigint; mask: bigint; isBig: boolean };
    const metas: Meta[] = (() => {
      const out: Meta[] = [];
      let acc = 0; // consumed bits
      for (const [key, bits] of entries) {
        if (bits <= 0 || Math.floor(bits) !== bits) throw new Error('bitfields: invalid bit length specified');
        const shift = BigInt(lsbFirst ? acc : nbits - acc - bits);
        const mask = (1n << BigInt(bits)) - 1n;
        out.push({ key, bits, shift, mask, isBig: bits > 50 });
        acc += bits;
      }
      return out;
    })();

    const init = (seed?: Partial<BitfieldsResult<T>> | BitfieldsResult<T>) =>
      Object.fromEntries(
        metas.map(({ key, isBig }) => [key, seed && seed[key] !== undefined ? seed[key] : isBig ? 0n : 0]),
      ) as BitfieldsResult<T>;

    return {
      init,
      read: (r) => {
        if (r.remain < nbytes) throw new Error('bitfields: insufficient bytes');
        const bytes = r.readBytes(nbytes);

        // Assemble into a single bigint value using a unified index mapping
        let value = 0n;
        for (let i = 0; i < nbytes; i++) {
          const idx = littleEndian ? i : nbytes - 1 - i;
          value |= BigInt(bytes[idx]!) << (BigInt(i) * 8n);
        }
        value &= (1n << BigInt(nbits)) - 1n;

        const result: Record<string, number | bigint> = {};
        for (const { key, shift, mask, isBig } of metas) {
          const part = (value >> shift) & mask;
          result[key] = isBig ? part : Number(part);
        }
        return result as BitfieldsResult<T>;
      },

      write: (w, o) => {
        let v = 0n;
        for (const { key, mask, shift, isBig } of metas) {
          const data = (o as Record<string, number | bigint>)[key];
          if (isBig) {
            if (typeof data !== 'bigint') throw new Error(`bitfields: field ${key} requires bigint`);
            v |= (data & mask) << shift;
          } else {
            if (typeof data !== 'number') throw new Error(`bitfields: field ${key} requires number`);
            v |= (BigInt(data) & mask) << shift;
          }
        }

        const out = new Uint8Array(nbytes);
        for (let i = 0; i < nbytes; i++) {
          const idx = littleEndian ? i : nbytes - 1 - i;
          out[idx] = Number((v >> (BigInt(i) * 8n)) & 0xffn);
        }
        w.writeBytes(out);
      },
    };
  },
);

export const reserved = defineType((n: number, fill: number = 0) => {
  return {
    init: () => undefined,
    read: (r) => {
      return r.readBytes(n);
    },
    write: (w) => {
      w.writeBytes(new Uint8Array(n).fill(fill));
    },
  } as TypeDef<unknown, unknown, unknown>;
});

export default {
  defineType,
  struct,
  uint8,
  int8,
  uint16,
  uint32,
  uint64,
  int16,
  int32,
  int64,
  float16,
  float32,
  float64,
  uint16le,
  uint32le,
  uint64le,
  int16le,
  int32le,
  int64le,
  float16le,
  float32le,
  float64le,
  uint16be,
  uint32be,
  uint64be,
  int16be,
  int32be,
  int64be,
  float16be,
  float32be,
  float64be,
  array,
  typedArray,
  defineArrayType,
  defineTypedArrayType,
  uint8array,
  int8array,
  uint16array,
  uint32array,
  uint64array,
  int16array,
  int32array,
  int64array,
  float16array,
  float32array,
  float64array,
  uint16learray,
  uint32learray,
  uint64learray,
  int16learray,
  int32learray,
  int64learray,
  float16learray,
  float32learray,
  float64learray,
  uint16bearray,
  uint32bearray,
  uint64bearray,
  int16bearray,
  int32bearray,
  int64bearray,
  float16bearray,
  float32bearray,
  float64bearray,
  string,
  cstring,
  tuple,
  enumerate,
  choice,
  bitfields,
  reserved,
};
