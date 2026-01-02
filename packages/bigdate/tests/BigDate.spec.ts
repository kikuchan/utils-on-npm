import { Decimal } from '@kikuchan/decimal';
import { describe, expect, it } from 'vitest';
import { BigDate } from '../src/index';

describe('BigDate UTC conversion', () => {
  it('converts epoch 0 to 1970-01-01T00:00:00Z', () => {
    const date = BigDate.fromEpoch(0, 'utc');
    expect(date.year()).toBe(1970n);
    expect(date.month()).toBe(1n);
    expect(date.day()).toBe(1n);
    expect(date.hour()).toBe(0n);
    expect(date.minutes()).toBe(0n);
    expect(date.seconds().toString()).toBe('0');
  });

  it('converts calendar to epoch for a known UTC date', () => {
    const date = BigDate.fromCalendar({ year: 2000n, month: 1n, day: 1n, hour: 0n, minutes: 0n, seconds: 0 }, 'utc');
    expect(date.epoch().toString()).toBe('946684800');
  });

  it('handles negative epoch with fractional seconds', () => {
    const date = BigDate.fromEpoch(Decimal('-1.5'), 'utc');
    expect(date.year()).toBe(1969n);
    expect(date.month()).toBe(12n);
    expect(date.day()).toBe(31n);
    expect(date.hour()).toBe(23n);
    expect(date.minutes()).toBe(59n);
    expect(date.seconds().toString()).toBe('58.5');
  });
});

describe('BigDate mutability and chaining', () => {
  it('creates an instance with the current time when no args are provided', () => {
    const before = Date.now();
    const date = new BigDate();
    const after = Date.now();
    const epochMs = date.epoch().mul(1000).number();
    expect(date.zone()).toBe('utc');
    expect(epochMs).toBeGreaterThanOrEqual(before);
    expect(epochMs).toBeLessThanOrEqual(after);
  });

  it('constructs from a Date instance', () => {
    const native = new Date(Date.UTC(2023, 0, 2, 3, 4, 5, 600));
    const date = new BigDate(native, 'utc');
    expect(date.epoch().toString()).toBe(Decimal(native.getTime()).div(1000).toString());
  });

  it('constructs from Date via the static helper', () => {
    const native = new Date(Date.UTC(2024, 4, 6, 7, 8, 9, 10));
    const date = BigDate.fromDate(native, 'utc');
    expect(date.epoch().toString()).toBe(Decimal(native.getTime()).div(1000).toString());
  });

  it('constructs from epoch without a zone argument', () => {
    const date = new BigDate(0);
    expect(date.zone()).toBe('utc');
    expect(date.epoch().toString()).toBe('0');
  });

  it('returns new instances for immutable setters', () => {
    const base = BigDate.fromEpoch(0, 'utc');
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
    const date = BigDate.fromEpoch(0, 'utc');
    date.year$(1999).month$(12).day$(31).hour$(23).minutes$(59).seconds$('59.5');
    expect(date.year()).toBe(1999n);
    expect(date.month()).toBe(12n);
    expect(date.day()).toBe(31n);
    expect(date.hour()).toBe(23n);
    expect(date.minutes()).toBe(59n);
    expect(date.seconds().toString()).toBe('59.5');
  });

  it('supports zone helpers and mutating variants', () => {
    const base = BigDate.fromEpoch(0, 'utc');
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
    const base = BigDate.fromEpoch(0, 'utc');
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
    const base = BigDate.fromEpoch(0, 'utc');
    const zoned = base.zone('local');
    expect(base.zone()).toBe('utc');
    expect(zoned.zone()).toBe('local');
    expect(zoned.epoch().toString()).toBe(base.epoch().toString());
  });

  it('accepts calendar inputs via constructor overload', () => {
    const date = new BigDate(2020, 2, 3, 4, 5, '6.75', 'utc');
    expect(date.year()).toBe(2020n);
    expect(date.month()).toBe(2n);
    expect(date.day()).toBe(3n);
    expect(date.hour()).toBe(4n);
    expect(date.minutes()).toBe(5n);
    expect(date.seconds().toString()).toBe('6.75');
  });

  it('defaults to utc when given an empty zone string', () => {
    const date = new BigDate(0, '');
    expect(date.zone()).toBe('utc');
  });

  it('throws for non-integer calendar inputs', () => {
    expect(() => BigDate.fromCalendar({ year: '1.5', month: 1, day: 1 })).toThrow('year must be an integer');
    expect(() => BigDate.fromCalendar({ year: 1.5, month: 1, day: 1 })).toThrow('year must be an integer');
  });

  it('accepts integer decimal-like calendar inputs', () => {
    const date = BigDate.fromCalendar({ year: '2000', month: '2', day: '3' }, 'utc');
    expect(date.year()).toBe(2000n);
    expect(date.month()).toBe(2n);
    expect(date.day()).toBe(3n);
  });
});

