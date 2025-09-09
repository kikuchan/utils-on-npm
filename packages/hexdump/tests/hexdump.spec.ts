import hexdumpDefault, { hexdump } from '@kikuchan/hexdump';
import { describe, expect, it } from 'vitest';

const u8 = (arr: number[]) => new Uint8Array(arr);

describe('hexdump basics', () => {
  it('prints a basic hexdump', () => {
    const out = hexdump(u8([0x00, 0x20, 0x41, 0x7e, 0x7f, 0x80, 0xff]));
    expect(out).toBe(
      [
        `00000000:  00 20 41 7e 7f 80 ff                              |. A~...         |`,
        `00000007:                                                    |                |`,
      ].join('\n'),
    );
  });

  it('prints a single footer line for empty input', () => {
    const out = hexdump(u8([]), {
      foldSize: 8,
      printChars: false,
      addrLength: 4,
    });
    expect(out).toBe(['0000:                          '].join('\n'));
  });

  it('prints bytes and a footer line', () => {
    const out = hexdump(u8([0x41, 0x42, 0x43]), {
      foldSize: 4,
      printChars: false,
      addrLength: 4,
    });
    expect(out).toBe(['0000:  41 42 43    ', '0003:              '].join('\n'));
  });
});

describe('hexdump printer integration', () => {
  it('invokes custom printer for each line', () => {
    const lines: string[] = [];
    const dump = hexdump.create((s) => lines.push(s));
    const out = dump(new Uint8Array([0x41, 0x42, 0x43]), {
      foldSize: 2,
      printChars: false,
      addrLength: 4,
    });

    const outLines = out.split('\n');
    expect(lines.join('\n')).toBe(out);
    expect(lines.length).toBe(outLines.length);
    expect(lines[0]).toContain('0000:');
    expect(lines[0]).toContain('41 42');
  });
});

describe('hexdump HTML colorizer escaping', () => {
  it('escapes <, >, & in ascii region', () => {
    const out = hexdump(new TextEncoder().encode('<&>'), {
      foldSize: 8,
      printChars: true,
      addrLength: 2,
      color: 'html',
    });
    expect(out).toContain('&lt;');
    expect(out).toContain('&gt;');
    expect(out).toContain('&amp;');
  });
});

describe('hexdump hex value prefix/suffix', () => {
  it('wraps each hex byte with custom markers', () => {
    const bytes = new Uint8Array([0x41, 0x42]);
    const out = hexdump(bytes, {
      foldSize: 2,
      printChars: false,
      addrLength: 2,
      color: (_s, ctx) => {
        if (ctx.type === 'hex-value-prefix') return { enter: '{', leave: '' };
        if (ctx.type === 'hex-value-suffix') return { enter: '', leave: '}' };
        return undefined;
      },
    });
    const firstLine = out.split('\n')[0] || '';
    const opens = (firstLine.match(/\{/g) || []).length;
    const closes = (firstLine.match(/\}/g) || []).length;
    expect(opens).toBe(2);
    expect(closes).toBe(2);
    expect(firstLine).toContain('{41');
    expect(firstLine).toContain('{42');
  });
});

describe('hexdump flush handling', () => {
  it('appends leave token at end of line on flush', () => {
    const out = hexdump(new Uint8Array([0x00]), {
      foldSize: 1,
      printChars: false,
      addrLength: 2,
      color: (_s, ctx) => {
        if (ctx.type === 'line-prefix') return { enter: '<', leave: '>' };
        return undefined;
      },
    });
    const first = out.split('\n')[0] || '';
    expect(first.endsWith('>')).toBe(true);
  });
});

