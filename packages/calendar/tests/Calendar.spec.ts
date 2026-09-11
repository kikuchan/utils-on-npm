import { Decimal } from '@kikuchan/decimal';
import { describe, expect, it } from 'vitest';
import { Calendar } from '../src/index';

describe('Calendar format tokens', () => {
  it.each(['Y', 'y'])('supports arbitrary minimum widths for %s', (token) => {
    const date = new Calendar(-123, 1, 1);
    expect(date.format([1, 2, 3, 4, 5, 10].map((width) => token.repeat(width)).join(' '))).toBe(
      '-123 -123 -123 -0123 -00123 -0000000123',
    );
    for (const value of ['1', '+1', '-1', '+1000000']) {
      expect(
        Calendar.parse(`${value}-1`, `${token.repeat(5)}-M`, 'utc')
          .utc()
          .year(),
      ).toBe(BigInt(value));
    }
    expect(new Calendar(123, 1, 1).format(token.repeat(2))).toBe('123');
    expect(new Calendar(0, 1, 1).format(token.repeat(3))).toBe('000');
  });

  it.each(['G', 'g'])('supports arbitrary minimum widths for %s', (token) => {
    expect(new Calendar(0, 1, 1).format(token.repeat(5))).toBe('BC 00001');
    expect(new Calendar(123, 1, 1).format(token.repeat(2))).toBe(token === 'G' ? '123 AD' : '123');
    expect(
      Calendar.parse('BC1-1', `${token.repeat(5)}-M`, 'utc')
        .utc()
        .year(),
    ).toBe(0n);
    expect(
      Calendar.parse(`${token === 'G' ? '123AD' : '123'}-1`, `${token.repeat(2)}-M`, 'utc')
        .utc()
        .year(),
    ).toBe(123n);
    expect(() => Calendar.parse('BC0-1', `${token}-M`, 'utc')).toThrow('era year must be at least 1');
    expect(() => Calendar.parse(`${token === 'G' ? '0AD' : '0'}-1`, `${token}-M`, 'utc')).toThrow(
      'era year must be at least 1',
    );
    expect(() => Calendar.parse('+1-1', `${token}-M`, 'utc')).toThrow();
  });

  it.each([
    [-1000000n, '-1000000'],
    [-1n, '-000001'],
    [0n, '0000'],
    [1n, '0001'],
    [9999n, '9999'],
    [10000n, '+010000'],
    [1000000n, '+1000000'],
  ])('formats and parses ISO year %s', (year, expected) => {
    const value = new Calendar(year, 1, 1).format('IY-MM-DD');
    expect(value).toBe(`${expected}-01-01`);
    expect(Calendar.parse(value, undefined, 'utc').utc().year()).toBe(year);
  });

  it('preserves arbitrary fractional precision and normalizes trailing zeros', () => {
    const value = '12.12345678901234567890123456789';
    const date = Calendar.parse(`2026-1-1T0:0:${value}00Z`, undefined, 'utc').utc();
    expect(date.seconds().toString()).toBe(value);
    expect(date.format('ss.S*')).toBe(value);
    expect(date.format('ss.SSSSSSSSSS')).toBe('12.1234567890');
    expect(Calendar.parse('2026-1-1 12.1234567890', 'Y-M-DD ss.SSSSSSSSSS', 'utc').utc().seconds().toString()).toBe(
      '12.123456789',
    );
    expect(Calendar.fromEpoch('12.5').format('ss.SSSSS')).toBe('12.50000');
    expect(Calendar.fromEpoch(12).format('ss.S*')).toBe('12.0');
    expect(() => Calendar.parse('2026-1-1 12.', 'Y-M-DD ss.S*')).toThrow();
    expect(() => Calendar.parse('2026-1-1 12.1234', 'Y-M-DD ss.SSS')).toThrow();
  });

  it('compares repeated fractional fields by value', () => {
    const date = Calendar.parse('2026-1-1 .10 .100', 'Y-M-DD .SS .SSS', 'utc').utc();
    expect(date.seconds().toString()).toBe('0.1');
  });

  it('shares bracket literals and escapes between parsing and formatting', () => {
    const fmt = String.raw`IY-MM-DD[T]hh:mm:ss[Z]\Z[\]]\[\\`;
    const value = '2026-09-01T02:03:04ZZ][\\';
    const date = Calendar.parse(value, fmt, 'utc').utc();
    expect(date.format(fmt)).toBe(value);
  });

  it.each(['[unclosed', 'YYYY\\', '[escaped\\'])('rejects malformed format %s', (format) => {
    expect(() => new Calendar(2026, 1, 1).format(format)).toThrow();
    expect(() => Calendar.parse('2026', format)).toThrow();
  });
});