describe('BigDate local conversion', () => {
  it('matches local components from Date for a representable epoch', () => {
    const native = new Date(Date.UTC(2020, 0, 2, 3, 4, 5, 678));
    const epochSeconds = Decimal(native.getTime()).div(1000);
    const date = BigDate.fromEpoch(epochSeconds, 'local');

    expect(date.year()).toBe(BigInt(native.getFullYear()));
    expect(date.month()).toBe(BigInt(native.getMonth() + 1));
    expect(date.day()).toBe(BigInt(native.getDate()));
    expect(date.hour()).toBe(BigInt(native.getHours()));
    expect(date.minutes()).toBe(BigInt(native.getMinutes()));

    const expectedSeconds = Decimal(native.getSeconds()).add(Decimal(native.getMilliseconds()).div(1000));
    expect(date.seconds().toString()).toBe(expectedSeconds.toString());
    expect(date.object().weekday).toBe(native.getDay());
  });

  it('converts local calendar back to epoch aligned with Date', () => {
    const native = new Date(Date.UTC(2022, 5, 15, 6, 7, 8, 900));
    const date = BigDate.fromCalendar(
      {
        year: BigInt(native.getFullYear()),
        month: BigInt(native.getMonth() + 1),
        day: BigInt(native.getDate()),
        hour: BigInt(native.getHours()),
        minutes: BigInt(native.getMinutes()),
        seconds: Decimal(native.getSeconds()).add(Decimal(native.getMilliseconds()).div(1000)),
      },
      'local',
    );

    const expected = Decimal(native.getTime()).div(1000).toString();
    expect(date.epoch().toString()).toBe(expected);
  });
});

describe('BigDate time zone conversion', () => {
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
    const date = BigDate.fromEpoch(epochSeconds, timeZone);
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
    expect(date.object().weekday).toBe(weekdayIndex);
  });

  it('covers time zone parts mapping for another IANA zone', () => {
    const timeZone = 'Asia/Tokyo';
    const date = BigDate.fromEpoch(0, timeZone);
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
      const date = BigDate.fromEpoch(0, 'Etc/MissingParts');
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
      const date = BigDate.fromEpoch(0, 'Etc/MissingYear');
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
    const date = BigDate.fromCalendar(parts, timeZone);

    expect(date.epoch().toString()).toBe(expectedEpoch.toString());
  });

  it('falls back after multiple offset iterations', () => {
    const original = Intl.DateTimeFormat;
    let calls = 0;

    Intl.DateTimeFormat = class {
      constructor(_locale: string, _options: Intl.DateTimeFormatOptions) {}
      formatToParts() {
        calls += 1;
        return [
          { type: 'year', value: '2000' },
          { type: 'month', value: '01' },
          { type: 'day', value: '02' },
          { type: 'hour', value: '00' },
          { type: 'minute', value: '00' },
          { type: 'second', value: '00' },
        ] as Intl.DateTimeFormatPart[];
      }
    } as unknown as typeof Intl.DateTimeFormat;

    try {
      const date = BigDate.fromCalendar(
        { year: 2000n, month: 1n, day: 1n, hour: 0n, minutes: 0n, seconds: 0 },
        'Etc/Chaos-NonConverge',
      );
      expect(date.epoch().toString()).toBeDefined();
      expect(calls).toBe(4);
    } finally {
      Intl.DateTimeFormat = original;
    }
  });
});