describe('hexdump options', () => {
  it('respects addrOffset and computes footer address', () => {
    const out = hexdump(u8([0xaa, 0xbb]), {
      addrOffset: 1,
      foldSize: 4,
      printChars: false,
      addrLength: 4,
    });
    expect(out).toBe(['0001:     aa bb    ', '0003:              '].join('\n'));
  });

  it('applies a custom formatter to hex values', () => {
    const out = hexdump(u8([0x00, 0x20, 0x41]), {
      foldSize: 4,
      printChars: false,
      addrLength: 4,
      formatter: (s, ctx) => (ctx.type === 'hex-value' ? `[${s}]` : s),
    });
    expect(out).toBe(['0000:  [00] [20] [41]    ', '0003:              '].join('\n'));
  });

  it("adds ANSI codes when color is 'simple'", () => {
    const out = hexdump(u8([0x00]), {
      foldSize: 1,
      printChars: false,
      addrLength: 2,
      color: 'simple',
    });

    expect(/\x1b\[[0-9;]*m/.test(out)).toBe(true);
  });

  it("applies 'control' color for <0x20 (simple)", () => {
    const out = hexdump(u8([0x01]), {
      foldSize: 1,
      printChars: false,
      addrLength: 2,
      color: 'simple',
    });
    expect(/\x1b\[38;5;178m/.test(out)).toBe(true);
  });

  it("escapes ASCII with color:'html' and emits span", () => {
    const out = hexdump(u8([0x3c, 0x20]), {
      foldSize: 2,
      printChars: true,
      addrLength: 2,
      color: 'html',
    });
    expect(out).toContain('hexdump-ascii');
    expect(out).toContain('&lt;');
  });

  it("assigns exascii class for >=0x80 with color:'html'", () => {
    const out = hexdump(u8([0x80]), {
      foldSize: 1,
      printChars: true,
      addrLength: 2,
      color: 'html',
    });
    expect(out).toContain('hexdump-exascii');
  });

  it("uses 'normal' branch for DEL (0x7f) with color:'html'", () => {
    const out = hexdump(u8([0x7f]), {
      foldSize: 1,
      printChars: true,
      addrLength: 2,
      color: 'html',
    });
    expect(out).not.toContain('hexdump-ascii');
    expect(out).not.toContain('hexdump-control');
    expect(out).not.toContain('hexdump-exascii');
  });

  it('respects footer:false (no footer line)', () => {
    const out = hexdump(u8([0x41, 0x42, 0x43]), {
      foldSize: 8,
      printChars: false,
      addrLength: 4,
      footer: false,
    });
    const lines = out.split(/\n/);
    expect(lines.length).toBe(1);
  });

  it('derives addrLength from prefix when not set', () => {
    const out = hexdump(u8([]), {
      foldSize: 8,
      printChars: false,
      prefix: '0x',
    });
    expect(out).toBe(['0x000000:                          '].join('\n'));
  });

  it('clamps addrLength to 0 when prefix is long (address hidden)', () => {
    const out = hexdump(u8([]), {
      foldSize: 8,
      printChars: false,
      prefix: '012345678',
    });
    expect(out).toBe(['012345678:                          '].join('\n'));
  });

  it('color:true behaves like simple (ANSI on)', () => {
    const out = hexdump(u8([0x41]), {
      foldSize: 1,
      printChars: false,
      addrLength: 2,
      color: true,
    });
    expect(/\x1b\[[0-9;]*m/.test(out)).toBe(true);
  });

  it('custom colorizer wraps line with markers and flush closes it', () => {
    const out = hexdump(u8([0x41, 0x42]), {
      foldSize: 2,
      printChars: false,
      addrLength: 2,
      color: (s) => {
        if (!s.trim()) return undefined;
        return { enter: '[', leave: ']' };
      },
    });
    expect(out).toBe(['[00:  41 42 ]', '[02:        ]'].join('\n'));
  });
});

describe('printer callbacks', () => {
  it('calls the printer once per rendered line', () => {
    const lines: string[] = [];
    const dump = hexdump.create((s) => lines.push(s));

    const out = dump(u8([1, 2, 3, 4, 5]), {
      foldSize: 4,
      printChars: false,
      addrLength: 4,
    });

    const split = out.split(/\n/);
    expect(lines.length).toBe(split.length);
    expect(lines[0]).toBe(split[0]);
  });

  it('disables printer when options.printer is null', () => {
    const dump = hexdump.create((s) => {
      throw new Error('should not be called');
    });
    const out = dump(u8([0x41]), { foldSize: 1, printChars: false, addrLength: 2, printer: null });
    expect(out.includes('41')).toBe(true);
  });
});

describe('characters view', () => {
  it('shows ASCII and dots for non-printables', () => {
    const out = hexdump(u8([0x00, 0x41, 0x7f, 0x80]), {
      foldSize: 4,
      printChars: true,
      addrLength: 2,
    });
    expect(out).toBe(['00:  00 41 7f 80  |.A..|', '04:               |    |'].join('\n'));
  });
});

describe('overloads and inputs', () => {
  it('accepts len overload to limit bytes', () => {
    const out = hexdump(u8([0, 1, 2, 3]), 2, {
      foldSize: 8,
      printChars: false,
      addrLength: 4,
    });
    expect(out).toBe(['0000:  00 01                   ', '0002:                          '].join('\n'));
  });

  it('treats negative len as full length', () => {
    const out = hexdump(u8([1, 2, 3]), -1, {
      foldSize: 8,
      printChars: false,
      addrLength: 4,
    });
    expect(out).toBe(['0000:  01 02 03                ', '0003:                          '].join('\n'));
  });

  it('accepts DataView input', () => {
    const arr = u8([0xde, 0xad, 0xbe, 0xef]);
    const view = new DataView(arr.buffer);
    const out = hexdump(view, {
      foldSize: 8,
      printChars: false,
      addrLength: 4,
    });
    expect(out).toBe(['0000:  de ad be ef             ', '0004:                          '].join('\n'));
  });

  it('accepts ArrayBuffer input', () => {
    const arr = u8([0xde, 0xad]);
    const out = hexdump(arr.buffer, {
      foldSize: 8,
      printChars: false,
      addrLength: 4,
    });
    expect(out).toBe(['0000:  de ad                   ', '0002:                          '].join('\n'));
  });
});

describe('grouping and gaps', () => {
  it('inserts a double-space between groups of 8', () => {
    const bytes = Array.from({ length: 10 }, (_, i) => i);
    const out = hexdump(u8(bytes), {
      foldSize: 10,
      printChars: false,
      addrLength: 4,
    });
    expect(out).toBe(['0000:  00 01 02 03 04 05 06 07  08 09 ', '000a:                                 '].join('\n'));
  });
});

describe('predefined printers', () => {
  it('warn printer emits to console and returns string', () => {
    const orig = console.warn;
    const captured: string[] = [];
    console.warn = (s: string) => void captured.push(s);
    try {
      const out = hexdump.warn(u8([0x11, 0x22]), {
        foldSize: 8,
        printChars: false,
        addrLength: 4,
      });
      expect(out).toBe(['0000:  11 22                   ', '0002:                          '].join('\n'));
      expect(captured.length).toBeGreaterThan(0);
      expect(captured[0]).toBe(out.split(/\n/)[0]);
    } finally {
      console.warn = orig;
    }
  });

  it('log printer emits to console.log', () => {
    const orig = console.log;
    const captured: string[] = [];
    console.log = (s: string) => void captured.push(s);
    try {
      const out = hexdump.log(u8([0xaa]), { foldSize: 8, printChars: false, addrLength: 4 });
      expect(out).toBe(['0000:  aa                      ', '0001:                          '].join('\n'));
      expect(captured.length).toBeGreaterThan(0);
      expect(captured[0]).toBe(out.split(/\n/)[0]);
    } finally {
      console.log = orig;
    }
  });

  it('error printer emits to console.error', () => {
    const orig = console.error;
    const captured: string[] = [];
    console.error = (s: string) => void captured.push(s);
    try {
      const out = hexdump.error(u8([0xbb]), { foldSize: 8, printChars: false, addrLength: 4 });
      expect(out).toBe(['0000:  bb                      ', '0001:                          '].join('\n'));
      expect(captured.length).toBeGreaterThan(0);
      expect(captured[0]).toBe(out.split(/\n/)[0]);
    } finally {
      console.error = orig;
    }
  });

  it('string and default produce identical output', () => {
    const buf = u8([0, 1, 2]);
    const opts = { foldSize: 8, printChars: false, addrLength: 4 } as const;
    const a = hexdump(buf, opts);
    const b = hexdump.string(buf, opts);
    expect(a).toBe(b);
  });
});

describe('default export', () => {
  it('exposes hexdump equivalent to named export', () => {
    const buf = u8([0x01, 0x02]);
    const opts = { foldSize: 8, printChars: false, addrLength: 4 } as const;
    const a = hexdump(buf, opts);
    const b = hexdumpDefault(buf, opts);
    expect(a).toBe(b);
  });
});