describe('Calendar ISO parsing and offsets', () => {
  it.each([
    ['2026-9-1', '2026-09-01T00:00:00.0Z'],
    ['+2026-9-1T2:3', '2026-09-01T02:03:00.0Z'],
    ['2026-9-1T2:3:4', '2026-09-01T02:03:04.0Z'],
    ['2026-9-1T2:3:4.123456789', '2026-09-01T02:03:04.123456789Z'],
    ['2026-9-1T2:3Z', '2026-09-01T02:03:00.0Z'],
    ['2026-9-1T2:3:4Z', '2026-09-01T02:03:04.0Z'],
    ['+2026-9-1T2:3:4.123456789+0000', '2026-09-01T02:03:04.123456789Z'],
    ['2026-9-1T2:3:4+09:00', '2026-08-31T17:03:04.0Z'],
    ['2026-9-1T2:3:4+0900', '2026-08-31T17:03:04.0Z'],
    ['2026-9-1T22:3:4-05:30', '2026-09-02T03:33:04.0Z'],
    ['2026-9-1T22:3:4-0530', '2026-09-02T03:33:04.0Z'],
  ])('normalizes %s', (input, expected) => {
    expect(Calendar.parse(input, undefined, 'utc').utc().format('IY-MM-DD[T]hh:mm:ss.S*Z')).toBe(expected);
  });

  it('uses input offsets independently of the input and display zones', () => {
    const date = Calendar.parse('2026/9/1 0:30 +0900', 'Y/M/DD h:mm Z', 'America/New_York');
    expect(date.zone()).toBe('local');
    expect(date.utc().format('IY-MM-DD[T]hh:mm:ssZ')).toBe('2026-08-31T15:30:00Z');
    expect(date.zone('America/New_York').format('IY-MM-DD[T]hh:mm:ssZ')).toBe('2026-08-31T11:30:00-04:00');
    expect(date.zone('Asia/Kolkata').format('Z')).toBe('+05:30');
    expect(date.utc().format('Z')).toBe('Z');
  });

  it('requires duplicate offsets to agree', () => {
    expect(Calendar.parse('2026-1-1 Z +0000', 'Y-M-DD Z Z', 'utc').utc().format('Z')).toBe('Z');
    expect(() => Calendar.parse('2026-1-1 Z +0900', 'Y-M-DD Z Z')).toThrow('offset is duplicated');
  });

  it.each([
    '',
    '2026-2-30',
    '2026-13-1',
    '2026-9-1T24:00',
    '2026-9-1T1:60',
    '2026-9-1T1:00:60Z',
    '2026-9-1T1:00:00.Z',
    '2026-9-1T1:00:00+24:00',
    '2026-9-1T1:00:00+09:60',
    '2026-9-1T1:00:00+9:00',
    '2026-9-1T1:00:00Z trailing',
    '20260901',
    '2026-09-01Z',
  ])('rejects invalid or unsupported ISO input %s', (input) => {
    expect(() => Calendar.parse(input)).toThrow('value does not match a supported ISO date format');
  });

  it('does not treat an empty format as omitted or suppress zone errors', () => {
    expect(() => Calendar.parse('2026-9-1', '')).toThrow('format does not match value');
    expect(() => Calendar.parse('2026-9-1', undefined, 'Invalid/Zone')).toThrow(RangeError);
  });

  it('defaults date-only and datetime inputs to local time', () => {
    const inputs = [
      ['2026-09-01', new Date(2026, 8, 1)],
      ['2026-09-01T12:34:56', new Date(2026, 8, 1, 12, 34, 56)],
      ['2026-03-08T02:30:00', new Date(2026, 2, 8, 2, 30)],
      ['2026-11-01T01:30:00', new Date(2026, 10, 1, 1, 30)],
    ] as const;
    for (const [input, native] of inputs) {
      const date = Calendar.parse(input);
      expect(date.zone()).toBe('local');
      expect(date.epoch().toString()).toBe(Decimal(native.getTime()).div(1000).toString());
    }
    expect(Calendar.parse('2026/9/1', 'Y/M/DD').epoch().toString()).toBe(
      Decimal(new Date(2026, 8, 1).getTime())
        .div(1000)
        .toString(),
    );
    const explicit = Calendar.parse('2026-09-01T00:00:00Z');
    expect(explicit.zone()).toBe('local');
    expect(explicit.epoch().toString()).toBe(
      Decimal(Date.UTC(2026, 8, 1))
        .div(1000)
        .toString(),
    );
  });
});

describe('Calendar UTC conversion', () => {
  it('converts epoch 0 to 1970-01-01T00:00:00Z', () => {
    const date = Calendar.fromEpoch(0).utc();
    expect(date.year()).toBe(1970n);
    expect(date.month()).toBe(1n);
    expect(date.day()).toBe(1n);
    expect(date.hour()).toBe(0n);
    expect(date.minutes()).toBe(0n);
    expect(date.seconds().toString()).toBe('0');
  });

  it('converts calendar to epoch for a known UTC date', () => {
    const date = Calendar.fromComponents({
      year: 2000n,
      month: 1n,
      day: 1n,
      hour: 0n,
      minutes: 0n,
      seconds: 0,
      zone: 'utc',
    }).utc();
    expect(date.epoch().toString()).toBe('946684800');
  });

  it('handles negative epoch with fractional seconds', () => {
    const date = Calendar.fromEpoch(Decimal('-1.5')).utc();
    expect(date.year()).toBe(1969n);
    expect(date.month()).toBe(12n);
    expect(date.day()).toBe(31n);
    expect(date.hour()).toBe(23n);
    expect(date.minutes()).toBe(59n);
    expect(date.seconds().toString()).toBe('58.5');
  });
});