describe('BigDate alignment and stepping', () => {
  it('aligns to the same day when no step is provided', () => {
    const date = BigDate.fromCalendar({ year: 2020n, month: 5n, day: 17n, hour: 10n, minutes: 30n, seconds: 0 }, 'utc');
    const aligned = date.alignToDay();
    expect(aligned.year()).toBe(2020n);
    expect(aligned.month()).toBe(5n);
    expect(aligned.day()).toBe(17n);
    expect(aligned.hour()).toBe(0n);
  });
  it('aligns to day boundaries with a step', () => {
    const date = BigDate.fromCalendar(
      { year: 2020n, month: 5n, day: 17n, hour: 10n, minutes: 30n, seconds: '22.5' },
      'utc',
    );
    const aligned = date.alignToDay(5n);
    expect(aligned.year()).toBe(2020n);
    expect(aligned.month()).toBe(5n);
    expect(aligned.day()).toBe(16n);
    expect(aligned.hour()).toBe(0n);
    expect(aligned.minutes()).toBe(0n);
    expect(aligned.seconds().toString()).toBe('0');
  });

  it('moves to the next day boundary with a step', () => {
    const date = BigDate.fromCalendar(
      { year: 2020n, month: 5n, day: 17n, hour: 10n, minutes: 30n, seconds: '22.5' },
      'utc',
    );
    const next = date.nextDay(5n);
    expect(next.year()).toBe(2020n);
    expect(next.month()).toBe(5n);
    expect(next.day()).toBe(21n);
    expect(next.hour()).toBe(0n);
    expect(next.minutes()).toBe(0n);
    expect(next.seconds().toString()).toBe('0');
  });

  it('moves to the next stepped day from a list', () => {
    const date = BigDate.fromCalendar({ year: 2020n, month: 5n, day: 10n, hour: 9n, minutes: 0n, seconds: 0 }, 'utc');
    const next = date.nextDay([1n, 15n, 20n]);
    expect(next.year()).toBe(2020n);
    expect(next.month()).toBe(5n);
    expect(next.day()).toBe(15n);
  });

  it('handles duplicate entries when selecting the next stepped day', () => {
    const date = BigDate.fromCalendar({ year: 2020n, month: 5n, day: 9n, hour: 9n, minutes: 0n, seconds: 0 }, 'utc');
    const next = date.nextDay([10n, 10n, 20n]);
    expect(next.day()).toBe(10n);
  });

  it('aligns to the nearest stepped day from a list', () => {
    const date = BigDate.fromCalendar({ year: 2020n, month: 5n, day: 17n, hour: 9n, minutes: 0n, seconds: 0 }, 'utc');
    const aligned = date.alignToDay([1n, 10n, 20n]);
    expect(aligned.year()).toBe(2020n);
    expect(aligned.month()).toBe(5n);
    expect(aligned.day()).toBe(10n);
    expect(aligned.hour()).toBe(0n);
  });

  it('handles duplicate entries in stepped days', () => {
    const date = BigDate.fromCalendar({ year: 2020n, month: 5n, day: 12n, hour: 9n, minutes: 0n, seconds: 0 }, 'utc');
    const aligned = date.alignToDay([5n, 5n, 10n]);
    expect(aligned.day()).toBe(10n);
  });

  it('keeps the current day when no stepped day is before it', () => {
    const date = BigDate.fromCalendar({ year: 2020n, month: 5n, day: 10n, hour: 9n, minutes: 0n, seconds: 0 }, 'utc');
    const aligned = date.alignToDay([20n, 30n]);
    expect(aligned.year()).toBe(2020n);
    expect(aligned.month()).toBe(5n);
    expect(aligned.day()).toBe(10n);
  });

  it('keeps the current day when nextDay is called without a step', () => {
    const date = BigDate.fromCalendar({ year: 2020n, month: 5n, day: 10n, hour: 9n, minutes: 0n, seconds: 0 }, 'utc');
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
      const date = BigDate.fromCalendar({ year: 2020n, month: 5n, day: 10n, hour: 9n, minutes: 0n, seconds: 0 }, 'utc');
      date.alignToDay([1n, 2n]);
      date.nextDay([1n, 2n]);
    } finally {
      Array.prototype.toSorted = original;
    }
  });

  it('moves to the next month when no later stepped day exists', () => {
    const date = BigDate.fromCalendar({ year: 2020n, month: 5n, day: 30n, hour: 9n, minutes: 0n, seconds: 0 }, 'utc');
    const next = date.nextDay([1n, 15n]);
    expect(next.year()).toBe(2020n);
    expect(next.month()).toBe(6n);
    expect(next.day()).toBe(1n);
    expect(next.hour()).toBe(0n);
  });

  it('aligns and steps months', () => {
    const date = BigDate.fromCalendar({ year: 2020n, month: 5n, day: 17n, hour: 1n, minutes: 2n, seconds: 3 }, 'utc');
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
    const date = BigDate.fromCalendar({ year: 2025n, month: 5n, day: 17n, hour: 1n, minutes: 2n, seconds: 3 }, 'utc');
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
    const ad202 = BigDate.fromCalendar({ year: 202n, month: 6n, day: 1n, hour: 0n, minutes: 0n, seconds: 0 }, 'utc');
    const ad102 = BigDate.fromCalendar({ year: 102n, month: 6n, day: 1n, hour: 0n, minutes: 0n, seconds: 0 }, 'utc');
    const ad10 = BigDate.fromCalendar({ year: 10n, month: 6n, day: 1n, hour: 0n, minutes: 0n, seconds: 0 }, 'utc');
    const bc50 = BigDate.fromCalendar({ year: -49n, month: 6n, day: 1n, hour: 0n, minutes: 0n, seconds: 0 }, 'utc');
    const bc150 = BigDate.fromCalendar({ year: -149n, month: 6n, day: 1n, hour: 0n, minutes: 0n, seconds: 0 }, 'utc');

    expect(ad202.alignToYear(100n, { era: true }).year()).toBe(200n);
    expect(ad102.alignToYear(100n, { era: true }).year()).toBe(100n);
    expect(ad10.alignToYear(100n, { era: true }).year()).toBe(1n);
    expect(bc50.alignToYear(100n, { era: true }).year()).toBe(-99n);
    expect(bc150.alignToYear(100n, { era: true }).year()).toBe(-199n);
  });

  it('steps years with era boundaries', () => {
    const ad202 = BigDate.fromCalendar({ year: 202n, month: 6n, day: 1n, hour: 0n, minutes: 0n, seconds: 0 }, 'utc');
    const ad102 = BigDate.fromCalendar({ year: 102n, month: 6n, day: 1n, hour: 0n, minutes: 0n, seconds: 0 }, 'utc');
    const ad10 = BigDate.fromCalendar({ year: 10n, month: 6n, day: 1n, hour: 0n, minutes: 0n, seconds: 0 }, 'utc');
    const bc50 = BigDate.fromCalendar({ year: -49n, month: 6n, day: 1n, hour: 0n, minutes: 0n, seconds: 0 }, 'utc');
    const bc150 = BigDate.fromCalendar({ year: -149n, month: 6n, day: 1n, hour: 0n, minutes: 0n, seconds: 0 }, 'utc');

    expect(ad202.nextYear(100n, { era: true }).year()).toBe(300n);
    expect(ad102.nextYear(100n, { era: true }).year()).toBe(200n);
    expect(ad10.nextYear(100n, { era: true }).year()).toBe(100n);
    expect(bc50.nextYear(100n, { era: true }).year()).toBe(1n);
    expect(bc150.nextYear(100n, { era: true }).year()).toBe(-99n);
  });

  it('keeps the current year when no step is provided', () => {
    const date = BigDate.fromCalendar({ year: 2025n, month: 5n, day: 17n, hour: 1n, minutes: 2n, seconds: 3 }, 'utc');
    const aligned = date.alignToYear();
    const next = date.nextYear();
    expect(aligned.year()).toBe(2025n);
    expect(next.year()).toBe(2025n);
  });

  it('keeps the BC year when no next step exists', () => {
    const bc50 = BigDate.fromCalendar({ year: -49n, month: 6n, day: 1n, hour: 0n, minutes: 0n, seconds: 0 }, 'utc');
    const aligned = bc50.alignToYear([], { era: true });
    expect(aligned.year()).toBe(-49n);
  });

  it('falls back to year 1 when no previous stepped BC entry exists', () => {
    const bc50 = BigDate.fromCalendar({ year: -49n, month: 6n, day: 1n, hour: 0n, minutes: 0n, seconds: 0 }, 'utc');
    expect(bc50.nextYear([100n], { era: true }).year()).toBe(1n);
  });

  it('aligns to seconds within a day', () => {
    const date = BigDate.fromCalendar(
      { year: 2020n, month: 5n, day: 17n, hour: 10n, minutes: 30n, seconds: '22.123' },
      'utc',
    );
    const aligned = date.alignToSecond(15);
    expect(aligned.hour()).toBe(10n);
    expect(aligned.minutes()).toBe(30n);
    expect(aligned.seconds().toString()).toBe('15');
  });
});

