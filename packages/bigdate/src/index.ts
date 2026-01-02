import { Decimal, type DecimalLike } from '@kikuchan/decimal';

type Zone = string;

type CalendarInput = {
  year: bigint | number | DecimalLike;
  month: bigint | number | DecimalLike;
  day: bigint | number | DecimalLike;
  hour?: bigint | number | DecimalLike;
  minutes?: bigint | number | DecimalLike;
  seconds?: DecimalLike;
};

type CalendarComponents = {
  year: bigint;
  month: bigint;
  day: bigint;
  hour: bigint;
  minutes: bigint;
  seconds: Decimal;
  weekday: number;
};

type Step = bigint | number | (bigint | number)[] | undefined;
type YearStepOptions = {
  era?: boolean;
};

const SECONDS_PER_DAY = 86_400n;
const SECONDS_PER_HOUR = 3_600n;
const SECONDS_PER_MINUTE = 60n;

const MIN_DATE_MS = Decimal(-8_640_000_000_000_000n);
const MAX_DATE_MS = Decimal(8_640_000_000_000_000n);

function toBigInt(value: bigint | number | DecimalLike, name: string): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) throw new Error(`${name} must be an integer`);
    return BigInt(value);
  }
  const decimal = Decimal(value);
  const integer = decimal.integer();
  if (!decimal.eq(integer)) throw new Error(`${name} must be an integer`);
  return integer;
}

function divFloor(a: bigint, b: bigint): bigint {
  const q = a / b;
  const r = a % b;
  if (r === 0n) return q;
  const negative = a < 0n !== b < 0n;
  return negative ? q - 1n : q;
}

function normalizeMonth(year: bigint, month: bigint): { year: bigint; month: bigint } {
  const monthIndex = month - 1n;
  const yearShift = divFloor(monthIndex, 12n);
  const normalizedMonth = monthIndex - yearShift * 12n + 1n;
  return { year: year + yearShift, month: normalizedMonth };
}

function normalizeDate(
  year: bigint,
  month: bigint,
  day: bigint,
): { year: bigint; month: bigint; day: bigint; weekday: number } {
  return civilFromDays(daysFromCivil(year, month, day));
}

function alignToStep(value: bigint, step: Step, offset: bigint = 0n): bigint {
  if (!step) return value;

  if (Array.isArray(step)) {
    return (
      step
        .map((entry) => BigInt(entry))
        .filter((entry) => entry <= value)
        .toSorted((a, b) => (a < b ? -1 : a > b ? 1 : 0))
        .at(-1) ?? value
    );
  }

  const stepValue = BigInt(step);
  return ((value - offset) / stepValue) * stepValue + offset;
}