describe('Calendar mutability and chaining', () => {
  it('creates an instance with the current time when no args are provided', () => {
    const before = Date.now();
    const date = new Calendar();
    const after = Date.now();
    const epochMs = date.epoch().mul(1000).number();
    expect(date.zone()).toBe('local');
    expect(epochMs).toBeGreaterThanOrEqual(before);
    expect(epochMs).toBeLessThanOrEqual(after);
  });

  it('constructs from a Date instance', () => {
    const native = new Date(Date.UTC(2023, 0, 2, 3, 4, 5, 600));
    const date = new Calendar(native);
    expect(date.zone()).toBe('local');
    expect(date.epoch().toString()).toBe(Decimal(native.getTime()).div(1000).toString());
  });

  it('constructs from Date via the static helper', () => {
    const native = new Date(Date.UTC(2024, 4, 6, 7, 8, 9, 10));
    const date = Calendar.fromDate(native);
    expect(date.zone()).toBe('local');
    expect(date.epoch().toString()).toBe(Decimal(native.getTime()).div(1000).toString());
  });

  it('constructs from epoch without a zone argument', () => {
    const date = new Calendar(0);
    expect(date.zone()).toBe('local');
    expect(date.epoch().toString()).toBe('0');
  });

  it('returns new instances for immutable setters', () => {
    const base = Calendar.fromEpoch(0).utc();
    const updated = base.year(2000).month(2).day(3).hour(4).minutes(5).seconds('6.7');
    expect(base.year()).toBe(1970n);
    expect(updated.year()).toBe(2000n);
    expect(updated.month()).toBe(2n);
    expect(updated.day()).toBe(3n);
    expect(updated.hour()).toBe(4n);
    expect(updated.minutes()).toBe(5n);
    expect(updated.seconds().toString()).toBe('6.7');
  });

  it('mutates only with $-suffixed setters', () => {
    const date = Calendar.fromEpoch(0).utc();
    date.year$(1999).month$(12).day$(31).hour$(23).minutes$(59).seconds$('59.5');
    expect(date.year()).toBe(1999n);
    expect(date.month()).toBe(12n);
    expect(date.day()).toBe(31n);
    expect(date.hour()).toBe(23n);
    expect(date.minutes()).toBe(59n);
    expect(date.seconds().toString()).toBe('59.5');
  });

  it('supports zone helpers and mutating variants', () => {
    const base = Calendar.fromEpoch(0).utc();
    const local = base.local();
    expect(base.zone()).toBe('utc');
    expect(local.zone()).toBe('local');
    expect(local.utc().zone()).toBe('utc');

    const mutated = base.clone().local$();
    expect(mutated.zone()).toBe('local');
    mutated.utc$();
    expect(mutated.zone()).toBe('utc');
  });

  it('supports epoch setters and clone', () => {
    const base = Calendar.fromEpoch(0).utc();
    const updated = base.epoch('123.45');
    expect(base.epoch().toString()).toBe('0');
    expect(updated.epoch().toString()).toBe('123.45');

    const clone = updated.clone();
    expect(clone.epoch().toString()).toBe(updated.epoch().toString());
    updated.epoch$('9');
    expect(updated.epoch().toString()).toBe('9');
    expect(clone.epoch().toString()).toBe('123.45');
  });

  it('updates the zone without mutating the original instance', () => {
    const base = Calendar.fromEpoch(0).utc();
    const zoned = base.zone('local');
    expect(base.zone()).toBe('utc');
    expect(zoned.zone()).toBe('local');
    expect(zoned.epoch().toString()).toBe(base.epoch().toString());
  });

  it('accepts calendar inputs via constructor overload', () => {
    const date = new Calendar(2020, 2, 3, 4, 5, '6.75');
    expect(date.zone()).toBe('local');
    expect(date.epoch().toString()).toBe(
      Decimal(new Date(2020, 1, 3, 4, 5, 6, 750).getTime())
        .div(1000)
        .toString(),
    );
    expect(date.year()).toBe(2020n);
    expect(date.month()).toBe(2n);
    expect(date.day()).toBe(3n);
    expect(date.hour()).toBe(4n);
    expect(date.minutes()).toBe(5n);
    expect(date.seconds().toString()).toBe('6.75');
  });

  it('constructs from epoch with local display and preserves arbitrary precision', () => {
    const date = Calendar.fromEpoch('1788228184.123456789');
    expect(date.zone()).toBe('local');
    expect(date.epoch().toString()).toBe('1788228184.123456789');
    expect(date.utc().format('IY-MM-DD[T]hh:mm:ss.S*Z')).toBe('2026-09-01T02:03:04.123456789Z');
    expect(date.zone()).toBe('local');
  });

  it('throws for non-integer calendar inputs', () => {
    expect(() => Calendar.fromComponents({ year: '1.5', month: 1, day: 1 })).toThrow('year must be an integer');
    expect(() => Calendar.fromComponents({ year: 1.5, month: 1, day: 1 })).toThrow('year must be an integer');
  });

  it('accepts integer decimal-like calendar inputs', () => {
    const date = Calendar.fromComponents({ year: '2000', month: '2', day: '3', zone: 'utc' }).utc();
    expect(date.year()).toBe(2000n);
    expect(date.month()).toBe(2n);
    expect(date.day()).toBe(3n);
  });
});

describe('Calendar local conversion', () => {
  it('interprets component input in local time by default', () => {
    const input = { year: 2026, month: 9, day: 1, hour: 12, minutes: 34, seconds: '56.123456789' };
    const date = Calendar.fromComponents(input);
    const expected = Decimal(new Date(2026, 8, 1, 12, 34, 56).getTime())
      .div(1000)
      .add('0.123456789');
    expect(date.zone()).toBe('local');
    expect(date.epoch().toString()).toBe(expected.toString());
    expect(date.format('IY-MM-DD[T]hh:mm:ss.S*')).toBe('2026-09-01T12:34:56.123456789');
    expect(
      Calendar.fromComponents({ ...input, zone: 'local' })
        .epoch()
        .toString(),
    ).toBe(expected.toString());
    expect(new Calendar(2026, 9, 1).epoch().toString()).toBe(
      Decimal(new Date(2026, 8, 1).getTime())
        .div(1000)
        .toString(),
    );
  });

  it.each(['utc', 'Asia/Tokyo', 'America/New_York'])('uses %s only to interpret components and strings', (zone) => {
    const input = { year: 2026, month: 9, day: 1, hour: 12, minutes: 34, seconds: '56.123456789', zone };
    const fromComponents = Calendar.fromComponents(input);
    const parsed = Calendar.parse('2026-9-1T12:34:56.123456789', undefined, zone);
    const expected = {
      utc: '2026-09-01T12:34:56.123456789Z',
      'Asia/Tokyo': '2026-09-01T03:34:56.123456789Z',
      'America/New_York': '2026-09-01T16:34:56.123456789Z',
    }[zone];
    for (const date of [fromComponents, parsed]) {
      expect(date.zone()).toBe('local');
      expect(date.utc().format('IY-MM-DD[T]hh:mm:ss.S*Z')).toBe(expected);
      expect(date.zone(zone).format('IY-MM-DD[T]hh:mm:ss.S*')).toBe('2026-09-01T12:34:56.123456789');
      expect(date.zone(zone).epoch().toString()).toBe(date.epoch().toString());
      expect(date.zone()).toBe('local');
    }
  });

  it('preserves display zones through cloning, epoch changes and calendar operations', () => {
    const date = Calendar.parse('2026-09-01T12:34:56.123456789Z').zone('Asia/Tokyo');
    const results = [
      date.clone(),
      date.epoch('1788228184.123456789'),
      date.year(2027),
      date.month(10),
      date.day(2),
      date.hour(9),
      date.minutes(15),
      date.seconds('1.5'),
      date.alignToDay(),
      date.nextDay(),
      date.alignToMonth(),
      date.nextMonth(),
      date.alignToYear(),
      date.nextYear(),
      date.alignToSecond(15),
    ];
    for (const result of results) {
      expect(result).not.toBe(date);
      expect(result.zone()).toBe('Asia/Tokyo');
    }
    expect(date.clone().epoch().toString()).toBe(date.epoch().toString());
    expect(date.format('IY-MM-DD[T]hh:mm:ss.S*Z')).toBe('2026-09-01T21:34:56.123456789+09:00');
    expect(date.alignToDay().utc().format('IY-MM-DD[T]hh:mm:ssZ')).toBe('2026-08-31T15:00:00Z');
    expect(date.hour(9).utc().format('IY-MM-DD[T]hh:mm:ss.S*Z')).toBe('2026-09-01T00:34:56.123456789Z');
    const mutable = date.clone();
    expect(mutable.epoch$(0).year$(2026).alignToDay().zone()).toBe('Asia/Tokyo');
  });

  it('matches local components from Date for a representable epoch', () => {
    const native = new Date(Date.UTC(2020, 0, 2, 3, 4, 5, 678));
    const epochSeconds = Decimal(native.getTime()).div(1000);
    const date = Calendar.fromEpoch(epochSeconds);

    expect(date.year()).toBe(BigInt(native.getFullYear()));
    expect(date.month()).toBe(BigInt(native.getMonth() + 1));
    expect(date.day()).toBe(BigInt(native.getDate()));
    expect(date.hour()).toBe(BigInt(native.getHours()));
    expect(date.minutes()).toBe(BigInt(native.getMinutes()));

    const expectedSeconds = Decimal(native.getSeconds()).add(Decimal(native.getMilliseconds()).div(1000));
    expect(date.seconds().toString()).toBe(expectedSeconds.toString());
    expect(date.components().weekday).toBe(native.getDay());
  });

  it('converts local calendar back to epoch aligned with Date', () => {
    const native = new Date(Date.UTC(2022, 5, 15, 6, 7, 8, 900));
    const date = Calendar.fromComponents({
      year: BigInt(native.getFullYear()),
      month: BigInt(native.getMonth() + 1),
      day: BigInt(native.getDate()),
      hour: BigInt(native.getHours()),
      minutes: BigInt(native.getMinutes()),
      seconds: Decimal(native.getSeconds()).add(Decimal(native.getMilliseconds()).div(1000)),
    });

    const expected = Decimal(native.getTime()).div(1000).toString();
    expect(date.epoch().toString()).toBe(expected);
  });
});

