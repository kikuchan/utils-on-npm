import { Decimal, type DecimalLike } from '@kikuchan/decimal';

type Zone = string;

type CalendarInput = {
  year: bigint | number | DecimalLike;
  month: bigint | number | DecimalLike;
  day: bigint | number | DecimalLike;
  hour?: bigint | number | DecimalLike;
  minutes?: bigint | number | DecimalLike;
  seconds?: DecimalLike;
  zone?: Zone;
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

type FormatTokenBase = {
  token: string;
  kind: 'year' | 'month' | 'day' | 'hour' | 'minutes' | 'seconds' | 'fraction' | 'era' | 'offset';
  regex: string;
  minLength: number;
  format: (input: {
    year: string;
    month: string;
    day: string;
    hour: string;
    minutes: string;
    seconds: Decimal;
    fraction: string;
    eraYear: string;
    bc: string;
    ad: string;
    offsetMinutes: () => number;
  }) => string;
};

type FormatTokenWithMaxLength = FormatTokenBase & {
  kind: 'month' | 'day' | 'hour' | 'minutes' | 'seconds' | 'fraction';
  maxLength: number;
};

type FormatTokenWithoutMaxLength = FormatTokenBase & {
  kind: 'year' | 'era' | 'offset';
  maxLength?: undefined;
};

type FormatToken = FormatTokenWithMaxLength | FormatTokenWithoutMaxLength;

const SECONDS_PER_DAY = 86_400n;
const SECONDS_PER_HOUR = 3_600n;
const SECONDS_PER_MINUTE = 60n;

const MIN_DATE_MS = Decimal(-8_640_000_000_000_000n);
const MAX_DATE_MS = Decimal(8_640_000_000_000_000n);

function formatSignedYear(value: string, minDigits: number) {
  const negative = value.startsWith('-');
  const digits = negative ? value.slice(1) : value;
  const padded = digits.padStart(minDigits, '0');
  return negative ? `-${padded}` : padded;
}

function formatISOYear(value: string) {
  const year = BigInt(value);
  if (year >= 0n && year <= 9999n) return value.padStart(4, '0');
  return `${year < 0n ? '-' : '+'}${value.replace(/^-/, '').padStart(6, '0')}`;
}

function formatOffset(minutes: number) {
  if (minutes === 0) return 'Z';
  const absolute = Math.abs(minutes);
  return `${minutes < 0 ? '+' : '-'}${Math.floor(absolute / 60)
    .toString()
    .padStart(2, '0')}:${(absolute % 60).toString().padStart(2, '0')}`;
}

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
  if (Array.isArray(step) && !step.map((entry) => BigInt(entry)).some((entry) => entry === previousBc)) return 1n;
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
    .add(Decimal(date.getUTCMilliseconds()).divExact(1000));
  // Compare both sides at the native Date's precision, not the original fractional instant.
  const utcSeconds = Decimal(date.getTime()).divExact(1000);
  const offsetMinutes = utcSeconds.sub(localSeconds).divTrunc(60);
  return offsetMinutes.number();
}

