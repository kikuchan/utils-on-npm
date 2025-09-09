export type BinaryLike = Uint8Array | Uint8ClampedArray | ArrayBufferLike | DataView;

function hex(v: number, c: number) {
  return Number(v).toString(16).padStart(c, '0');
}

type Context =
  | {
      type: 'hex-value' | 'hex-value-prefix' | 'hex-value-suffix' | 'character-value';
      address: number;
      value: number;
    }
  | {
      type: 'address';
      address: number;
    }
  | {
      type:
        | 'line-prefix'
        | 'address-prefix'
        | 'address-suffix'
        | 'hex-dump-prefix'
        | 'hex-group-prefix'
        | 'hex-value-no-data'
        | 'character-value-no-data'
        | 'hex-gap'
        | 'hex-group-gap'
        | 'hex-group-suffix'
        | 'hex-dump-suffix'
        | 'character-prefix'
        | 'character-suffix'
        | 'line-suffix'
        | 'flush';
    };

type ColorizerOperation = { enter: string; leave: string; escape?: (s: string) => string } | null;

type Colorizer =
  | boolean
  | undefined
  | 'simple'
  | 'html'
  | ((s: string, ctx: Context) => ColorizerOperation | undefined);
type Formatter = undefined | ((s: string, ctx: Context) => string | undefined);

type Options = {
  addrOffset?: number;
  addrLength?: number;
  printer?: null | ((s: string) => void) /* for each line */;
  formatter?: Formatter /* for each item */;
  color?: Colorizer;
  prefix?: string;
  printChars?: boolean;
  foldSize?: number;
  footer?: boolean;
};

interface Hexdumper {
  (buf: BinaryLike, options?: Options): string;
  (buf: BinaryLike, len: number, options?: Options): string;
}

interface Hexdump extends Hexdumper {
  log: Hexdumper;
  warn: Hexdumper;
  error: Hexdumper;
  string: Hexdumper;

  create: (printer: (s: string) => void) => Hexdumper;
}

const identity = <T>(s: T) => s;

const htmlEscaper = (s: string) =>
  s.replace(
    /[&<>]/g,
    (x) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
      })[x]!,
  );

const simpleColorizer = {
  simple: {
    address: { enter: '\x1b[38;5;238m', leave: '\x1b[m' },
    separator: { enter: '\x1b[38;5;238m', leave: '\x1b[m' },
    control: { enter: '\x1b[38;5;178m', leave: '\x1b[m' },
    ascii: { enter: '\x1b[m', leave: '\x1b[m' },
    exascii: { enter: '\x1b[38;5;209m', leave: '\x1b[m' },
    null: { enter: '\x1b[38;5;244m', leave: '\x1b[m' },
    normal: null,
  },
  html: {
    address: { enter: '<span class="hexdump-address">', leave: '</span>', escape: htmlEscaper },
    separator: { enter: '<span class="hexdump-separator">', leave: '</span>', escape: htmlEscaper },
    control: { enter: '<span class="hexdump-control">', leave: '</span>', escape: htmlEscaper },
    ascii: { enter: '<span class="hexdump-ascii">', leave: '</span>', escape: htmlEscaper },
    exascii: { enter: '<span class="hexdump-exascii">', leave: '</span>', escape: htmlEscaper },
    null: { enter: '<span class="hexdump-null">', leave: '</span>', escape: htmlEscaper },
    normal: { enter: '', leave: '', escape: htmlEscaper },
  },
} as Record<
  string,
  {
    address?: ColorizerOperation;
    separator?: ColorizerOperation;
    control?: ColorizerOperation;
    ascii?: ColorizerOperation;
    exascii?: ColorizerOperation;
    null?: ColorizerOperation;
    normal: ColorizerOperation;
  }
>;

const create_colorizer = (colorizer: Colorizer) => {
  let lastColor: ColorizerOperation | undefined = undefined;

  if (!colorizer) return identity;
  if (colorizer === true) colorizer = 'simple';

  if (typeof colorizer === 'string') {
    const defs = simpleColorizer[colorizer];
    const separators = ['address-prefix', 'address-suffix', 'character-prefix', 'character-suffix'];

    colorizer = function (s, ctx) {
      if (!s.trim()) return undefined; // keep the last color context on empty

      if (defs.address && ctx.type === 'address') return defs.address;
      if (defs.separator && separators.includes(ctx.type)) return defs.separator;

      if ((ctx.type === 'hex-value' || ctx.type === 'character-value') && typeof ctx.value === 'number') {
        if (defs.null !== undefined && ctx.value === 0) return defs.null;
        if (defs.control !== undefined && ctx.value < 0x20) return defs.control;
        if (defs.ascii !== undefined && 0x20 <= ctx.value && ctx.value < 0x7f) return defs.ascii;
        if (defs.exascii !== undefined && 0x80 <= ctx.value && ctx.value <= 0xff) return defs.exascii;
      }

      return defs.normal;
    };
  }

  return (s: string, ctx: Context) => {
    const color = ctx.type === 'flush' ? null : colorizer(s, ctx);

    // If color changes, emit leave/enter tokens and escape content.
    if (
      color !== undefined &&
      (lastColor?.enter !== color?.enter || lastColor?.leave !== color?.leave || lastColor?.escape !== color?.escape)
    ) {
      s = (lastColor?.leave || '') + (color?.enter || '') + (color?.escape || identity)(s);
      lastColor = color;
      return s;
    }

    // If color stays the same and provides an escaper, still escape content.
    if (color && color.escape) {
      return color.escape(s);
    }

    return s;
  };
};