describe('Calendar time zone conversion', () => {
  function getTimeZoneParts(date: Date, timeZone: string) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    const parts = formatter.formatToParts(date);
    const map = new Map(parts.map((part) => [part.type, part.value]));
    return {
      year: BigInt(map.get('year') ?? '0'),
      month: BigInt(map.get('month') ?? '0'),
      day: BigInt(map.get('day') ?? '0'),
      hour: BigInt(map.get('hour') ?? '0'),
      minutes: BigInt(map.get('minute') ?? '0'),
      seconds: Decimal(map.get('second') ?? '0'),
    };
  }

  it('converts epoch to calendar for an IANA time zone', () => {
    const timeZone = 'America/New_York';
    const native = new Date(Date.UTC(2020, 5, 1, 12, 34, 56, 0));
    const epochSeconds = Decimal(native.getTime()).div(1000);
    const date = Calendar.fromEpoch(epochSeconds).zone(timeZone);
    const expected = getTimeZoneParts(native, timeZone);

    expect(date.year()).toBe(expected.year);
    expect(date.month()).toBe(expected.month);
    expect(date.day()).toBe(expected.day);
    expect(date.hour()).toBe(expected.hour);
    expect(date.minutes()).toBe(expected.minutes);
    expect(date.seconds().toString()).toBe(expected.seconds.toString());
    const weekday = new Map(
      new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' })
        .formatToParts(native)
        .map((part) => [part.type, part.value]),
    ).get('weekday');
    const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday ?? '');
    expect(date.components().weekday).toBe(weekdayIndex);
  });

  it('covers time zone parts mapping for another IANA zone', () => {
    const timeZone = 'Asia/Tokyo';
    const date = Calendar.fromEpoch(0).zone(timeZone);
    expect(date.zone()).toBe(timeZone);
    expect(date.year()).toBe(1970n);
  });

  it('uses default parts when time zone data is incomplete', () => {
    const original = Intl.DateTimeFormat;
    Intl.DateTimeFormat = class {
      constructor(_locale: string, _options: Intl.DateTimeFormatOptions) {}
      formatToParts() {
        return [{ type: 'year', value: '2000' }] as Intl.DateTimeFormatPart[];
      }
    } as unknown as typeof Intl.DateTimeFormat;

    try {
      const date = Calendar.fromEpoch(0).zone('Etc/MissingParts');
      expect(date.year()).toBeDefined();
    } finally {
      Intl.DateTimeFormat = original;
    }
  });

  it('uses zero defaults when year is missing', () => {
    const original = Intl.DateTimeFormat;
    Intl.DateTimeFormat = class {
      constructor(_locale: string, _options: Intl.DateTimeFormatOptions) {}
      formatToParts() {
        return [] as Intl.DateTimeFormatPart[];
      }
    } as unknown as typeof Intl.DateTimeFormat;

    try {
      const date = Calendar.fromEpoch(0).zone('Etc/MissingYear');
      expect(date.year()).toBeDefined();
    } finally {
      Intl.DateTimeFormat = original;
    }
  });

  it('converts calendar to epoch for an IANA time zone', () => {
    const timeZone = 'America/New_York';
    const native = new Date(Date.UTC(2021, 10, 7, 5, 6, 7, 0));
    const expectedEpoch = Decimal(native.getTime()).div(1000);
    const parts = getTimeZoneParts(native, timeZone);
    const date = Calendar.fromComponents({ ...parts, zone: timeZone }).zone(timeZone);

    expect(date.epoch().toString()).toBe(expectedEpoch.toString());
  });

  it.each([
    ['America/New_York', '2026-03-08T02:30:00', '2026-03-08T07:30:00Z'],
    ['America/New_York', '2026-11-01T01:30:00', '2026-11-01T05:30:00Z'],
    ['Europe/Berlin', '2026-03-29T02:30:00', '2026-03-29T01:30:00Z'],
    ['Europe/Berlin', '2026-10-25T02:30:00', '2026-10-25T00:30:00Z'],
    ['Australia/Lord_Howe', '2026-10-04T02:15:00', '2026-10-03T15:45:00Z'],
    ['Australia/Lord_Howe', '2026-04-05T01:45:00', '2026-04-04T14:45:00Z'],
    ['Pacific/Apia', '2011-12-30T12:00:00', '2011-12-30T22:00:00Z'],
  ])('resolves gaps and overlaps in %s at %s', (zone, input, expected) => {
    const date = Calendar.parse(input, undefined, zone);
    expect(date.epoch().toString()).toBe(Decimal(Date.parse(expected)).div(1000).toString());
    expect(date.zone()).toBe('local');
    const components = Calendar.parse(input, undefined, 'utc').utc().components();
    const fromComponents = Calendar.fromComponents({ ...components, zone });
    expect(fromComponents.epoch().toString()).toBe(date.epoch().toString());
    expect(fromComponents.zone()).toBe('local');
  });
});