function epochToComponents(epochSeconds: Decimal, zone: Zone): CalendarComponents {
  const offsetMinutes = offsetMinutesForEpoch(epochSeconds, zone);
  const adjusted =
    offsetMinutes === 0 ? epochSeconds : epochSeconds.sub(Decimal(offsetMinutes).mul(SECONDS_PER_MINUTE));
  const day = adjusted.divFloor(SECONDS_PER_DAY).integer();
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

  // Sample both sides of a transition, including full-day political offset changes.
  const offsets = new Set(
    [-2n, 0n, 2n].map((days) => offsetMinutesForEpoch(localEpoch.add(days * SECONDS_PER_DAY), zone)),
  );
  const candidates = [...offsets]
    .map((offset) => {
      const epoch = localEpoch.add(Decimal(offset).mul(SECONDS_PER_MINUTE));
      const actualOffset = offsetMinutesForEpoch(epoch, zone);
      return { epoch, shift: offset - actualOffset };
    })
    .sort((a, b) => (a.epoch.lt(b.epoch) ? -1 : a.epoch.gt(b.epoch) ? 1 : 0));
  // Overlaps choose the earlier instant; gaps move forward by the gap's duration.
  const exact = candidates.find(({ shift }) => shift === 0);
  if (exact) return exact.epoch;
  const forward = candidates.filter(({ shift }) => shift > 0).sort((a, b) => a.shift - b.shift);
  if (forward.length) return forward[0].epoch;
  throw new Error('could not resolve time zone offset');
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

const FORMAT_TOKENS: FormatToken[] = [
  {
    token: 'IY',
    kind: 'year',
    regex: '[+-]?\\d+',
    minLength: 1,
    format: ({ year }) => formatISOYear(year),
  },
  {
    token: 'Z',
    kind: 'offset',
    regex: '(?:Z|[+-]\\d{2}:?\\d{2})',
    minLength: 1,
    format: ({ offsetMinutes }) => formatOffset(offsetMinutes()),
  },
  {
    token: 'MM',
    kind: 'month',
    regex: '\\d{1,2}',
    minLength: 1,
    maxLength: 2,
    format: ({ month }) => month.padStart(2, '0'),
  },
  {
    token: 'M',
    kind: 'month',
    regex: '\\d{1,2}',
    minLength: 1,
    maxLength: 2,
    format: ({ month }) => month,
  },
  {
    token: 'DD',
    kind: 'day',
    regex: '\\d{1,2}',
    minLength: 1,
    maxLength: 2,
    format: ({ day }) => day.padStart(2, '0'),
  },
  {
    token: 'hh',
    kind: 'hour',
    regex: '\\d{1,2}',
    minLength: 1,
    maxLength: 2,
    format: ({ hour }) => hour.padStart(2, '0'),
  },
  {
    token: 'h',
    kind: 'hour',
    regex: '\\d{1,2}',
    minLength: 1,
    maxLength: 2,
    format: ({ hour }) => hour,
  },
  {
    token: 'mm',
    kind: 'minutes',
    regex: '\\d{1,2}',
    minLength: 1,
    maxLength: 2,
    format: ({ minutes }) => minutes.padStart(2, '0'),
  },
  {
    token: 'ss',
    kind: 'seconds',
    regex: '\\d{1,2}',
    minLength: 1,
    maxLength: 2,
    format: ({ seconds }) => seconds.floor().toString().padStart(2, '0'),
  },
];

function repeatedToken(value: string): FormatToken {
  const width = value.length;
  switch (value[0]) {
    case 'Y':
    case 'y':
      return {
        token: value,
        kind: 'year',
        regex: '[+-]?\\d+',
        minLength: 1,
        format: ({ year }) => formatSignedYear(year, width),
      };
    case 'G':
    case 'g':
      return {
        token: value,
        kind: 'era',
        regex: value[0] === 'G' ? '(?:BC ?\\d+|\\d+ ?AD)' : '(?:BC ?\\d+|\\d+)',
        minLength: 1,
        format: ({ bc, ad, eraYear }) => `${bc}${eraYear.padStart(width, '0')}${value[0] === 'G' ? ad : ''}`,
      };
    default:
      return {
        token: value,
        kind: 'fraction',
        regex: value === 'S*' ? '\\d+' : `\\d{1,${width}}`,
        minLength: 1,
        maxLength: value === 'S*' ? Infinity : width,
        format: ({ fraction }) =>
          value === 'S*' ? fraction.replace(/0+$/, '') || '0' : fraction.padEnd(width, '0').slice(0, width),
      };
  }
}

type FormatPart =
  | {
      type: 'token';
      token: FormatToken;
    }
  | {
      type: 'literal';
      value: string;
    };

type ParseState = {
  year?: bigint;
  month?: bigint;
  day?: bigint;
  hour?: bigint;
  minutes?: bigint;
  secondsWhole?: bigint;
  fraction?: string;
  offsetSeconds?: bigint;
};

type ParsedDateTime = {
  components: CalendarInput;
  offsetSeconds?: bigint;
};

class ParseError extends Error {}

function tokenizeFormat(format: string): FormatPart[] {
  const tokens = [...FORMAT_TOKENS].sort((a, b) => b.token.length - a.token.length);
  const parts: FormatPart[] = [];
  let index = 0;

  while (index < format.length) {
    if (format[index] === '\\') {
      if (index + 1 === format.length) throw new Error('incomplete format escape');
      parts.push({ type: 'literal', value: format[index + 1] });
      index += 2;
      continue;
    }
    if (format[index] === '[') {
      let literal = '';
      index += 1;
      while (index < format.length && format[index] !== ']') {
        if (format[index] === '\\') {
          index += 1;
          if (index === format.length) throw new Error('incomplete format escape');
        }
        literal += format[index++];
      }
      if (index === format.length) throw new Error('unclosed format literal');
      parts.push({ type: 'literal', value: literal });
      index += 1;
      continue;
    }
    const repeated = /^(?:S\*|S+|Y+|y+|G+|g+)/.exec(format.slice(index));
    if (repeated) {
      parts.push({ type: 'token', token: repeatedToken(repeated[0]) });
      index += repeated[0].length;
      continue;
    }
    let matched = false;
    for (const token of tokens) {
      if (format.startsWith(token.token, index)) {
        parts.push({ type: 'token', token });
        index += token.token.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      parts.push({ type: 'literal', value: format[index] });
      index += 1;
    }
  }

  return parts;
}

function minTokenLength(token: FormatToken): number {
  return token.minLength;
}

function computeMinRemaining(parts: FormatPart[]): number[] {
  const minRemaining: number[] = new Array(parts.length + 1).fill(0);
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = parts[i];
    const min = part.type === 'literal' ? part.value.length : minTokenLength(part.token);
    minRemaining[i] = minRemaining[i + 1] + min;
  }
  return minRemaining;
}

function digitsSlice(value: string, start: number, length: number): string | undefined {
  const slice = value.slice(start, start + length);
  for (let i = 0; i < slice.length; i += 1) {
    const code = slice.charCodeAt(i);
    if (code < 48 || code > 57) return undefined;
  }
  return slice;
}

function parseEraYear(value: string): bigint {
  if (value.startsWith('BC')) {
    const eraYear = BigInt(value.slice(2).trim());
    if (eraYear <= 0n) throw new ParseError('era year must be at least 1');
    return 1n - eraYear;
  }
  if (value.endsWith('AD')) {
    const eraYear = BigInt(value.slice(0, -2).trim());
    if (eraYear <= 0n) throw new ParseError('era year must be at least 1');
    return eraYear;
  }
  const eraYear = BigInt(value);
  if (eraYear <= 0n) throw new ParseError('era year must be at least 1');
  return eraYear;
}

function daysInMonth(year: bigint, month: bigint): bigint {
  const { year: normalizedYear, month: normalizedMonth } = normalizeMonth(year, month);
  const start = daysFromCivil(normalizedYear, normalizedMonth, 1n);
  const { year: nextYear, month: nextMonth } = normalizeMonth(normalizedYear, normalizedMonth + 1n);
  const end = daysFromCivil(nextYear, nextMonth, 1n);
  return end - start;
}

function parseByFormat(value: string, format: string): ParsedDateTime {
  const parts = tokenizeFormat(format);
  const minRemaining = computeMinRemaining(parts);
  let conflictError: string | undefined;

  const applyValue = <K extends keyof ParseState>(state: ParseState, key: K, next: ParseState[K], label: string) => {
    const current = state[key];
    if (current !== undefined && current !== next) {
      if (!conflictError) conflictError = `${label} is duplicated`;
      return undefined;
    }
    if (current === next) return state;
    return { ...state, [key]: next };
  };

  const parseAt = (partIndex: number, valueIndex: number, state: ParseState): ParseState | undefined => {
    if (partIndex === parts.length) {
      return valueIndex === value.length ? state : undefined;
    }

    const part = parts[partIndex];
    if (part.type === 'literal') {
      if (value.startsWith(part.value, valueIndex)) {
        return parseAt(partIndex + 1, valueIndex + part.value.length, state);
      }
      return undefined;
    }

    const token = part.token;
    const remainingMin = minRemaining[partIndex + 1];
    const remainingMax = value.length - valueIndex - remainingMin;
    if (remainingMax < 0) return undefined;

    switch (token.kind) {
      case 'era': {
        const regex = new RegExp(`^${token.regex}$`);
        for (let len = 1; len <= remainingMax; len += 1) {
          const text = value.slice(valueIndex, valueIndex + len);
          if (!regex.test(text)) continue;
          let parsed: bigint;
          try {
            parsed = parseEraYear(text);
          } catch (error) {
            if (!(error instanceof ParseError)) throw error;
            conflictError ??= error.message;
            continue;
          }
          const nextState = applyValue(state, 'year', parsed, 'year');
          if (!nextState) continue;
          const result = parseAt(partIndex + 1, valueIndex + len, nextState);
          if (result) return result;
        }
        return undefined;
      }
      case 'year': {
        const hasSign = value[valueIndex] === '-' || value[valueIndex] === '+';
        const digitsStart = hasSign ? valueIndex + 1 : valueIndex;
        const maxLen = value.length - digitsStart - remainingMin;
        const minLen = token.minLength;
        if (maxLen < minLen) return undefined;
        for (let len = minLen; len <= maxLen; len += 1) {
          const digits = digitsSlice(value, digitsStart, len);
          if (!digits) break;
          const parsed = BigInt(`${value[valueIndex] === '-' ? '-' : ''}${digits}`);
          const nextState = applyValue(state, 'year', parsed, 'year');
          if (!nextState) continue;
          const result = parseAt(partIndex + 1, digitsStart + len, nextState);
          if (result) return result;
        }
        return undefined;
      }
      case 'offset': {
        const match = new RegExp(`^${token.regex}`).exec(value.slice(valueIndex));
        if (!match) return undefined;
        const text = match[0];
        let offsetSeconds = 0n;
        if (text !== 'Z') {
          const digits = text.slice(1).replace(':', '');
          const hours = BigInt(digits.slice(0, 2));
          const minutes = BigInt(digits.slice(2));
          if (hours > 23n || minutes > 59n) return undefined;
          offsetSeconds = (hours * SECONDS_PER_HOUR + minutes * SECONDS_PER_MINUTE) * (text[0] === '-' ? -1n : 1n);
        }
        const nextState = applyValue(state, 'offsetSeconds', offsetSeconds, 'offset');
        if (!nextState) return undefined;
        return parseAt(partIndex + 1, valueIndex + text.length, nextState);
      }
      case 'month': {
        const maxLen = Math.min(token.maxLength, remainingMax);
        for (let len = maxLen; len >= 1; len -= 1) {
          const digits = digitsSlice(value, valueIndex, len);
          if (!digits) continue;
          const parsed = BigInt(digits);
          if (parsed < 1n || parsed > 12n) continue;
          const nextState = applyValue(state, 'month', parsed, 'month');
          if (!nextState) continue;
          const result = parseAt(partIndex + 1, valueIndex + len, nextState);
          if (result) return result;
        }
        return undefined;
      }
      case 'day': {
        const maxLen = Math.min(token.maxLength, remainingMax);
        for (let len = maxLen; len >= 1; len -= 1) {
          const digits = digitsSlice(value, valueIndex, len);
          if (!digits) continue;
          const parsed = BigInt(digits);
          if (parsed < 1n || parsed > 31n) continue;
          const nextState = applyValue(state, 'day', parsed, 'day');
          if (!nextState) continue;
          const result = parseAt(partIndex + 1, valueIndex + len, nextState);
          if (result) return result;
        }
        return undefined;
      }
      case 'hour': {
        const maxLen = Math.min(token.maxLength, remainingMax);
        for (let len = maxLen; len >= 1; len -= 1) {
          const digits = digitsSlice(value, valueIndex, len);
          if (!digits) continue;
          const parsed = BigInt(digits);
          if (parsed < 0n || parsed > 23n) continue;
          const nextState = applyValue(state, 'hour', parsed, 'hour');
          if (!nextState) continue;
          const result = parseAt(partIndex + 1, valueIndex + len, nextState);
          if (result) return result;
        }
        return undefined;
      }
      case 'minutes': {
        const maxLen = Math.min(token.maxLength, remainingMax);
        for (let len = maxLen; len >= 1; len -= 1) {
          const digits = digitsSlice(value, valueIndex, len);
          if (!digits) continue;
          const parsed = BigInt(digits);
          if (parsed < 0n || parsed > 59n) continue;
          const nextState = applyValue(state, 'minutes', parsed, 'minutes');
          if (!nextState) continue;
          const result = parseAt(partIndex + 1, valueIndex + len, nextState);
          if (result) return result;
        }
        return undefined;
      }
      case 'seconds': {
        const maxLen = Math.min(token.maxLength, remainingMax);
        for (let len = maxLen; len >= 1; len -= 1) {
          const digits = digitsSlice(value, valueIndex, len);
          if (!digits) continue;
          const parsed = BigInt(digits);
          if (parsed < 0n || parsed > 59n) continue;
          const nextState = applyValue(state, 'secondsWhole', parsed, 'seconds');
          if (!nextState) continue;
          const result = parseAt(partIndex + 1, valueIndex + len, nextState);
          if (result) return result;
        }
        return undefined;
      }
      case 'fraction': {
        const maxLen = Math.min(token.maxLength, remainingMax);
        const minLen = token.minLength;
        for (let len = maxLen; len >= minLen; len -= 1) {
          const digits = digitsSlice(value, valueIndex, len);
          if (!digits) continue;
          const nextState = applyValue(state, 'fraction', digits.replace(/0+$/, '') || '0', 'fraction');
          if (!nextState) continue;
          const result = parseAt(partIndex + 1, valueIndex + len, nextState);
          if (result) return result;
        }
        return undefined;
      }
    }
  };

  const parsed = parseAt(0, 0, {});
  if (!parsed) {
    if (conflictError) throw new ParseError(conflictError);
    throw new ParseError('format does not match value');
  }

  if (parsed.year === undefined || parsed.month === undefined) {
    throw new Error('format must include year and month');
  }

  const year = parsed.year;
  const month = parsed.month;
  const day = parsed.day ?? 1n;
  const hour = parsed.hour ?? 0n;
  const minutes = parsed.minutes ?? 0n;
  const secondsBase = parsed.secondsWhole ?? 0n;

  const maxDay = daysInMonth(year, month);
  if (day < 1n || day > maxDay) throw new ParseError('day is out of range');

  let seconds = Decimal(secondsBase);
  if (parsed.fraction) {
    seconds = seconds.add(Decimal(`0.${parsed.fraction}`));
  }

  return {
    components: { year, month, day, hour, minutes, seconds },
    offsetSeconds: parsed.offsetSeconds,
  };
}

export class Calendar {
  #epoch: Decimal;
  #zone: Zone = 'local';

  constructor();
  constructor(dateLike: DecimalLike | Date);
  constructor(
    year: bigint | number,
    month: bigint | number,
    day: bigint | number,
    hour?: bigint | number,
    minutes?: bigint | number,
    seconds?: DecimalLike,
  );
  constructor(...args: (bigint | number | DecimalLike | Date | undefined)[]) {
    if (args.length === 0) {
      this.#epoch = Decimal(Date.now()).divExact(1000);
      return;
    }

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
      this.#epoch = calendarToEpoch(components, 'local');
      return;
    }

    if (args[0] instanceof Date) {
      this.#epoch = Decimal(args[0].getTime()).divExact(1000);
      return;
    }
    // TODO: parse string date representation
    this.#epoch = Decimal(args[0] as DecimalLike);
    return;
  }

  static fromEpoch(epochSeconds: DecimalLike) {
    return new Calendar(epochSeconds);
  }

  static fromDate(date: Date) {
    return new Calendar(date);
  }

  static fromComponents(input: CalendarInput) {
    const components = normalizeCalendarInput(input);
    const epoch = calendarToEpoch(components, input.zone ?? 'local');
    return new Calendar(epoch);
  }

  static parse(value: string, format?: string, inputZone: Zone = 'local') {
    const formats =
      format === undefined
        ? [
            'IY-MM-DD[T]hh:mm:ss.S*Z',
            'IY-MM-DD[T]hh:mm:ssZ',
            'IY-MM-DD[T]hh:mmZ',
            'IY-MM-DD[T]hh:mm:ss.S*',
            'IY-MM-DD[T]hh:mm:ss',
            'IY-MM-DD[T]hh:mm',
            'IY-MM-DD',
          ]
        : [format];
    for (const candidate of formats) {
      let parsed: ParsedDateTime;
      try {
        parsed = parseByFormat(value, candidate);
      } catch (error) {
        if (!(error instanceof ParseError) || format !== undefined) throw error;
        continue;
      }
      if (parsed.offsetSeconds === undefined) {
        return Calendar.fromComponents({ ...parsed.components, zone: inputZone });
      }
      const epoch = calendarToEpoch(normalizeCalendarInput(parsed.components), 'utc').sub(parsed.offsetSeconds);
      return Calendar.fromEpoch(epoch);
    }
    throw new ParseError('value does not match a supported ISO date format');
  }

  clone() {
    return new Calendar(this.#epoch).zone$(this.#zone);
  }

  zone(): Zone;
  zone(value: Zone): Calendar;
  zone(value?: Zone) {
    if (value === undefined) return this.#zone;
    return new Calendar(this.#epoch).zone$(value);
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
  epoch(value: DecimalLike): Calendar;
  epoch(value?: DecimalLike) {
    if (value === undefined) return this.#epoch.clone();
    return new Calendar(value).zone$(this.#zone);
  }

  epoch$(value: DecimalLike) {
    this.#epoch = Decimal(value);
    return this;
  }

  components() {
    return epochToComponents(this.#epoch, this.#zone);
  }

  #withComponents(update: Partial<CalendarComponents>, mutate: boolean) {
    const current = this.components();
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
    return new Calendar(epoch).zone$(this.#zone);
  }

  #withAlignedDate(adjuster: (current: CalendarComponents) => { year: bigint; month: bigint; day: bigint }) {
    const current = this.components();
    const next: CalendarComponents = {
      ...adjuster(current),
      hour: 0n,
      minutes: 0n,
      seconds: Decimal(0),
      weekday: current.weekday,
    };
    const epoch = calendarToEpoch(next, this.#zone);
    return new Calendar(epoch).zone$(this.#zone);
  }

  year(): bigint;
  year(value: bigint | number | DecimalLike): Calendar;
  year(value?: bigint | number | DecimalLike) {
    if (value === undefined) return this.components().year;
    return this.#withComponents({ year: toBigInt(value, 'year') }, false);
  }

  year$(value: bigint | number | DecimalLike) {
    return this.#withComponents({ year: toBigInt(value, 'year') }, true);
  }

  month(): bigint;
  month(value: bigint | number | DecimalLike): Calendar;
  month(value?: bigint | number | DecimalLike) {
    if (value === undefined) return this.components().month;
    return this.#withComponents({ month: toBigInt(value, 'month') }, false);
  }

  month$(value: bigint | number | DecimalLike) {
    return this.#withComponents({ month: toBigInt(value, 'month') }, true);
  }

  day(): bigint;
  day(value: bigint | number | DecimalLike): Calendar;
  day(value?: bigint | number | DecimalLike) {
    if (value === undefined) return this.components().day;
    return this.#withComponents({ day: toBigInt(value, 'day') }, false);
  }

  day$(value: bigint | number | DecimalLike) {
    return this.#withComponents({ day: toBigInt(value, 'day') }, true);
  }

  hour(): bigint;
  hour(value: bigint | number | DecimalLike): Calendar;
  hour(value?: bigint | number | DecimalLike) {
    if (value === undefined) return this.components().hour;
    return this.#withComponents({ hour: toBigInt(value, 'hour') }, false);
  }

  hour$(value: bigint | number | DecimalLike) {
    return this.#withComponents({ hour: toBigInt(value, 'hour') }, true);
  }

  minutes(): bigint;
  minutes(value: bigint | number | DecimalLike): Calendar;
  minutes(value?: bigint | number | DecimalLike) {
    if (value === undefined) return this.components().minutes;
    return this.#withComponents({ minutes: toBigInt(value, 'minutes') }, false);
  }

  minutes$(value: bigint | number | DecimalLike) {
    return this.#withComponents({ minutes: toBigInt(value, 'minutes') }, true);
  }

  seconds(): Decimal;
  seconds(value: DecimalLike): Calendar;
  seconds(value?: DecimalLike) {
    if (value === undefined) return this.components().seconds.clone();
    return this.#withComponents({ seconds: Decimal(value) }, false);
  }

  seconds$(value: DecimalLike) {
    return this.#withComponents({ seconds: Decimal(value) }, true);
  }

  weekday() {
    return this.components().weekday;
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
    return new Calendar(aligned).zone$(this.#zone);
  }

  format(fmt: string) {
    const parts = this.components();
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

    const formatParts = tokenizeFormat(fmt);
    let formatted = '';
    const tokenInput = {
      year,
      month,
      day,
      hour,
      minutes,
      seconds,
      fraction,
      eraYear: eyear,
      bc,
      ad,
      offsetMinutes: () => offsetMinutesForEpoch(this.#epoch, this.#zone),
    };
    for (const part of formatParts) {
      formatted += part.type === 'literal' ? part.value : part.token.format(tokenInput);
    }
    return formatted;
  }
}