const create_formatter = (formatter: Formatter) => {
  if (!formatter) formatter = identity;

  return (s: string, ctx: Context) => {
    return formatter(s, ctx) || '';
  };
};

function create_hexdumper(printer: ((s: string) => void) | null): Hexdumper {
  return (buf: BinaryLike, len?: number | Options, options?: Options) => {
    const u8 = ArrayBuffer.isView(buf)
      ? new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
      : new Uint8Array(buf);
    if (typeof len !== 'number') {
      options = len;
      len = u8.length;
    }
    options = { ...(options ?? {}) };
    if (len === undefined || len < 0) len = u8.length;

    printer = options.printer === null ? null : (options.printer ?? printer);
    const formatter = create_formatter(options.formatter);
    const colorize = create_colorizer(options.color);

    const foldSize = options.foldSize || 16;
    const printChars = options.printChars !== false;

    let address = options.addrOffset || 0;
    const offset = address % foldSize;
    const rows = (len ? Math.ceil(((offset % foldSize) + len) / foldSize) : 0) + (options.footer !== false ? 1 : 0);

    const result: string[] = [];
    let line = '';
    const print = function (s: string, ctx: Context) {
      line += colorize(formatter(s, ctx), ctx);
    };

    const prefix = options?.prefix || '';
    const addrLength = Math.max(options?.addrLength ?? 8 - prefix.length, 0);

    for (let i = 0; i < rows; i++) {
      const addressBase = address;

      print('', { type: 'line-prefix' });
      print(prefix, { type: 'address-prefix' });
      if (addrLength >= 1) print(hex(address, addrLength), { type: 'address', address });
      print(': ', { type: 'address-suffix' });

      print(' ', { type: 'hex-dump-prefix' });
      print('', { type: 'hex-group-prefix' });
      for (let j = 0; j < foldSize; j++) {
        const idx = i * foldSize + j - offset;
        if (j && j % 8 == 0) {
          print('', { type: 'hex-group-suffix' });
          print('  ', { type: 'hex-group-gap' });
          print('', { type: 'hex-group-prefix' });
        } else if (j) {
          print(' ', { type: 'hex-gap' });
        }

        if (0 <= idx && idx < len) {
          print('', { type: 'hex-value-prefix', address, value: u8[idx] });
          print(hex(u8[idx], 2), { type: 'hex-value', address, value: u8[idx] });
          print('', { type: 'hex-value-suffix', address, value: u8[idx] });
          address++;
        } else {
          print('  ', { type: 'hex-value-no-data' });
        }
      }
      print('', { type: 'hex-group-suffix' });
      print(' ', { type: 'hex-dump-suffix' });

      if (printChars) {
        let address = addressBase;
        print(' |', { type: 'character-prefix' });
        for (let j = 0; j < foldSize; j++) {
          const idx = i * foldSize + j - offset;

          if (0 <= idx && idx < len) {
            print(u8[idx] >= 0x20 && u8[idx] < 0x7f ? String.fromCharCode(u8[idx]) : '.', {
              type: 'character-value',
              address,
              value: u8[idx],
            });
            address++;
          } else {
            print(' ', { type: 'character-value-no-data' });
          }
        }
        print('|', { type: 'character-suffix' });
      }
      print('', { type: 'line-suffix' });
      print('', { type: 'flush' });

      printer?.(line);
      result.push(line);
      line = '';
    }
    return result.join('\n');
  };
}

export const hexdump: Hexdump = Object.assign(create_hexdumper(null), {
  create: create_hexdumper,

  log: create_hexdumper((s) => console.log(s)),
  warn: create_hexdumper((s) => console.warn(s)),
  error: create_hexdumper((s) => console.error(s)),

  string: create_hexdumper(null),
});

export default hexdump;