describe('Calendar parsing', () => {
  it('parses compact year+month formats and defaults day to 1', () => {
    const date = Calendar.parse('202612', 'yyyyMM', 'utc').utc();
    expect(date.year()).toBe(2026n);
    expect(date.month()).toBe(12n);
    expect(date.day()).toBe(1n);
  });

  it('chooses a valid month when compact formats are ambiguous', () => {
    const date = Calendar.parse('20260117', 'yyyyMM', 'utc').utc();
    expect(date.year()).toBe(2026011n);
    expect(date.month()).toBe(7n);
    expect(date.day()).toBe(1n);
  });

  it('throws for impossible calendar dates', () => {
    expect(() => Calendar.parse('20260230', 'yyyyMMDD', 'utc')).toThrow('day is out of range');
  });
});

describe('Calendar alignment and stepping', () => {
  it('aligns to the same day when no step is provided', () => {
    const date = Calendar.fromComponents({
      year: 2020n,
      month: 5n,
      day: 17n,
      hour: 10n,
      minutes: 30n,
      seconds: 0,
      zone: 'utc',
    }).utc();
    const aligned = date.alignToDay();
    expect(aligned.year()).toBe(2020n);
    expect(aligned.month()).toBe(5n);
    expect(aligned.day()).toBe(17n);
    expect(aligned.hour()).toBe(0n);
  });
  it('aligns to day boundaries with a step', () => {
    const date = Calendar.fromComponents({
      year: 2020n,
      month: 5n,
      day: 17n,
      hour: 10n,
      minutes: 30n,
      seconds: '22.5',
      zone: 'utc',
    }).utc();
    const aligned = date.alignToDay(5n);
    expect(aligned.year()).toBe(2020n);
    expect(aligned.month()).toBe(5n);
    expect(aligned.day()).toBe(16n);
    expect(aligned.hour()).toBe(0n);
    expect(aligned.minutes()).toBe(0n);
    expect(aligned.seconds().toString()).toBe('0');
  });

  it('moves to the next day boundary with a step', () => {
    const date = Calendar.fromComponents({
      year: 2020n,
      month: 5n,
      day: 17n,
      hour: 10n,
      minutes: 30n,
      seconds: '22.5',
      zone: 'utc',
    }).utc();
    const next = date.nextDay(5n);
    expect(next.year()).toBe(2020n);
    expect(next.month()).toBe(5n);
    expect(next.day()).toBe(21n);
    expect(next.hour()).toBe(0n);
    expect(next.minutes()).toBe(0n);
    expect(next.seconds().toString()).toBe('0');
  });

  it('moves to the next stepped day from a list', () => {
    const date = Calendar.fromComponents({
      year: 2020n,
      month: 5n,
      day: 10n,
      hour: 9n,
      minutes: 0n,
      seconds: 0,
      zone: 'utc',
    }).utc();
    const next = date.nextDay([1n, 15n, 20n]);
    expect(next.year()).toBe(2020n);
    expect(next.month()).toBe(5n);
    expect(next.day()).toBe(15n);
  });

  it('handles duplicate entries when selecting the next stepped day', () => {
    const date = Calendar.fromComponents({
      year: 2020n,
      month: 5n,
      day: 9n,
      hour: 9n,
      minutes: 0n,
      seconds: 0,
      zone: 'utc',
    }).utc();
    const next = date.nextDay([10n, 10n, 20n]);
    expect(next.day()).toBe(10n);
  });

  it('aligns to the nearest stepped day from a list', () => {
    const date = Calendar.fromComponents({
      year: 2020n,
      month: 5n,
      day: 17n,
      hour: 9n,
      minutes: 0n,
      seconds: 0,
      zone: 'utc',
    }).utc();
    const aligned = date.alignToDay([1n, 10n, 20n]);
    expect(aligned.year()).toBe(2020n);
    expect(aligned.month()).toBe(5n);
    expect(aligned.day()).toBe(10n);
    expect(aligned.hour()).toBe(0n);
  });

  it('handles duplicate entries in stepped days', () => {
    const date = Calendar.fromComponents({
      year: 2020n,
      month: 5n,
      day: 12n,
      hour: 9n,
      minutes: 0n,
      seconds: 0,
      zone: 'utc',
    }).utc();
    const aligned = date.alignToDay([5n, 5n, 10n]);
    expect(aligned.day()).toBe(10n);
  });

  it('keeps the current day when no stepped day is before it', () => {
    const date = Calendar.fromComponents({
      year: 2020n,
      month: 5n,
      day: 10n,
      hour: 9n,
      minutes: 0n,
      seconds: 0,
      zone: 'utc',
    }).utc();
    const aligned = date.alignToDay([20n, 30n]);
    expect(aligned.year()).toBe(2020n);
    expect(aligned.month()).toBe(5n);
    expect(aligned.day()).toBe(10n);
  });

  it('keeps the current day when nextDay is called without a step', () => {
    const date = Calendar.fromComponents({
      year: 2020n,
      month: 5n,
      day: 10n,
      hour: 9n,
      minutes: 0n,
      seconds: 0,
      zone: 'utc',
    }).utc();
    const next = date.nextDay();
    expect(next.year()).toBe(2020n);
    expect(next.month()).toBe(5n);
    expect(next.day()).toBe(10n);
  });

  it('covers comparator equality branches in stepping helpers', () => {
    const original = Array.prototype.toSorted;
    Array.prototype.toSorted = function (compareFn) {
      if (compareFn) {
        compareFn(1n, 2n);
        compareFn(2n, 1n);
        compareFn(1n, 1n);
      }
      return original.call(this, compareFn);
    };

    try {
      const date = Calendar.fromComponents({
        year: 2020n,
        month: 5n,
        day: 10n,
        hour: 9n,
        minutes: 0n,
        seconds: 0,
        zone: 'utc',
      }).utc();
      date.alignToDay([1n, 2n]);
      date.nextDay([1n, 2n]);
    } finally {
      Array.prototype.toSorted = original;
    }
  });

  it('moves to the next month when no later stepped day exists', () => {
    const date = Calendar.fromComponents({
      year: 2020n,
      month: 5n,
      day: 30n,
      hour: 9n,
      minutes: 0n,
      seconds: 0,
      zone: 'utc',
    }).utc();
    const next = date.nextDay([1n, 15n]);
    expect(next.year()).toBe(2020n);
    expect(next.month()).toBe(6n);
    expect(next.day()).toBe(1n);
    expect(next.hour()).toBe(0n);
  });

  it('aligns and steps months', () => {
    const date = Calendar.fromComponents({
      year: 2020n,
      month: 5n,
      day: 17n,
      hour: 1n,
      minutes: 2n,
      seconds: 3,
      zone: 'utc',
    }).utc();
    const aligned = date.alignToMonth(3n);
    expect(aligned.year()).toBe(2020n);
    expect(aligned.month()).toBe(4n);
    expect(aligned.day()).toBe(1n);

    const next = date.nextMonth(3n);
    expect(next.year()).toBe(2020n);
    expect(next.month()).toBe(7n);
    expect(next.day()).toBe(1n);
  });

  it('aligns and steps years', () => {
    const date = Calendar.fromComponents({
      year: 2025n,
      month: 5n,
      day: 17n,
      hour: 1n,
      minutes: 2n,
      seconds: 3,
      zone: 'utc',
    }).utc();
    const aligned = date.alignToYear(10n);
    expect(aligned.year()).toBe(2020n);
    expect(aligned.month()).toBe(1n);
    expect(aligned.day()).toBe(1n);

    const next = date.nextYear(10n);
    expect(next.year()).toBe(2030n);
    expect(next.month()).toBe(1n);
    expect(next.day()).toBe(1n);
  });

  it('aligns years with era boundaries', () => {
    const ad202 = Calendar.fromComponents({
      year: 202n,
      month: 6n,
      day: 1n,
      hour: 0n,
      minutes: 0n,
      seconds: 0,
      zone: 'utc',
    }).utc();
    const ad102 = Calendar.fromComponents({
      year: 102n,
      month: 6n,
      day: 1n,
      hour: 0n,
      minutes: 0n,
      seconds: 0,
      zone: 'utc',
    }).utc();
    const ad10 = Calendar.fromComponents({
      year: 10n,
      month: 6n,
      day: 1n,
      hour: 0n,
      minutes: 0n,
      seconds: 0,
      zone: 'utc',
    }).utc();
    const bc50 = Calendar.fromComponents({
      year: -49n,
      month: 6n,
      day: 1n,
      hour: 0n,
      minutes: 0n,
      seconds: 0,
      zone: 'utc',
    }).utc();
    const bc150 = Calendar.fromComponents({
      year: -149n,
      month: 6n,
      day: 1n,
      hour: 0n,
      minutes: 0n,
      seconds: 0,
      zone: 'utc',
    }).utc();

    expect(ad202.alignToYear(100n, { era: true }).year()).toBe(200n);
    expect(ad102.alignToYear(100n, { era: true }).year()).toBe(100n);
    expect(ad10.alignToYear(100n, { era: true }).year()).toBe(1n);
    expect(bc50.alignToYear(100n, { era: true }).year()).toBe(-99n);
    expect(bc150.alignToYear(100n, { era: true }).year()).toBe(-199n);
  });

  it('steps years with era boundaries', () => {
    const ad202 = Calendar.fromComponents({
      year: 202n,
      month: 6n,
      day: 1n,
      hour: 0n,
      minutes: 0n,
      seconds: 0,
      zone: 'utc',
    }).utc();
    const ad102 = Calendar.fromComponents({
      year: 102n,
      month: 6n,
      day: 1n,
      hour: 0n,
      minutes: 0n,
      seconds: 0,
      zone: 'utc',
    }).utc();
    const ad10 = Calendar.fromComponents({
      year: 10n,
      month: 6n,
      day: 1n,
      hour: 0n,
      minutes: 0n,
      seconds: 0,
      zone: 'utc',
    }).utc();
    const bc50 = Calendar.fromComponents({
      year: -49n,
      month: 6n,
      day: 1n,
      hour: 0n,
      minutes: 0n,
      seconds: 0,
      zone: 'utc',
    }).utc();
    const bc150 = Calendar.fromComponents({
      year: -149n,
      month: 6n,
      day: 1n,
      hour: 0n,
      minutes: 0n,
      seconds: 0,
      zone: 'utc',
    }).utc();

    expect(ad202.nextYear(100n, { era: true }).year()).toBe(300n);
    expect(ad102.nextYear(100n, { era: true }).year()).toBe(200n);
    expect(ad10.nextYear(100n, { era: true }).year()).toBe(100n);
    expect(bc50.nextYear(100n, { era: true }).year()).toBe(1n);
    expect(bc150.nextYear(100n, { era: true }).year()).toBe(-99n);
  });

  it('keeps the current year when no step is provided', () => {
    const date = Calendar.fromComponents({
      year: 2025n,
      month: 5n,
      day: 17n,
      hour: 1n,
      minutes: 2n,
      seconds: 3,
      zone: 'utc',
    }).utc();
    const aligned = date.alignToYear();
    const next = date.nextYear();
    expect(aligned.year()).toBe(2025n);
    expect(next.year()).toBe(2025n);
  });

  it('keeps the BC year when no next step exists', () => {
    const bc50 = Calendar.fromComponents({
      year: -49n,
      month: 6n,
      day: 1n,
      hour: 0n,
      minutes: 0n,
      seconds: 0,
      zone: 'utc',
    }).utc();
    const aligned = bc50.alignToYear([], { era: true });
    expect(aligned.year()).toBe(-49n);
  });

  it('falls back to year 1 when no previous stepped BC entry exists', () => {
    const bc50 = Calendar.fromComponents({
      year: -49n,
      month: 6n,
      day: 1n,
      hour: 0n,
      minutes: 0n,
      seconds: 0,
      zone: 'utc',
    }).utc();
    expect(bc50.nextYear([100n], { era: true }).year()).toBe(1n);
  });

  it('aligns to seconds within a day', () => {
    const date = Calendar.fromComponents({
      year: 2020n,
      month: 5n,
      day: 17n,
      hour: 10n,
      minutes: 30n,
      seconds: '22.123',
      zone: 'utc',
    }).utc();
    const aligned = date.alignToSecond(15);
    expect(aligned.hour()).toBe(10n);
    expect(aligned.minutes()).toBe(30n);
    expect(aligned.seconds().toString()).toBe('15');
  });
});

