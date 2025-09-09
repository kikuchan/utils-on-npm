import { StringReader } from '@kikuchan/string-reader';
import { describe, expect, it } from 'vitest';

describe('StringReader basics', () => {
  it('tracks size, position, remain, eof', () => {
    const r = new StringReader('hello');
    expect(r.size).toBe(5);
    expect(r.position).toBe(0);
    expect(r.remain).toBe(5);
    expect(r.eof()).toBe(false);

    r.read(5);
    expect(r.position).toBe(5);
    expect(r.remain).toBe(0);
    expect(r.eof()).toBe(true);
  });

  it('seek clamps within range', () => {
    const r = new StringReader('abc');
    r.seek(10);
    expect(r.position).toBe(3);
    r.seek(-5);
    expect(r.position).toBe(0);
  });

  it('skip moves by n (default 1) and can go backwards', () => {
    const r = new StringReader('abcd');
    r.skip();
    expect(r.position).toBe(1);
    r.skip(2);
    expect(r.position).toBe(3);
    r.skip(-2);
    expect(r.position).toBe(1);
  });
});

describe('startsWith', () => {
  it('matches string without advancing', () => {
    const r = new StringReader('foobar');
    const m = r.startsWith('foo');
    expect(m).toEqual(['foo']);
    expect(r.position).toBe(0);
  });

  it('matches RegExp at current position only (sticky)', () => {
    const r = new StringReader('abcxyz');
    const m = r.startsWith(/abc/);
    expect(Array.isArray(m)).toBe(true);
    expect(m?.[0]).toBe('abc');
    expect(r.startsWith(/b/)).toBeNull();
    expect(r.position).toBe(0);
  });

  it('respects pre-sticky RegExp (/y flag)', () => {
    const r = new StringReader('abc');
    const m = r.startsWith(/abc/y);
    expect(m?.[0]).toBe('abc');
  });
});

describe('match', () => {
  it('advances on string match and returns array', () => {
    const r = new StringReader('foobar');
    const m = r.match('foo');
    expect(m).toEqual(['foo']);
    expect(r.position).toBe(3);
  });

  it('advances on RegExp match and supports translate', () => {
    const r = new StringReader('hello:42');
    const value = r.match(/hello:(\d+)/, (a) => Number(a[1]));
    expect(value).toBe(42);
    expect(r.position).toBe(8);
  });

  it('returns null on no match and does not advance', () => {
    const r = new StringReader('abc');
    expect(r.match('z')).toBeNull();
    expect(r.position).toBe(0);
  });
});

describe('search', () => {
  it('finds string and advances to end of match', () => {
    const r = new StringReader('xx<id>yy');
    const info = r.search('<id>');
    expect(info).not.toBeNull();
    expect(info!.skipped).toBe('xx');
    expect(info!.matched).toEqual(['<id>']);
    expect(r.position).toBe(6); // after <id>
  });

  it('finds RegExp and can translate result', () => {
    const r = new StringReader('abc=123;def=7;');
    const pair = r.search(/def=(\d+);/, (o) => ({ skipped: o.skipped.length, value: Number(o.matched[1]) }));
    expect(pair).toEqual({ skipped: 8, value: 7 });
    expect(r.position).toBe('abc=123;def=7;'.indexOf('def=7;') + 'def=7;'.length);
  });

  it('returns null when not found and does not advance', () => {
    const r = new StringReader('abc');
    expect(r.search('z')).toBeNull();
    expect(r.position).toBe(0);
  });

  it('guard: returns null when match fails after seek (lookbehind)', () => {
    const r = new StringReader('aX');
    const info = r.search(/(?<=a)X/);
    expect(info).toBeNull();
  });
});

describe('skipUntil', () => {
  it('skips to the beginning of the match and returns true when found', () => {
    const r = new StringReader('before[MATCH]after');
    const ok = r.skipUntil('[MATCH]');
    expect(ok).toBe(true);
    expect(r.position).toBe('before'.length);
  });

  it('returns null when not found and does not advance', () => {
    const r = new StringReader('hello');
    const ok = r.skipUntil('x');
    expect(ok).toBe(false);
    expect(r.position).toBe(0);
  });
});

describe('readUntil', () => {
  it('reads up to but not including match and leaves position at match', () => {
    const r = new StringReader('key=value;rest');
    const read = r.readUntil('=');
    expect(read).toBe('key');
    expect(r.position).toBe('key'.length);
    expect(r.startsWith('=')).toEqual(['=']);
  });

  it('returns null when not found and does not advance', () => {
    const r = new StringReader('data');
    const read = r.readUntil(';');
    expect(read).toBeNull();
    expect(r.position).toBe(0);
  });
});

describe('read', () => {
  it('reads one char by default', () => {
    const r = new StringReader('abc');
    expect(r.read()).toBe('a');
    expect(r.position).toBe(1);
  });

  it('reads n chars and clamps at end', () => {
    const r = new StringReader('abc');
    expect(r.read(5)).toBe('abc');
    expect(r.position).toBe(3);
  });

  it('read(0) throws', () => {
    const r = new StringReader('abcd');
    r.read(1); // leave 3
    expect(() => r.read(0)).toThrow(RangeError);
    expect(r.position).toBe(1);
  });

  it('negative n throws', () => {
    const r = new StringReader('abcdef');
    expect(() => r.read(-2)).toThrow(RangeError);
    expect(r.position).toBe(0);
  });

  it('returns empty string on EOF', () => {
    const r = new StringReader('x');
    r.read(1);
    expect(r.read()).toBe('');
    expect(r.position).toBe(1);
  });
});

describe('startsWith (edge cases)', () => {
  it('returns null at EOF', () => {
    const r = new StringReader('');
    expect(r.startsWith('x')).toBeNull();
    expect(r.startsWith(/x/)).toBeNull();
  });
});

describe('skipUntil (edge cases)', () => {
  it('supports RegExp and leaves position at match start', () => {
    const r = new StringReader('abc123def');
    const ok = r.skipUntil(/\d+/);
    expect(ok).toBe(true);
    expect(r.position).toBe(3);
  });
});