function nextToStep(value: bigint, step: Step, offset: bigint = 0n): bigint | undefined {
  if (!step) return value;

  if (Array.isArray(step)) {
    return step
      .map((entry) => BigInt(entry))
      .filter((entry) => value < entry)
      .toSorted((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .at(0);
  }

  const stepValue = BigInt(step);
  return ((value - offset) / stepValue + 1n) * stepValue + offset;
}

function alignToYearStep(year: bigint, step: Step, options?: YearStepOptions): bigint {
  if (!step) return year;
  if (!options?.era) return alignToStep(year, step, 0n);
  if (year > 0n) {
    const aligned = alignToStep(year, step, 0n);
    return aligned === 0n ? 1n : aligned;
  }

  const bcYear = -year + 1n;
  const alignedBc = nextToStep(bcYear - 1n, step, 0n);
  return alignedBc === undefined ? year : -(alignedBc - 1n);
}

function nextToYearStep(year: bigint, step: Step, options?: YearStepOptions): bigint {
  if (!step) return year;
  if (!options?.era) return nextToStep(year, step, 0n)!;
  if (year > 0n) return nextToStep(year, step, 0n)!;

  const bcYear = -year + 1n;
  const previousBc = alignToStep(bcYear - 1n, step, 0n);
  if (Array.isArray(step)) {
    const hasPrevious = step.map((entry) => BigInt(entry)).some((entry) => entry === previousBc);
    if (!hasPrevious) return 1n;
  }
  if (previousBc <= 0n) return 1n;
  return -(previousBc - 1n);
}

function daysFromCivil(yearInput: bigint, monthInput: bigint, dayInput: bigint): bigint {
  const { year: normalizedYear, month: normalizedMonth } = normalizeMonth(yearInput, monthInput);
  const dayOffset = dayInput - 1n;
  let year = normalizedYear;
  const month = normalizedMonth;
  year -= month <= 2n ? 1n : 0n;
  const era = divFloor(year, 400n);
  const yoe = year - era * 400n;
  const monthIndex = month + (month > 2n ? -3n : 9n);
  const doy = divFloor(153n * monthIndex + 2n, 5n);
  const doe = yoe * 365n + divFloor(yoe, 4n) - divFloor(yoe, 100n) + doy;
  return era * 146_097n + doe - 719_468n + dayOffset;
}

function civilFromDays(days: bigint): { year: bigint; month: bigint; day: bigint; weekday: number } {
  const z = days + 719_468n;
  const era = divFloor(z, 146_097n);
  const doe = z - era * 146_097n;
  const yoe = divFloor(doe - divFloor(doe, 1_460n) + divFloor(doe, 36_524n) - divFloor(doe, 146_096n), 365n);
  let year = yoe + era * 400n;
  const doy = doe - (365n * yoe + divFloor(yoe, 4n) - divFloor(yoe, 100n));
  const mp = divFloor(5n * doy + 2n, 153n);
  const day = doy - divFloor(153n * mp + 2n, 5n) + 1n;
  const month = mp + (mp < 10n ? 3n : -9n);
  year += month <= 2n ? 1n : 0n;
  const weekday = Number((((days + 4n) % 7n) + 7n) % 7n);
  return { year, month, day, weekday };
}

function getTimeZoneFormatter(timeZone: string) {
  const cache = getTimeZoneFormatter.cache ?? new Map<string, Intl.DateTimeFormat>();
  getTimeZoneFormatter.cache = cache;
  let formatter = cache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    cache.set(timeZone, formatter);
  }
  return formatter;
}

getTimeZoneFormatter.cache = undefined as Map<string, Intl.DateTimeFormat> | undefined;

function offsetMinutesForEpoch(epochSeconds: Decimal, zone: Zone): number {
  if (zone.toLowerCase() === 'utc') return 0;
  const clamped = epochSeconds.mul(1000).clamp(MIN_DATE_MS, MAX_DATE_MS);
  const date = new Date(clamped.number());
  if (zone.toLowerCase() === 'local') {
    return date.getTimezoneOffset();
  }

  const map = new Map(
    getTimeZoneFormatter(zone)
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  const year = BigInt(map.get('year') ?? '0');
  const month = BigInt(map.get('month') ?? '0');
  const day = BigInt(map.get('day') ?? '0');
  const hour = BigInt(map.get('hour') ?? '0');
  const minutes = BigInt(map.get('minute') ?? '0');
  const seconds = BigInt(map.get('second') ?? '0');
  const localSeconds = Decimal(daysFromCivil(year, month, day))
    .mul(SECONDS_PER_DAY)
    .add(hour * SECONDS_PER_HOUR + minutes * SECONDS_PER_MINUTE + seconds)
    .add(Decimal(date.getUTCMilliseconds()).div(1000));
  const utcSeconds = clamped.div(1000);
  const offsetMinutes = utcSeconds.sub(localSeconds).div(60).trunc(0, true);
  return offsetMinutes.number();
}

function epochToComponents(epochSeconds: Decimal, zone: Zone): CalendarComponents {
  const offsetMinutes = offsetMinutesForEpoch(epochSeconds, zone);
  const adjusted =
    offsetMinutes === 0 ? epochSeconds : epochSeconds.sub(Decimal(offsetMinutes).mul(SECONDS_PER_MINUTE));
  const day = divFloor(adjusted.floor(0).integer(), SECONDS_PER_DAY);
  const secondsOfDay = adjusted.sub(Decimal(day * SECONDS_PER_DAY));
  const timeInteger = secondsOfDay.floor(0).integer();
  const fraction = secondsOfDay.sub(Decimal(timeInteger));
  const hour = timeInteger / SECONDS_PER_HOUR;
  const minute = (timeInteger % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE;
  const second = timeInteger % SECONDS_PER_MINUTE;
  const { year, month, day: calendarDay, weekday } = civilFromDays(day);

  return {
    year,
    month,
    day: calendarDay,
    hour,
    minutes: minute,
    seconds: Decimal(second).add(fraction),
    weekday,
  };
}

function calendarToEpoch(components: CalendarComponents, zone: Zone): Decimal {
  const localEpoch = Decimal(daysFromCivil(components.year, components.month, components.day))
    .mul(SECONDS_PER_DAY)
    .add(Decimal(components.hour * SECONDS_PER_HOUR + components.minutes * SECONDS_PER_MINUTE).add(components.seconds));
  if (zone.toLowerCase() === 'utc') return localEpoch;

  let utcEpoch = localEpoch;
  for (let i = 0; i < 4; i++) {
    const offsetMinutes = offsetMinutesForEpoch(utcEpoch, zone);
    const candidate = localEpoch.add(Decimal(offsetMinutes).mul(SECONDS_PER_MINUTE));
    if (candidate.eq(utcEpoch)) return candidate;
    utcEpoch = candidate;
  }
  return utcEpoch;
}

function normalizeCalendarInput(input: CalendarInput): CalendarComponents {
  const year = toBigInt(input.year, 'year');
  const month = toBigInt(input.month, 'month');
  const day = toBigInt(input.day, 'day');
  return {
    year,
    month,
    day,
    hour: input.hour == null ? 0n : toBigInt(input.hour, 'hour'),
    minutes: input.minutes == null ? 0n : toBigInt(input.minutes, 'minutes'),
    seconds: input.seconds == null ? Decimal(0) : Decimal(input.seconds),
    weekday: civilFromDays(daysFromCivil(year, month, day)).weekday,
  };
}

function ensureZone(value: string | undefined): Zone {
  if (value) return value;
  return 'utc';
}

export class BigDate {
  #epoch: Decimal;
  #zone: Zone;

  constructor();
  constructor(dateLike: DecimalLike | Date, zone?: Zone);
  constructor(
    year: bigint | number,
    month: bigint | number,
    day: bigint | number,
    hour?: bigint | number,
    minutes?: bigint | number,
    seconds?: DecimalLike,
    zone?: Zone,
  );
  constructor(...args: (bigint | number | DecimalLike | Date | Zone | undefined)[]) {
    if (args.length === 0) {
      this.#epoch = Decimal(Date.now()).div(1000);
      this.#zone = 'utc';
      return;
    }

    const zone =
      (args.length === 7 || args.length === 2) && typeof args[args.length - 1] === 'string'
        ? ensureZone(args[args.length - 1] as string)
        : 'utc';

    if (args.length >= 3 && typeof args[0] !== 'object') {
      const [year, month, day, hour, minutes, seconds] = args as [
        bigint | number,
        bigint | number,
        bigint | number,
        bigint | number | undefined,
        bigint | number | undefined,
        DecimalLike | undefined,
      ];
      const components = normalizeCalendarInput({
        year,
        month,
        day,
        hour,
        minutes,
        seconds,
      });
      this.#epoch = calendarToEpoch(components, zone);
      this.#zone = zone;
      return;
    }

    this.#zone = zone;
    if (args[0] instanceof Date) {
      this.#epoch = Decimal(args[0].getTime()).div(1000);
      return;
    }
    // TODO: parse string date representation
    this.#epoch = Decimal(args[0] as DecimalLike);
    return;
  }

  static fromEpoch(epochSeconds: DecimalLike, zone: Zone = 'utc') {
    return new BigDate(epochSeconds, zone);
  }

  static fromDate(date: Date, zone: Zone = 'utc') {
    return new BigDate(date, zone);
  }

  static fromCalendar(input: CalendarInput, zone: Zone = 'utc') {
    const components = normalizeCalendarInput(input);
    const epoch = calendarToEpoch(components, zone);
    return new BigDate(epoch, zone);
  }

  clone() {
    return new BigDate(this.#epoch, this.#zone);
  }

  zone(): Zone;
  zone(value: Zone): BigDate;
  zone(value?: Zone) {
    if (value === undefined) return this.#zone;
    return new BigDate(this.#epoch, value);
  }

  zone$(value: Zone) {
    this.#zone = value;
    return this;
  }

  utc() {
    return this.zone('utc');
  }

  utc$() {
    return this.zone$('utc');
  }

  local() {
    return this.zone('local');
  }

  local$() {
    return this.zone$('local');
  }

  epoch(): Decimal;
  epoch(value: DecimalLike): BigDate;
  epoch(value?: DecimalLike) {
    if (value === undefined) return this.#epoch.clone();
    return new BigDate(value, this.#zone);
  }

  epoch$(value: DecimalLike) {
    this.#epoch = Decimal(value);
    return this;
  }

  object() {
    return epochToComponents(this.#epoch, this.#zone);
  }

  #withComponents(update: Partial<CalendarComponents>, mutate: boolean) {
    const current = this.object();
    const next: CalendarComponents = {
      year: update.year ?? current.year,
      month: update.month ?? current.month,
      day: update.day ?? current.day,
      hour: update.hour ?? current.hour,
      minutes: update.minutes ?? current.minutes,
      seconds: update.seconds ?? current.seconds,
      weekday: current.weekday,
    };
    const epoch = calendarToEpoch(next, this.#zone);
    if (mutate) {
      this.#epoch = epoch;
      return this;
    }
    return new BigDate(epoch, this.#zone);
  }

  #withAlignedDate(adjuster: (current: CalendarComponents) => { year: bigint; month: bigint; day: bigint }) {
    const current = this.object();
    const next: CalendarComponents = {
      ...adjuster(current),
      hour: 0n,
      minutes: 0n,
      seconds: Decimal(0),
      weekday: current.weekday,
    };
    const epoch = calendarToEpoch(next, this.#zone);
    return new BigDate(epoch, this.#zone);
  }

  year(): bigint;
  year(value: bigint | number | DecimalLike): BigDate;
  year(value?: bigint | number | DecimalLike) {
    if (value === undefined) return this.object().year;
    return this.#withComponents({ year: toBigInt(value, 'year') }, false);
  }

  year$(value: bigint | number | DecimalLike) {
    return this.#withComponents({ year: toBigInt(value, 'year') }, true);
  }

  month(): bigint;
  month(value: bigint | number | DecimalLike): BigDate;
  month(value?: bigint | number | DecimalLike) {
    if (value === undefined) return this.object().month;
    return this.#withComponents({ month: toBigInt(value, 'month') }, false);
  }

  month$(value: bigint | number | DecimalLike) {
    return this.#withComponents({ month: toBigInt(value, 'month') }, true);
  }

  day(): bigint;
  day(value: bigint | number | DecimalLike): BigDate;
  day(value?: bigint | number | DecimalLike) {
    if (value === undefined) return this.object().day;
    return this.#withComponents({ day: toBigInt(value, 'day') }, false);
  }

  day$(value: bigint | number | DecimalLike) {
    return this.#withComponents({ day: toBigInt(value, 'day') }, true);
  }

  hour(): bigint;
  hour(value: bigint | number | DecimalLike): BigDate;
  hour(value?: bigint | number | DecimalLike) {
    if (value === undefined) return this.object().hour;
    return this.#withComponents({ hour: toBigInt(value, 'hour') }, false);
  }

  hour$(value: bigint | number | DecimalLike) {
    return this.#withComponents({ hour: toBigInt(value, 'hour') }, true);
  }

  minutes(): bigint;
  minutes(value: bigint | number | DecimalLike): BigDate;
  minutes(value?: bigint | number | DecimalLike) {
    if (value === undefined) return this.object().minutes;
    return this.#withComponents({ minutes: toBigInt(value, 'minutes') }, false);
  }

  minutes$(value: bigint | number | DecimalLike) {
    return this.#withComponents({ minutes: toBigInt(value, 'minutes') }, true);
  }

  seconds(): Decimal;
  seconds(value: DecimalLike): BigDate;
  seconds(value?: DecimalLike) {
    if (value === undefined) return this.object().seconds.clone();
    return this.#withComponents({ seconds: Decimal(value) }, false);
  }

  seconds$(value: DecimalLike) {
    return this.#withComponents({ seconds: Decimal(value) }, true);
  }

  weekday() {
    return this.object().weekday;
  }

  alignToDay(step?: Step) {
    return this.#withAlignedDate((current) =>
      normalizeDate(current.year, current.month, alignToStep(current.day, step, 1n)),
    );
  }

  nextDay(step?: Step) {
    return this.#withAlignedDate((current) => {
      const next = nextToStep(current.day, step, 1n);
      if (next === undefined) {
        const { year, month } = normalizeMonth(current.year, current.month + 1n);
        return { year, month, day: 1n };
      }
      return normalizeDate(current.year, current.month, next);
    });
  }

  alignToMonth(step?: Step) {
    return this.#withAlignedDate((current) => {
      const { year, month } = normalizeMonth(current.year, alignToStep(current.month, step, 1n));
      return { year, month, day: 1n };
    });
  }

  nextMonth(step?: Step) {
    return this.#withAlignedDate((current) => {
      const { year, month } = normalizeMonth(current.year, nextToStep(current.month, step, 1n)!);
      return { year, month, day: 1n };
    });
  }

  alignToYear(step?: Step, options?: YearStepOptions) {
    return this.#withAlignedDate((current) => {
      return { year: alignToYearStep(current.year, step, options), month: 1n, day: 1n };
    });
  }

  nextYear(step?: Step, options?: YearStepOptions) {
    return this.#withAlignedDate((current) => {
      return { year: nextToYearStep(current.year, step, options), month: 1n, day: 1n };
    });
  }

  alignToSecond(step: DecimalLike) {
    const dayStart = this.alignToDay(1n);
    const aligned = this.#epoch.sub(dayStart.epoch()).floorBy(Decimal(step)).add(dayStart.epoch());
    return new BigDate(aligned, this.#zone);
  }

  format(fmt: string) {
    const parts = this.object();
    const year = parts.year.toString();
    const month = parts.month.toString();
    const day = parts.day.toString();
    const hour = parts.hour.toString();
    const minutes = parts.minutes.toString();
    const seconds = parts.seconds;
    const secondsString = seconds.toString();
    const dotIndex = secondsString.indexOf('.');
    const fraction = dotIndex >= 0 ? secondsString.slice(dotIndex + 1) : '';

    const bc = parts.year <= 0 ? 'BC ' : '';
    const ad = parts.year > 0 ? ' AD' : '';
    const eyear = parts.year <= 0 ? (1n - parts.year).toString() : parts.year.toString();

    const replacements: Record<string, string> = {
      gggg: `${bc}${eyear.padStart(4, '0')}`,
      GGGG: `${bc}${eyear.padStart(4, '0')}${ad}`,
      g: `${bc}${eyear}`,
      G: `${bc}${eyear}${ad}`,
      yyyy: year.padStart(4, '0'),
      YYYY: year.padStart(4, '0'),
      y: year,
      MM: month.padStart(2, '0'),
      DD: day.padStart(2, '0'),
      hh: hour.padStart(2, '0'),
      mm: minutes.padStart(2, '0'),
      ss: seconds.floor().toString().padStart(2, '0'),
      SSSSSS: fraction.padEnd(6, '0').slice(0, 6),
      SSS: fraction.padEnd(3, '0').slice(0, 3),
      SS: fraction.padEnd(2, '0').slice(0, 2),
      S: fraction.padEnd(1, '0').slice(0, 1),
    };

    let formatted = fmt;
    for (const [key, value] of Object.entries(replacements)) {
      formatted = formatted.replace(key, value);
    }
    return formatted;
  }
}