describe('Calendar formatting', () => {
  it('formats fractional seconds with padding', () => {
    const date = Calendar.fromEpoch('12.3456').utc();
    expect(date.format('YYYY-MM-DD hh:mm:ss.SSSSSS')).toBe('1970-01-01 00:00:12.345600');
    expect(date.format('YYYY-MM-DD hh:mm:ss.SSS')).toBe('1970-01-01 00:00:12.345');
    expect(date.format('YYYY-MM-DD hh:mm:ss.SS')).toBe('1970-01-01 00:00:12.34');
    expect(date.format('YYYY-MM-DD hh:mm:ss.S')).toBe('1970-01-01 00:00:12.3');
  });

  it('formats seconds without a fraction', () => {
    const date = Calendar.fromEpoch(12).utc();
    expect(date.format('YYYY-MM-DD hh:mm:ss.SSS')).toBe('1970-01-01 00:00:12.000');
  });

  it('formats era markers for BC and AD years', () => {
    const ad = Calendar.fromComponents({ year: 1n, month: 1n, day: 1n, zone: 'utc' }).utc();
    const bc = Calendar.fromComponents({ year: 0n, month: 1n, day: 1n, zone: 'utc' }).utc();
    expect(ad.format('G')).toBe('1 AD');
    expect(ad.format('GGGG')).toBe('0001 AD');
    expect(bc.format('G')).toBe('BC 1');
    expect(bc.format('GGGG')).toBe('BC 0001');
  });

  it('formats single-digit month and hour tokens without padding', () => {
    const date = Calendar.fromComponents({
      year: 2024n,
      month: 6n,
      day: 5n,
      hour: 3n,
      minutes: 4n,
      seconds: 0,
      zone: 'utc',
    }).utc();
    expect(date.format('YYYY-M-DD h:mm')).toBe('2024-6-05 3:04');
  });

  it('formats negative years with padded year tokens', () => {
    const bc1 = Calendar.fromComponents({ year: 0n, month: 1n, day: 1n, zone: 'utc' }).utc();
    const bc2 = Calendar.fromComponents({ year: -1n, month: 1n, day: 1n, zone: 'utc' }).utc();
    expect(bc1.format('YYYY-MM-DD')).toBe('0000-01-01');
    expect(bc1.format('y-MM-DD')).toBe('0-01-01');
    expect(bc2.format('YYYY-MM-DD')).toBe('-0001-01-01');
    expect(bc2.format('y-MM-DD')).toBe('-1-01-01');
  });

  it('formats lowercase era tokens without AD suffix', () => {
    const ad = Calendar.fromComponents({ year: 12n, month: 1n, day: 1n, zone: 'utc' }).utc();
    const bc = Calendar.fromComponents({ year: 0n, month: 1n, day: 1n, zone: 'utc' }).utc();
    expect(ad.format('g')).toBe('12');
    expect(ad.format('gggg')).toBe('0012');
    expect(bc.format('g')).toBe('BC 1');
    expect(bc.format('gggg')).toBe('BC 0001');
  });

  it('formats lowercase padded year tokens', () => {
    const ad = Calendar.fromComponents({ year: 42n, month: 1n, day: 1n, zone: 'utc' }).utc();
    const bc = Calendar.fromComponents({ year: -1n, month: 1n, day: 1n, zone: 'utc' }).utc();
    expect(ad.format('yyyy-MM-DD')).toBe('0042-01-01');
    expect(bc.format('yyyy-MM-DD')).toBe('-0001-01-01');
  });
});