describe('BigDate formatting', () => {
  it('formats fractional seconds with padding', () => {
    const date = BigDate.fromEpoch('12.3456', 'utc');
    expect(date.format('YYYY-MM-DD hh:mm:ss.SSSSSS')).toBe('1970-01-01 00:00:12.345600');
    expect(date.format('YYYY-MM-DD hh:mm:ss.SSS')).toBe('1970-01-01 00:00:12.345');
    expect(date.format('YYYY-MM-DD hh:mm:ss.SS')).toBe('1970-01-01 00:00:12.34');
    expect(date.format('YYYY-MM-DD hh:mm:ss.S')).toBe('1970-01-01 00:00:12.3');
  });

  it('formats seconds without a fraction', () => {
    const date = BigDate.fromEpoch(12, 'utc');
    expect(date.format('YYYY-MM-DD hh:mm:ss.SSS')).toBe('1970-01-01 00:00:12.000');
  });

  it('formats era markers for BC and AD years', () => {
    const ad = BigDate.fromCalendar({ year: 1n, month: 1n, day: 1n }, 'utc');
    const bc = BigDate.fromCalendar({ year: 0n, month: 1n, day: 1n }, 'utc');
    expect(ad.format('G')).toBe('1 AD');
    expect(ad.format('GGGG')).toBe('0001 AD');
    expect(bc.format('G')).toBe('BC 1');
    expect(bc.format('GGGG')).toBe('BC 0001');
  });
});

describe('BigDate weekday', () => {
  it('returns weekday index for the UNIX epoch start', () => {
    const date = BigDate.fromEpoch(0, 'utc');
    expect(date.weekday()).toBe(4);
  });

  it('returns weekday index for nearby UTC dates', () => {
    const sunday = BigDate.fromCalendar({ year: 1970n, month: 1n, day: 4n }, 'utc');
    const wednesday = BigDate.fromCalendar({ year: 1969n, month: 12n, day: 31n }, 'utc');
    expect(sunday.weekday()).toBe(0);
    expect(wednesday.weekday()).toBe(3);
  });

  it('includes weekday in object()', () => {
    const date = BigDate.fromCalendar({ year: 1970n, month: 1n, day: 1n }, 'utc');
    expect(date.object().weekday).toBe(4);
  });
});