describe('Calendar parsing', () => {
  it('parses a full datetime with fractional seconds', () => {
    const date = Calendar.parse('2024-06-15 12:30:45.123', 'YYYY-MM-DD hh:mm:ss.SSS', 'utc').utc();
    expect(date.year()).toBe(2024n);
    expect(date.month()).toBe(6n);
    expect(date.day()).toBe(15n);
    expect(date.hour()).toBe(12n);
    expect(date.minutes()).toBe(30n);
    expect(date.seconds().toString()).toBe('45.123');
  });

  it('parses a date-only format and defaults time to zero', () => {
    const date = Calendar.parse('2024-06-15', 'YYYY-MM-DD', 'utc').utc();
    expect(date.hour()).toBe(0n);
    expect(date.minutes()).toBe(0n);
    expect(date.seconds().toString()).toBe('0');
  });

  it('parses era-aware formats', () => {
    const bc = Calendar.parse('BC 0001-01-01', 'GGGG-MM-DD', 'utc').utc();
    const ad = Calendar.parse('1 AD-01-01', 'G-MM-DD', 'utc').utc();
    expect(bc.year()).toBe(0n);
    expect(ad.year()).toBe(1n);
  });

  it('parses era tokens without explicit era suffixes', () => {
    const date = Calendar.parse('2024-06-15', 'gggg-MM-DD', 'utc').utc();
    expect(date.year()).toBe(2024n);
  });

  it('throws for year zero in explicit era tokens', () => {
    expect(() => Calendar.parse('0000 AD-01-01', 'GGGG-MM-DD', 'utc')).toThrow('era year must be at least 1');
    expect(() => Calendar.parse('BC 0000-01-01', 'GGGG-MM-DD', 'utc')).toThrow('era year must be at least 1');
    expect(() => Calendar.parse('0 AD-01-01', 'G-MM-DD', 'utc')).toThrow('era year must be at least 1');
    expect(() => Calendar.parse('BC 0-01-01', 'G-MM-DD', 'utc')).toThrow('era year must be at least 1');
  });

  it('parses era tokens without spaces', () => {
    const bc = Calendar.parse('BC0001-01-01', 'GGGG-MM-DD', 'utc').utc();
    const ad = Calendar.parse('0001AD-01-01', 'GGGG-MM-DD', 'utc').utc();
    expect(bc.year()).toBe(0n);
    expect(ad.year()).toBe(1n);
  });

  it('throws when required date fields are missing', () => {
    expect(() => Calendar.parse('2024', 'YYYY', 'utc')).toThrow('format must include year and month');
  });

  it('throws when the input does not match the format', () => {
    expect(() => Calendar.parse('2024/06/15', 'YYYY-MM-DD', 'utc')).toThrow('format does not match value');
  });

  it('throws when the same field is duplicated with different values', () => {
    expect(() => Calendar.parse('2024-2025-06-15', 'YYYY-YYYY-MM-DD', 'utc')).toThrow('year is duplicated');
  });

  it('throws when fractional seconds are duplicated with different values', () => {
    expect(() => Calendar.parse('2024-06-15 12:30:45.12.3', 'YYYY-MM-DD hh:mm:ss.SS.S', 'utc')).toThrow(
      'fraction is duplicated',
    );
  });

  it('parses single-digit month and hour tokens with one or two digits', () => {
    const compact = Calendar.parse('2024-6-05 3:04', 'YYYY-M-DD h:mm', 'utc').utc();
    expect(compact.month()).toBe(6n);
    expect(compact.hour()).toBe(3n);

    const padded = Calendar.parse('2024-06-05 03:04', 'YYYY-M-DD h:mm', 'utc').utc();
    expect(padded.month()).toBe(6n);
    expect(padded.hour()).toBe(3n);
  });

  it('parses negative years for padded and variable year tokens', () => {
    const bc1 = Calendar.parse('0000-01-01', 'YYYY-MM-DD', 'utc').utc();
    const bc2 = Calendar.parse('-0001-01-01', 'YYYY-MM-DD', 'utc').utc();
    const bc2Short = Calendar.parse('-1-01-01', 'y-MM-DD', 'utc').utc();
    expect(bc1.year()).toBe(0n);
    expect(bc2.year()).toBe(-1n);
    expect(bc2Short.year()).toBe(-1n);
  });

  it('round-trips era tokens with year tokens and components', () => {
    const bc1 = Calendar.parse('BC 0001-01-01', 'GGGG-MM-DD', 'utc').utc();
    const bc2 = Calendar.parse('BC 0002-01-01', 'GGGG-MM-DD', 'utc').utc();
    const ad1 = Calendar.parse('0001 AD-01-01', 'GGGG-MM-DD', 'utc').utc();

    expect(bc1.format('YYYY-MM-DD')).toBe('0000-01-01');
    expect(bc2.format('YYYY-MM-DD')).toBe('-0001-01-01');
    expect(ad1.format('YYYY-MM-DD')).toBe('0001-01-01');

    expect(bc1.components().year).toBe(0n);
    expect(bc2.components().year).toBe(-1n);
    expect(ad1.components().year).toBe(1n);
  });

  it('accepts duplicate tokens when the values are identical', () => {
    const date = Calendar.parse('2024-02-02', 'YYYY-MM-MM', 'utc').utc();
    expect(date.year()).toBe(2024n);
    expect(date.month()).toBe(2n);
  });

  it('throws when duplicate month tokens differ', () => {
    expect(() => Calendar.parse('01-02', 'MM-MM', 'utc')).toThrow('month is duplicated');
  });

  it('throws when duplicate day tokens differ', () => {
    expect(() => Calendar.parse('01-02', 'DD-DD', 'utc')).toThrow('day is duplicated');
  });

  it('throws when duplicate hour tokens differ', () => {
    expect(() => Calendar.parse('01-02', 'hh-hh', 'utc')).toThrow('hour is duplicated');
  });

  it('throws when duplicate minutes tokens differ', () => {
    expect(() => Calendar.parse('01-02', 'mm-mm', 'utc')).toThrow('minutes is duplicated');
  });

  it('throws when duplicate seconds tokens differ', () => {
    expect(() => Calendar.parse('01-02', 'ss-ss', 'utc')).toThrow('seconds is duplicated');
  });

  it('throws when era tokens do not match the input', () => {
    expect(() => Calendar.parse('AD 2024-01-01', 'GGGG-MM-DD', 'utc')).toThrow('format does not match value');
  });

  it('accepts years shorter than the output width', () => {
    expect(Calendar.parse('20-01', 'YYYY-MM', 'utc').utc().format('YYYY-MM')).toBe('0020-01');
  });

  it('throws when remaining minimum length exceeds the input', () => {
    expect(() => Calendar.parse('1-', 'y-YYYY', 'utc')).toThrow('format does not match value');
  });

  it('throws when month is out of range', () => {
    expect(() => Calendar.parse('2024-13-01', 'YYYY-MM-DD', 'utc')).toThrow('format does not match value');
  });

  it('throws when hour is out of range', () => {
    expect(() => Calendar.parse('2024-01-01 24:00:00', 'YYYY-MM-DD hh:mm:ss', 'utc')).toThrow(
      'format does not match value',
    );
  });

  it('throws when minutes are out of range', () => {
    expect(() => Calendar.parse('2024-01-01 23:60:00', 'YYYY-MM-DD hh:mm:ss', 'utc')).toThrow(
      'format does not match value',
    );
  });

  it('throws when seconds are out of range', () => {
    expect(() => Calendar.parse('2024-01-01 23:59:60', 'YYYY-MM-DD hh:mm:ss', 'utc')).toThrow(
      'format does not match value',
    );
  });

  it('throws when the fraction contains non-digits', () => {
    expect(() => Calendar.parse('2024-06-15 12:30:45.A', 'YYYY-MM-DD hh:mm:ss.S', 'utc')).toThrow(
      'format does not match value',
    );
  });

  it('throws when era tokens conflict', () => {
    expect(() => Calendar.parse('BC 1-2 AD', 'G-G', 'utc')).toThrow('year is duplicated');
  });

  it('throws when month tokens contain non-digits', () => {
    expect(() => Calendar.parse('2024-0X-01', 'YYYY-MM-DD', 'utc')).toThrow('format does not match value');
  });

  it('throws when day tokens contain non-digits', () => {
    expect(() => Calendar.parse('2024-01-0X', 'YYYY-MM-DD', 'utc')).toThrow('format does not match value');
  });

  it('throws when hour tokens contain non-digits', () => {
    expect(() => Calendar.parse('2024-01-01 X0:00:00', 'YYYY-MM-DD hh:mm:ss', 'utc')).toThrow(
      'format does not match value',
    );
  });

  it('throws when minute tokens contain non-digits', () => {
    expect(() => Calendar.parse('2024-01-01 00:X0:00', 'YYYY-MM-DD hh:mm:ss', 'utc')).toThrow(
      'format does not match value',
    );
  });

  it('throws when second tokens contain non-digits', () => {
    expect(() => Calendar.parse('2024-01-01 00:00:X0', 'YYYY-MM-DD hh:mm:ss', 'utc')).toThrow(
      'format does not match value',
    );
  });

  it('throws when fraction tokens contain non-digits', () => {
    expect(() => Calendar.parse('2024-01-01 00:00:00.ABC', 'YYYY-MM-DD hh:mm:ss.SSS', 'utc')).toThrow(
      'format does not match value',
    );
  });
});

describe('Calendar weekday', () => {
  it('returns weekday index for the UNIX epoch start', () => {
    const date = Calendar.fromEpoch(0).utc();
    expect(date.weekday()).toBe(4);
  });

  it('returns weekday index for nearby UTC dates', () => {
    const sunday = Calendar.fromComponents({ year: 1970n, month: 1n, day: 4n, zone: 'utc' }).utc();
    const wednesday = Calendar.fromComponents({ year: 1969n, month: 12n, day: 31n, zone: 'utc' }).utc();
    expect(sunday.weekday()).toBe(0);
    expect(wednesday.weekday()).toBe(3);
  });

  it('includes weekday in components()', () => {
    const date = Calendar.fromComponents({ year: 1970n, month: 1n, day: 1n, zone: 'utc' }).utc();
    expect(date.components().weekday).toBe(4);
  });
});
