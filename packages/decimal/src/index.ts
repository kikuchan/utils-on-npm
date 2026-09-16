const __brand = Symbol.for('Decimal');

export interface DecimalInstance {
  readonly [__brand]: never;
}

export type DecimalType = { coeff: bigint; digits: bigint | number };
export type DecimalLike = number | string | bigint | DecimalInstance | DecimalType;
export type RoundingMode = 'trunc' | 'floor' | 'ceil' | 'round';

export interface Decimal {
  readonly [__brand]: never;

  coeff: bigint;
  /** Decimal scale. Must always be a safe integer, including when assigned directly. */
  digits: number;

  // Copying
  clone(): Decimal;

  // Rounding and scaling
  round$(digits?: bigint | number, force?: boolean): this;
  round(digits?: bigint | number, force?: boolean): Decimal;
  floor$(digits?: bigint | number, force?: boolean): this;
  floor(digits?: bigint | number, force?: boolean): Decimal;
  ceil$(digits?: bigint | number, force?: boolean): this;
  ceil(digits?: bigint | number, force?: boolean): Decimal;
  trunc$(digits?: bigint | number, force?: boolean): this;
  trunc(digits?: bigint | number, force?: boolean): Decimal;
  rescale$(digits?: bigint | number, mode?: RoundingMode): this;
  rescale(digits?: bigint | number, mode?: RoundingMode): Decimal;
  roundBy$(step: DecimalLike, mode?: RoundingMode): this;
  roundBy(step: DecimalLike, mode?: RoundingMode): Decimal;
  floorBy$(step: DecimalLike): this;
  floorBy(step: DecimalLike): Decimal;
  ceilBy$(step: DecimalLike): this;
  ceilBy(step: DecimalLike): Decimal;
  truncBy$(step: DecimalLike): this;
  truncBy(step: DecimalLike): Decimal;
  split$(digits?: bigint | number, mode?: RoundingMode): [Decimal, Decimal];
  split(digits?: bigint | number, mode?: RoundingMode): [Decimal, Decimal];
  splitBy$(step: DecimalLike, mode?: RoundingMode): [Decimal, Decimal];
  splitBy(step: DecimalLike, mode?: RoundingMode): [Decimal, Decimal];
  frac$(): this;
  frac(): Decimal;

  // Sign and absolute
  neg$(flag?: boolean): this;
  neg(flag?: boolean): Decimal;
  abs$(): this;
  abs(): Decimal;
  sign$(): this;
  sign(): Decimal;
  isZero(): boolean;
  isPositive(): boolean;
  isNegative(): boolean;

  // Arithmetic
  add$(v: DecimalLike): this;
  add(v: DecimalLike): Decimal;
  sub$(v: DecimalLike): this;
  sub(v: DecimalLike): Decimal;
  mul$(v: DecimalLike, digits?: number | bigint | undefined): Decimal;
  mul(v: DecimalLike, digits?: number | bigint | undefined): Decimal;
  shift10$(exponent: bigint | number): this;
  shift10(exponent: bigint | number): Decimal;
  inverse$(precision?: bigint | number): this;
  inverse(precision?: bigint | number): Decimal;
  div$(v: DecimalLike, precision?: bigint | number, mode?: RoundingMode): this;
  /** Exact when precision is omitted and the quotient terminates; otherwise significant-digit rounding. */
  div(v: DecimalLike, precision?: bigint | number, mode?: RoundingMode): Decimal;
  divExact$(v: DecimalLike, fallbackPrecision?: bigint | number, mode?: RoundingMode): this;
  /** Exact quotient; non-terminating results require an explicit significant-digit fallback. */
  divExact(v: DecimalLike, fallbackPrecision?: bigint | number, mode?: RoundingMode): Decimal;
  divRound$(v: DecimalLike, digits?: bigint | number, mode?: RoundingMode): this;
  /** Round the exact quotient directly to a decimal position (default: integer, half away from zero). */
  divRound(v: DecimalLike, digits?: bigint | number, mode?: RoundingMode): Decimal;
  divFloor$(v: DecimalLike, digits?: bigint | number): this;
  /** Floor the exact quotient directly to a decimal position (default: integer). */
  divFloor(v: DecimalLike, digits?: bigint | number): Decimal;
  divCeil$(v: DecimalLike, digits?: bigint | number): this;
  divCeil(v: DecimalLike, digits?: bigint | number): Decimal;
  divTrunc$(v: DecimalLike, digits?: bigint | number): this;
  divTrunc(v: DecimalLike, digits?: bigint | number): Decimal;

  // Modulo and bounding
  mod$(v: DecimalLike): this;
  mod(v: DecimalLike): Decimal;
  modPositive$(v: DecimalLike): this;
  modPositive(v: DecimalLike): Decimal;
  clamp$(minValue: DecimalLike | undefined, maxValue: DecimalLike | undefined): this;
  clamp(minValue: DecimalLike | undefined, maxValue: DecimalLike | undefined): Decimal;

  // Comparison
  cmp(v: DecimalLike): number;
  eq(v: DecimalLike): boolean;
  neq(v: DecimalLike): boolean;
  lt(v: DecimalLike): boolean;
  gt(v: DecimalLike): boolean;
  le(v: DecimalLike): boolean;
  ge(v: DecimalLike): boolean;
  between(a: DecimalLike | undefined, b: DecimalLike | undefined): boolean;
  isCloseTo(v: DecimalLike, tolerance: DecimalLike): boolean;

  // Advanced math
  pow$(exponent: DecimalLike, precision?: bigint | number): this;
  pow(exponent: DecimalLike, precision?: bigint | number): Decimal;
  root$(degree: bigint | number, precision?: bigint | number): this;
  root(degree: bigint | number, precision?: bigint | number): Decimal;
  sqrt$(precision?: bigint | number): this;
  sqrt(precision?: bigint | number): Decimal;
  log$(base: DecimalLike, precision?: bigint | number): this;
  log(base: DecimalLike, precision?: bigint | number): Decimal;
  order(): bigint;

  // Conversion
  toString(): string;
  toFixed(fractionDigits: bigint | number): string;

  number(): number;
  integer(): bigint;
}

function ensureInteger(value: bigint | number, message = 'Digits must be an integer'): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new RangeError(message);
  return result;
}

function ensurePrecision(value: number | bigint): number {
  const result = ensureInteger(value, 'Precision must be a positive safe integer');
  if (result < 1) throw new RangeError('Precision must be a positive safe integer');
  return result;
}

function pow10n(n: number): bigint {
  if (n < 0) throw new RangeError('Negative integer power of ten');
  if (n < pow10nCache.length) return pow10nCache[n];
  return 10n ** BigInt(ensureInteger(n, 'Exponent must be a safe integer'));
}

function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function parsePlainDecimal(input: string): { coeff: bigint; digits: number } {
  if (input === '') throw new Error('Invalid number');
  let sign = 1n;
  let str = input;
  if (str[0] === '-') {
    sign = -1n;
    str = str.slice(1);
  } else if (str[0] === '+') {
    str = str.slice(1);
  }
  if (str === '') throw new Error('Invalid number');
  const dotIndex = str.indexOf('.');
  const digits = dotIndex >= 0 ? str.length - dotIndex - 1 : 0;
  let firstNonZero = -1;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code === 46) continue;
    if (code !== 48) {
      firstNonZero = i;
      break;
    }
  }
  if (firstNonZero === -1) return { coeff: 0n, digits };
  let coeffStr: string;
  if (dotIndex < 0 || firstNonZero > dotIndex) {
    coeffStr = str.slice(firstNonZero);
  } else {
    coeffStr = str.slice(firstNonZero, dotIndex) + str.slice(dotIndex + 1);
  }
  const coeff = sign * BigInt(coeffStr);
  return { coeff, digits };
}

function parseDecimalString(value: string): { coeff: bigint; digits: number } {
  const exponentIndex = value.search(/[eE]/);
  if (exponentIndex === -1) return parsePlainDecimal(value);
  const basePart = value.slice(0, exponentIndex);
  const exponentPart = value.slice(exponentIndex + 1);
  if (!/^[+-]?\d+$/.test(exponentPart.trim())) throw new Error('Invalid number');
  const { coeff, digits } = parsePlainDecimal(basePart);
  const adjustment = ensureInteger(Number(exponentPart), 'Exponent is out of range');
  return { coeff, digits: ensureInteger(digits - adjustment, 'Exponent is out of range') };
}

type Parts = Pick<Decimal, 'coeff' | 'digits'>;

function alignForOperation(a: Parts, b: Parts): { digits: number; aCoeff: bigint; bCoeff: bigint } {
  if (a.digits >= b.digits) {
    const diff = a.digits - b.digits;
    return {
      digits: a.digits,
      aCoeff: a.coeff,
      bCoeff: diff === 0 ? b.coeff : b.coeff * pow10n(diff),
    };
  }
  const diff = b.digits - a.digits;
  return {
    digits: b.digits,
    aCoeff: a.coeff * pow10n(diff),
    bCoeff: b.coeff,
  };
}

// Shared coefficient arithmetic for public methods and the mathematical algorithms.

function gcd(a: bigint, b: bigint): bigint {
  a = abs(a);
  b = abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

function removeFactor(value: bigint, factor: bigint): { value: bigint; exponent: number } {
  const powers: { factor: bigint; exponent: number }[] = [];
  for (let exponent = 1; factor <= value && value % factor === 0n; exponent *= 2, factor *= factor) {
    powers.push({ factor, exponent });
  }
  let exponent = 0;
  for (let i = powers.length - 1; i >= 0; i--) {
    const power = powers[i];
    if (value % power.factor === 0n) {
      value /= power.factor;
      exponent += power.exponent;
    }
  }
  return { value, exponent };
}

/** Significant results strip all trailing zeros; rescale() stops at the integer position. */
function normalize(value: Parts, minimumDigits = -Infinity): Parts {
  if (value.coeff === 0n) return { coeff: 0n, digits: 0 };
  if (value.digits <= minimumDigits || value.coeff % 10n !== 0n) return { ...value };
  // Small coefficients are cheaper to trim directly; long runs of zeros use one string conversion.
  if (abs(value.coeff) < pow10n(DEFAULT_PRECISION)) {
    let { coeff, digits } = value;
    while (digits > minimumDigits && coeff % 10n === 0n) {
      coeff /= 10n;
      digits--;
    }
    return { coeff, digits: ensureInteger(digits) };
  }
  const text = value.coeff.toString();
  const end = text.search(/0+$/);
  const zeros = Math.min(text.length - end, value.digits - minimumDigits);
  const coeff = zeros === text.length - end ? BigInt(text.slice(0, end)) : value.coeff / pow10n(zeros);
  return { coeff, digits: ensureInteger(value.digits - zeros) };
}

function order(value: Parts): number {
  if (!value.coeff) throw new RangeError('order undefined for 0');
  return abs(value.coeff).toString().length - 1 - value.digits;
}

function compare(a: Parts, b: Parts): number {
  if (a.coeff === b.coeff && a.digits === b.digits) return 0;
  if (a.coeff <= 0n && b.coeff >= 0n) return a.coeff === b.coeff ? 0 : -1;
  if (a.coeff >= 0n && b.coeff <= 0n) return 1;
  // Only inspect orders when alignment could require a large power of ten.
  if (Math.abs(a.digits - b.digits) > 64) {
    const difference = order(a) - order(b);
    if (difference) {
      const sign = a.coeff < 0n ? -1 : 1;
      return difference < 0 ? -sign : sign;
    }
  }
  const { aCoeff, bCoeff } = alignForOperation(a, b);
  if (aCoeff === bCoeff) return 0;
  return aCoeff > bCoeff ? 1 : -1;
}

function negate(a: Parts): Parts {
  return { coeff: -a.coeff, digits: a.digits };
}

function quotient(numerator: bigint, denominator: bigint, mode: RoundingMode): bigint {
  if (!denominator) throw new Error('Division by zero');
  if (denominator < 0n) {
    numerator = -numerator;
    denominator = -denominator;
  }
  const result = numerator / denominator;
  const remainder = numerator % denominator;
  if (!remainder) return result;
  if (mode === 'floor' && numerator < 0n) return result - 1n;
  if (mode === 'ceil' && numerator > 0n) return result + 1n;
  if (mode === 'round' && abs(remainder) * 2n >= denominator) return result + (numerator < 0n ? -1n : 1n);
  return result;
}

function divideFixed(a: Parts, b: Parts, digits: number, mode: RoundingMode = 'round'): Parts {
  if (!b.coeff) throw new Error('Division by zero');
  if (!a.coeff) return { coeff: 0n, digits };
  const shift = b.digits - a.digits + digits;
  // Avoid expanding a huge denominator when the quotient is smaller than half a unit.
  // Small shifts are cheaper to evaluate directly than to inspect coefficient lengths.
  if ((shift < -64 || shift > 64) && order(a) - order(b) + digits < -1) {
    const negative = a.coeff < 0n !== b.coeff < 0n;
    let coeff = 0n;
    if (mode === 'floor' && negative) coeff = -1n;
    if (mode === 'ceil' && !negative) coeff = 1n;
    return { coeff, digits };
  }
  return {
    coeff: quotient(
      shift > 0 ? a.coeff * pow10n(shift) : a.coeff,
      shift < 0 ? b.coeff * pow10n(-shift) : b.coeff,
      mode,
    ),
    digits,
  };
}

function quotientOrder(numerator: bigint, denominator: bigint): number {
  const a = abs(numerator);
  const b = abs(denominator);
  const approximateA = Number(a);
  const approximateB = Number(b);
  // Floating point only supplies a guess; exact comparisons decide the exponent.
  let exponent =
    Number.isFinite(approximateA) && Number.isFinite(approximateB)
      ? Math.floor(Math.log10(approximateA) - Math.log10(approximateB))
      : a.toString().length - b.toString().length;
  let left = exponent < 0 ? a * pow10n(-exponent) : a;
  let right = exponent > 0 ? b * pow10n(exponent) : b;
  while (left < right) {
    exponent--;
    left *= 10n;
  }
  while (left >= right * 10n) {
    exponent++;
    right *= 10n;
  }
  return exponent;
}

function divideSignificant(a: Parts, b: Parts, p: number, mode: RoundingMode = 'round'): Parts {
  if (!b.coeff) throw new Error('Division by zero');
  if (!a.coeff) return { coeff: 0n, digits: 0 };
  const coefficientExponent = quotientOrder(a.coeff, b.coeff);
  const shift = p - 1 - coefficientExponent;
  const result = quotient(
    shift > 0 ? a.coeff * pow10n(shift) : a.coeff,
    shift < 0 ? b.coeff * pow10n(-shift) : b.coeff,
    mode,
  );
  const normalized = normalize({ coeff: result, digits: 0 });
  return {
    coeff: normalized.coeff,
    digits: ensureInteger(a.digits - b.digits + (shift + normalized.digits)),
  };
}

function roundSignificant(a: Parts, p: number, mode: RoundingMode = 'round'): Parts {
  if (!a.coeff) return { coeff: 0n, digits: 0 };
  const excess = abs(a.coeff).toString().length - p;
  if (excess <= 0) return normalize(a);
  return normalize({ coeff: quotient(a.coeff, pow10n(excess), mode), digits: ensureInteger(a.digits - excess) });
}

function divideExact(a: Parts, b: Parts): Parts | undefined {
  if (!b.coeff) throw new Error('Division by zero');
  if (!a.coeff) return { ...a };
  const common = gcd(a.coeff, b.coeff);
  let numerator = a.coeff / common;
  let denominator = b.coeff / common;
  if (denominator < 0n) {
    numerator = -numerator;
    denominator = -denominator;
  }
  const twos = removeFactor(denominator, 2n);
  const fives = removeFactor(twos.value, 5n);
  if (fives.value !== 1n) return undefined;
  const scale = twos.exponent > fives.exponent ? twos.exponent : fives.exponent;
  const digits = ensureInteger(a.digits - b.digits + scale);
  return normalize({
    coeff: numerator * 2n ** BigInt(scale - twos.exponent) * 5n ** BigInt(scale - fives.exponent),
    digits,
  });
}

/** Integer exponentiation capped at limit + 1, for root comparisons. */
function powerCapped(base: bigint, exponent: number, limit: bigint): bigint {
  let result = 1n;
  while (exponent) {
    if (exponent % 2) {
      result *= base;
      if (result > limit) return limit + 1n;
    }
    exponent = Math.floor(exponent / 2);
    if (exponent) {
      base *= base;
      if (base > limit) base = limit + 1n;
    }
  }
  return result;
}

function integerRoot(value: bigint, degree: number): bigint {
  if (value < 2n || degree === 1) return value;
  const bits = value.toString(2).length;
  if (degree >= bits) return 1n;
  let root = 1n << BigInt(Math.ceil(bits / degree));
  const divisorDegree = BigInt(degree);
  for (;;) {
    const divisor = powerCapped(root, degree - 1, value);
    const next = ((divisorDegree - 1n) * root + value / divisor) / divisorDegree;
    if (next >= root) return root;
    root = next;
  }
}

function exactRoot(value: Parts, degree: number): Parts | undefined {
  const normalized = normalize(value);
  if (!normalized.coeff) return normalized;
  if (normalized.digits % degree) return undefined;
  const magnitude = abs(normalized.coeff);
  const root = integerRoot(magnitude, degree);
  if (powerCapped(root, degree, magnitude) !== magnitude) return undefined;
  return { coeff: normalized.coeff < 0n ? -root : root, digits: normalized.digits / degree };
}

// Interval arithmetic and mathematical functions.

type Bounds = { lower: Parts; upper: Parts };
type FixedBounds = { lower: bigint; upper: bigint };

class MorePrecision extends Error {}

function roundedBounds(bounds: Bounds, p: number): Parts | undefined {
  const lower = roundSignificant(bounds.lower, p);
  const upper = roundSignificant(bounds.upper, p);
  return compare(lower, upper) === 0 ? lower : undefined;
}

/** All operations round outwards; endpoints enclose the exact value. */
class Fixed {
  readonly unit: bigint;
  readonly digits: number;
  #ln2?: FixedBounds;
  #ln10?: FixedBounds;

  constructor(digits: number) {
    this.digits = digits;
    this.unit = pow10n(digits);
  }

  from(value: Parts): FixedBounds {
    return {
      lower: divideFixed(value, DECIMAL_ONE, this.digits, 'floor').coeff,
      upper: divideFixed(value, DECIMAL_ONE, this.digits, 'ceil').coeff,
    };
  }

  constant(value: bigint): FixedBounds {
    return { lower: value * this.unit, upper: value * this.unit };
  }

  add(a: FixedBounds, b: FixedBounds): FixedBounds {
    return { lower: a.lower + b.lower, upper: a.upper + b.upper };
  }

  neg(a: FixedBounds): FixedBounds {
    return { lower: -a.upper, upper: -a.lower };
  }

  mul(a: FixedBounds, b: FixedBounds): FixedBounds {
    if (a.lower >= 0n && b.lower >= 0n) {
      return {
        lower: quotient(a.lower * b.lower, this.unit, 'floor'),
        upper: quotient(a.upper * b.upper, this.unit, 'ceil'),
      };
    }
    const products = [a.lower * b.lower, a.lower * b.upper, a.upper * b.lower, a.upper * b.upper];
    return {
      lower: quotient(
        products.reduce((a, b) => (a < b ? a : b)),
        this.unit,
        'floor',
      ),
      upper: quotient(
        products.reduce((a, b) => (a > b ? a : b)),
        this.unit,
        'ceil',
      ),
    };
  }

  div(a: FixedBounds, b: FixedBounds): FixedBounds {
    if (b.lower <= 0n && b.upper >= 0n) throw new MorePrecision();
    if (b.lower === b.upper && b.lower % this.unit === 0n) {
      const divisor = b.lower / this.unit;
      return {
        lower: quotient(divisor > 0n ? a.lower : a.upper, divisor, 'floor'),
        upper: quotient(divisor > 0n ? a.upper : a.lower, divisor, 'ceil'),
      };
    }
    const pairs = [
      [a.lower, b.lower],
      [a.lower, b.upper],
      [a.upper, b.lower],
      [a.upper, b.upper],
    ];
    return {
      lower: pairs.map(([n, d]) => quotient(n * this.unit, d, 'floor')).reduce((a, b) => (a < b ? a : b)),
      upper: pairs.map(([n, d]) => quotient(n * this.unit, d, 'ceil')).reduce((a, b) => (a > b ? a : b)),
    };
  }

  scale(a: FixedBounds, n: bigint): FixedBounds {
    return n < 0n ? { lower: a.upper * n, upper: a.lower * n } : { lower: a.lower * n, upper: a.upper * n };
  }

  parts(a: FixedBounds, exponent = 0): Bounds {
    const digits = ensureInteger(this.digits - exponent);
    return { lower: { coeff: a.lower, digits }, upper: { coeff: a.upper, digits } };
  }

  /** 2 atanh(t), including a geometric bound for the uncomputed tail. */
  atanh(t: FixedBounds): FixedBounds {
    const squared = this.mul(t, t);
    const radius = abs(squared.lower) > abs(squared.upper) ? abs(squared.lower) : abs(squared.upper);
    if (radius >= this.unit) throw new MorePrecision();
    let term = t;
    let sum = t;
    for (let k = 3n; ; k += 2n) {
      term = this.mul(term, squared);
      const magnitude = abs(term.lower) > abs(term.upper) ? abs(term.lower) : abs(term.upper);
      const tail = quotient(2n * magnitude * this.unit, k * (this.unit - radius), 'ceil');
      if (tail <= 2n) return { lower: 2n * sum.lower - tail, upper: 2n * sum.upper + tail };
      sum = this.add(sum, this.div(term, this.constant(k)));
    }
  }

  ln2(): FixedBounds {
    return (this.#ln2 ??= this.atanh(this.div(this.constant(1n), this.constant(3n))));
  }

  ln10(): FixedBounds {
    // 10 = (5/4) * 2^3; atanh((5/4 - 1)/(5/4 + 1)) = atanh(1/9).
    return (this.#ln10 ??= this.add(
      this.atanh(this.div(this.constant(1n), this.constant(9n))),
      this.scale(this.ln2(), 3n),
    ));
  }

  ln(value: Parts): FixedBounds {
    const length = value.coeff.toString().length;
    const exponent = length - 1 - value.digits;
    let mantissa = this.from({ coeff: value.coeff, digits: length - 1 });
    let twos = 0n;
    while (mantissa.upper > 2n * this.unit) {
      mantissa = this.div(mantissa, this.constant(2n));
      twos++;
    }
    const t = this.div(this.add(mantissa, this.constant(-1n)), this.add(mantissa, this.constant(1n)));
    let result = mantissa.lower === 2n * this.unit && mantissa.upper === mantissa.lower ? this.ln2() : this.atanh(t);
    if (twos) result = this.add(result, this.scale(this.ln2(), twos));
    if (exponent) result = this.add(result, this.scale(this.ln10(), BigInt(exponent)));
    return result;
  }

  expSmall(value: FixedBounds): FixedBounds {
    let reduced = value;
    let squares = 0;
    while (abs(reduced.lower) > this.unit / 8n || abs(reduced.upper) > this.unit / 8n) {
      reduced = this.div(reduced, this.constant(2n));
      squares++;
    }
    let term = this.constant(1n);
    let sum = term;
    for (let k = 1n; ; k++) {
      term = this.div(this.mul(term, reduced), this.constant(k));
      const magnitude = abs(term.lower) > abs(term.upper) ? abs(term.lower) : abs(term.upper);
      // |reduced| <= 1/8, so the tail starting at this term is less than 2 |term|.
      if (magnitude <= 1n) {
        sum = { lower: sum.lower - 2n * magnitude, upper: sum.upper + 2n * magnitude };
        break;
      }
      sum = this.add(sum, term);
    }
    for (let i = 0; i < squares; i++) sum = this.mul(sum, sum);
    return sum;
  }

  exp(value: FixedBounds): Bounds {
    const ln10 = this.ln10();
    const exponent = ensureInteger(
      quotient(value.lower + value.upper, ln10.lower + ln10.upper, 'floor'),
      'Exponent is out of range',
    );
    const reduced = this.add(value, this.neg(this.scale(ln10, BigInt(exponent))));
    if (reduced.upper - reduced.lower > this.unit) throw new MorePrecision();
    return this.parts(this.expSmall(reduced), exponent);
  }
}

function adaptive(p: number, calculate: (work: number) => Bounds, faithful = false): Parts {
  let work = ensureInteger(p + 16);
  for (let attempt = 0; attempt < 16; attempt++, work = ensureInteger(work * 2)) {
    try {
      const bounds = calculate(work);
      const rounded = roundedBounds(bounds, p);
      if (rounded) return rounded;
      if (faithful) {
        const midpoint = new DecimalImpl(bounds.lower).add$(bounds.upper).divRound$(2, work);
        if (midpoint.coeff) {
          const ulp: Parts = { coeff: 1n, digits: ensureInteger(p - 1 - order(midpoint)) };
          const width = new DecimalImpl(bounds.upper).sub$(bounds.lower);
          // This also terminates on exact logarithms at a rounding midpoint.
          if (compare(width, { coeff: ulp.coeff, digits: ensureInteger(ulp.digits + 4) }) <= 0) {
            return roundSignificant(midpoint, p);
          }
        }
      }
    } catch (error) {
      if (!(error instanceof MorePrecision)) throw error;
    }
  }
  throw new RangeError('Unable to resolve the requested precision');
}

function multiplyBounds(a: Bounds, b: Bounds, p: number): Bounds {
  // Used only for non-negative powers.
  return {
    lower: roundSignificant(new DecimalImpl(a.lower).mul$(b.lower), p, 'floor'),
    upper: roundSignificant(new DecimalImpl(a.upper).mul$(b.upper), p, 'ceil'),
  };
}

function integerPowerBounds(value: Parts, exponent: number, p: number): Bounds {
  let factor = { lower: roundSignificant(value, p, 'floor'), upper: roundSignificant(value, p, 'ceil') };
  let result: Bounds = { lower: DECIMAL_ONE, upper: DECIMAL_ONE };
  while (exponent) {
    if (exponent % 2) result = multiplyBounds(result, factor, p);
    exponent = Math.floor(exponent / 2);
    if (exponent) factor = multiplyBounds(factor, factor, p);
  }
  return result;
}

function exactIntegerPower(value: Parts, exponent: number): Parts {
  const base = normalize(value);
  const digits = ensureInteger(base.digits * exponent);
  return normalize({ coeff: base.coeff ** BigInt(exponent), digits });
}

function integerPower(value: Parts, exponent: number, p?: number): Parts {
  const negative = exponent < 0;
  const n = Math.abs(exponent);
  if (!p) {
    if (!negative) return exactIntegerPower(value, n);
    const inverse = divideExact(DECIMAL_ONE, value);
    if (inverse) return exactIntegerPower(inverse, n);
    return integerPower(value, exponent, DEFAULT_PRECISION);
  }
  const base = normalize({ coeff: abs(value.coeff), digits: value.digits });
  const sign = value.coeff < 0n && n % 2 ? -1n : 1n;
  // Small exact results include all possible decimal midpoint ties for positive powers.
  if ((base.coeff.toString(2).length - 1) * n <= 4 * (p + 16)) {
    const exact = exactIntegerPower(base, n);
    const result = negative ? divideSignificant(DECIMAL_ONE, exact, p) : roundSignificant(exact, p);
    return { ...result, coeff: result.coeff * sign };
  }
  const result = adaptive(p, (work) => {
    const bounds = integerPowerBounds(base, n, work);
    return negative
      ? {
          lower: divideSignificant(DECIMAL_ONE, bounds.upper, work, 'floor'),
          upper: divideSignificant(DECIMAL_ONE, bounds.lower, work, 'ceil'),
        }
      : bounds;
  });
  return { ...result, coeff: result.coeff * sign };
}

function root(value: Parts, degree: number, p?: number): Parts {
  if (degree <= 0) throw new Error('Invalid root degree');
  if (value.coeff < 0n && degree % 2 === 0) throw new Error('Even root of negative value is not defined');
  if (!value.coeff) return { ...value };
  if (degree === 1) return p ? roundSignificant(value, p) : { ...value };
  const exact = exactRoot(value, degree);
  if (exact) return p ? roundSignificant(exact, p) : exact;
  const target = p ?? DEFAULT_PRECISION;
  const magnitude = { coeff: abs(value.coeff), digits: value.digits };
  const exponent = Math.floor(order(magnitude) / degree);
  const digits = ensureInteger(target - 1 - exponent);
  const shift = digits * degree - magnitude.digits;
  let result: Parts;
  // Integer root of a scaled rational; the scale depends on precision and degree, not the input exponent.
  if (Math.abs(shift) <= 100_000 && degree <= 1024) {
    const numerator = shift >= 0 ? magnitude.coeff * pow10n(shift) : magnitude.coeff;
    const denominator = shift < 0 ? pow10n(-shift) : 1n;
    let coefficient = integerRoot(numerator / denominator, degree);
    const twice = numerator * 2n ** BigInt(degree);
    if (powerCapped(2n * coefficient + 1n, degree, twice / denominator) * denominator <= twice) coefficient++;
    result = normalize({ coeff: coefficient, digits });
  } else {
    result = adaptive(target, (work) => {
      const fixed = new Fixed(work);
      return fixed.exp(fixed.div(fixed.ln(magnitude), fixed.constant(BigInt(degree))));
    });
  }
  return value.coeff < 0n ? negate(result) : result;
}

function power(value: Parts, exponent: Parts, p?: number): Parts {
  const exp = normalize(exponent);
  if (!exp.coeff) return DECIMAL_ONE;
  if (!value.coeff) {
    if (exp.coeff < 0n) throw new Error('Zero to negative exponent is undefined');
    return { ...value };
  }
  if (compare(value, DECIMAL_ONE) === 0) return DECIMAL_ONE;
  if (compare(value, negate(DECIMAL_ONE)) === 0 && exp.digits <= 0) {
    return exp.digits < 0 || exp.coeff % 2n === 0n ? DECIMAL_ONE : negate(DECIMAL_ONE);
  }
  if (exp.digits <= 0)
    return integerPower(value, ensureInteger(Number(exp.coeff) * 10 ** -exp.digits, 'Exponent is out of range'), p);
  if (value.coeff < 0n) throw new Error('Fractional exponent requires non-negative base');
  // Build the reduced denominator only when it can be small enough for an exact root.
  // A denominator exceeding the coefficient bit length and scale cannot divide either.
  const normalized = normalize(value);
  const bound = abs(normalized.coeff).toString(2).length + Math.abs(normalized.digits);
  let numerator = exp.coeff;
  let twos = exp.digits;
  let fives = twos;
  while (twos && numerator % 2n === 0n) {
    numerator /= 2n;
    twos--;
  }
  while (fives && numerator % 5n === 0n) {
    numerator /= 5n;
    fives--;
  }
  const denominator = 2 ** twos * 5 ** fives;
  if (denominator <= bound) {
    const degree = ensureInteger(denominator, 'Root degree is out of range');
    const exact = exactRoot(value, degree);
    if (exact) return integerPower(exact, ensureInteger(numerator, 'Exponent is out of range'), p);
    if (numerator === 1n) return root(value, degree, p);
  }
  return adaptive(p ?? DEFAULT_PRECISION, (work) => {
    const fixed = new Fixed(work);
    return fixed.exp(fixed.mul(fixed.ln(value), fixed.from(exponent)));
  });
}

function logarithm(value: Parts, base: Parts, p: number): Parts {
  if (value.coeff <= 0n) throw new Error('Logarithm argument must be positive');
  if (base.coeff <= 0n) throw new Error('Logarithm base must be positive');
  if (compare(base, DECIMAL_ONE) === 0) throw new Error('Logarithm base cannot be one');
  if (compare(value, DECIMAL_ONE) === 0) return { coeff: 0n, digits: 0 };
  if (compare(value, base) === 0) return DECIMAL_ONE;
  const a = normalize(value);
  const b = normalize(base);
  if (a.coeff === 1n && b.coeff === 1n) {
    return divideSignificant({ coeff: BigInt(a.digits), digits: 0 }, { coeff: BigInt(b.digits), digits: 0 }, p);
  }
  // Detect integer powers of integer bases without factoring them.
  if (a.digits === 0 && b.digits === 0) {
    const common = gcd(a.coeff, b.coeff);
    if (common === a.coeff || common === b.coeff) {
      const small = a.coeff < b.coeff ? a.coeff : b.coeff;
      let large = a.coeff < b.coeff ? b.coeff : a.coeff;
      let n = 0n;
      while (large % small === 0n) {
        large /= small;
        n++;
      }
      if (large === 1n)
        return a.coeff < b.coeff
          ? divideSignificant(DECIMAL_ONE, { coeff: n, digits: 0 }, p)
          : roundSignificant({ coeff: n, digits: 0 }, p);
    }
  }
  // General logarithms are faithfully rounded (error < 1 ulp); exact midpoint detection
  // would otherwise require proving arbitrary multiplicative relations between inputs.
  return adaptive(
    p,
    (work) => {
      const fixed = new Fixed(work);
      return fixed.parts(fixed.div(fixed.ln(value), fixed.ln(base)));
    },
    true,
  );
}

class DecimalImpl implements Decimal {
  declare readonly [__brand]: never;

  public coeff: bigint;
  public digits: number;

  constructor(v: DecimalLike, digitsOverride?: bigint | number) {
    if (v instanceof DecimalImpl) {
      this.coeff = v.coeff;
      this.digits = v.digits;
      return;
    }

    switch (typeof v) {
      case 'number':
        if (v !== v || v === Infinity || v === -Infinity) throw new Error('Invalid number');
        ({ coeff: this.coeff, digits: this.digits } = parseDecimalString(v.toString()));
        return;
      case 'string':
        {
          const value = v.trim();
          if (value === '') throw new Error('Invalid number');
          ({ coeff: this.coeff, digits: this.digits } = parseDecimalString(value));
        }
        return;
      case 'bigint':
        this.coeff = v;
        this.digits = digitsOverride == null ? 0 : ensureInteger(digitsOverride);
        return;
      case 'object':
        if (v && 'coeff' in v && typeof v.coeff === 'bigint' && 'digits' in v) {
          this.coeff = v.coeff;
          this.digits = ensureInteger(v.digits);
          return;
        }
    }

    throw new Error('Invalid input type for Decimal');
  }

  clone(): DecimalImpl {
    return new DecimalImpl(this);
  }

  #set$(coeff: bigint | Parts, digits: number = 0): this {
    if (typeof coeff !== 'bigint') {
      this.digits = coeff.digits;
      this.coeff = coeff.coeff;
      return this;
    }
    this.coeff = coeff;
    this.digits = digits;
    return this;
  }

  #div$(divisor: Decimal, targetDigits: number, mode: RoundingMode): this {
    const result = divideFixed(this, divisor, targetDigits, mode);
    return this.#set$(result.coeff, result.digits);
  }

  #rescale$(targetDigits: bigint | number, mode: RoundingMode = 'trunc'): this {
    const normalized = ensureInteger(targetDigits);
    if (this.isZero()) {
      this.digits = normalized;
      return this;
    }
    if (normalized === this.digits) return this;
    if (normalized > this.digits) {
      const scale = pow10n(normalized - this.digits);
      this.coeff *= scale;
      this.digits = normalized;
      return this;
    }

    return this.#div$(DECIMAL_ONE, normalized, mode);
  }

  round$(digits: bigint | number = 0, force = false): this {
    const normalized = ensureInteger(digits);
    if (!force && this.digits <= normalized) return this;
    return this.#rescale$(normalized, 'round');
  }

  round(digits: bigint | number = 0, force = false): DecimalImpl {
    return this.clone().round$(digits, force);
  }

  roundBy$(step: DecimalLike, mode: RoundingMode = 'round'): this {
    const multiple = new DecimalImpl(step).abs();
    if (multiple.isZero()) throw new Error('Cannot align to zero');

    return this.divRound$(multiple, 0, mode).mul$(multiple);
  }

  roundBy(step: DecimalLike, mode: RoundingMode = 'round'): DecimalImpl {
    return this.clone().roundBy$(step, mode);
  }

  floor$(digits: bigint | number = 0, force = false): this {
    const normalized = ensureInteger(digits);
    if (!force && this.digits <= normalized) return this;
    return this.#rescale$(normalized, 'floor');
  }

  floor(digits: bigint | number = 0, force = false): DecimalImpl {
    return this.clone().floor$(digits, force);
  }

  floorBy$(step: DecimalLike): this {
    return this.roundBy$(step, 'floor');
  }

  floorBy(step: DecimalLike): DecimalImpl {
    return this.clone().floorBy$(step);
  }

  ceil$(digits: bigint | number = 0, force = false): this {
    const normalized = ensureInteger(digits);
    if (!force && this.digits <= normalized) return this;
    return this.#rescale$(normalized, 'ceil');
  }

  ceil(digits: bigint | number = 0, force = false): DecimalImpl {
    return this.clone().ceil$(digits, force);
  }

  ceilBy$(step: DecimalLike): this {
    return this.roundBy$(step, 'ceil');
  }

  ceilBy(step: DecimalLike): DecimalImpl {
    return this.clone().ceilBy$(step);
  }

  trunc$(digits: bigint | number = 0, force = false): this {
    const normalized = ensureInteger(digits);
    if (!force && this.digits <= normalized) return this;
    return this.#rescale$(normalized, 'trunc');
  }

  trunc(digits: bigint | number = 0, force = false): DecimalImpl {
    return this.clone().trunc$(digits, force);
  }

  rescale$(digits?: bigint | number, mode: RoundingMode = 'trunc'): this {
    if (digits == null) return this.#set$(normalize(this, 0));
    return this.#rescale$(digits, mode);
  }

  rescale(digits?: bigint | number, mode: RoundingMode = 'trunc'): DecimalImpl {
    return this.clone().rescale$(digits, mode);
  }

  truncBy$(step: DecimalLike): this {
    return this.roundBy$(step, 'trunc');
  }

  truncBy(step: DecimalLike): DecimalImpl {
    return this.clone().truncBy$(step);
  }

  #splitWith(apply: (value: DecimalImpl) => void): [DecimalImpl, DecimalImpl] {
    const original = this.clone();
    apply(this);
    return [this, original.sub$(this)];
  }

  split$(digits?: bigint | number, mode: RoundingMode = 'floor'): [DecimalImpl, DecimalImpl] {
    return this.#splitWith((value) => value.#rescale$(digits ?? 0, mode));
  }

  split(digits?: bigint | number, mode: RoundingMode = 'floor'): [Decimal, Decimal] {
    return this.clone().split$(digits, mode);
  }

  splitBy$(step: DecimalLike, mode: RoundingMode = 'floor'): [DecimalImpl, DecimalImpl] {
    return this.#splitWith((value) => value.roundBy$(step, mode));
  }

  splitBy(step: DecimalLike, mode: RoundingMode = 'floor'): [Decimal, Decimal] {
    return this.clone().splitBy$(step, mode);
  }

  frac$(): this {
    if (this.digits <= 0) {
      this.coeff = 0n;
      this.digits = 0;
      return this;
    }
    const scale = pow10n(this.digits);
    this.coeff = this.coeff % scale;
    return this;
  }

  frac(): DecimalImpl {
    return this.clone().frac$();
  }

  neg$(flag?: boolean): this {
    if (flag !== false) {
      this.coeff = -this.coeff;
    }
    return this;
  }

  neg(flag?: boolean): DecimalImpl {
    return this.clone().neg$(flag);
  }

  isZero(): boolean {
    return this.coeff === 0n;
  }

  isPositive(): boolean {
    return this.coeff > 0n;
  }

  isNegative(): boolean {
    return this.coeff < 0n;
  }

  #add$(v: DecimalLike, subtract = false): this {
    const { digits, aCoeff, bCoeff } = alignForOperation(this, Decimal(v));
    this.coeff = subtract ? aCoeff - bCoeff : aCoeff + bCoeff;
    this.digits = digits;
    return this;
  }

  add$(v: DecimalLike): this {
    return this.#add$(v);
  }

  add(v: DecimalLike): DecimalImpl {
    return this.clone().add$(v);
  }

  sub$(v: DecimalLike): this {
    return this.#add$(v, true);
  }

  sub(v: DecimalLike): DecimalImpl {
    return this.clone().sub$(v);
  }

  mul$(v: DecimalLike, digits?: number | bigint | undefined): this {
    const value = Decimal(v);
    const target = ensureInteger(this.digits + value.digits);
    this.coeff *= value.coeff;
    this.digits = target;
    if (digits !== undefined) this.round$(digits);
    return this;
  }

  mul(v: DecimalLike, digits?: number | bigint | undefined): DecimalImpl {
    return this.clone().mul$(v, digits);
  }

  shift10$(exponent: bigint | number): this {
    const normalized = ensureInteger(exponent, 'Shift amount must be an integer');
    if (normalized === 0) return this;
    this.digits = ensureInteger(this.digits - normalized);
    return this;
  }

  shift10(exponent: bigint | number): DecimalImpl {
    return this.clone().shift10$(exponent);
  }

  inverse$(significantDigits?: bigint | number): this {
    return this.#set$(new DecimalImpl(1n).div$(this, significantDigits));
  }

  inverse(significantDigits?: bigint | number): DecimalImpl {
    return this.clone().inverse$(significantDigits);
  }

  div$(v: DecimalLike, significantDigits?: bigint | number, mode: RoundingMode = 'round'): this {
    if (significantDigits === undefined) return this.divExact$(v, DEFAULT_PRECISION, mode);
    const p = ensurePrecision(significantDigits);
    const result = divideSignificant(this, Decimal(v), p, mode);
    return this.#set$(result.coeff, result.digits);
  }

  div(v: DecimalLike, significantDigits?: bigint | number, mode: RoundingMode = 'round'): DecimalImpl {
    return this.clone().div$(v, significantDigits, mode);
  }

  divExact$(v: DecimalLike, fallbackPrecision?: bigint | number, mode: RoundingMode = 'round'): this {
    const fallback = fallbackPrecision === undefined ? undefined : ensurePrecision(fallbackPrecision);
    const divisor = Decimal(v);
    const exact = divideExact(this, divisor);
    if (exact) return this.#set$(exact.coeff, exact.digits);
    if (fallback === undefined) throw new RangeError('Non-terminating decimal expansion');
    const result = divideSignificant(this, divisor, fallback, mode);
    return this.#set$(result.coeff, result.digits);
  }

  divExact(v: DecimalLike, fallbackPrecision?: bigint | number, mode: RoundingMode = 'round'): DecimalImpl {
    return this.clone().divExact$(v, fallbackPrecision, mode);
  }

  divRound$(v: DecimalLike, digits: bigint | number = 0, mode: RoundingMode = 'round'): this {
    const target = ensureInteger(digits);
    return this.#div$(Decimal(v), target, mode);
  }

  divRound(v: DecimalLike, digits: bigint | number = 0, mode: RoundingMode = 'round'): DecimalImpl {
    return this.clone().divRound$(v, digits, mode);
  }

  divFloor$(v: DecimalLike, digits: bigint | number = 0): this {
    return this.divRound$(v, digits, 'floor');
  }

  divFloor(v: DecimalLike, digits: bigint | number = 0): DecimalImpl {
    return this.clone().divFloor$(v, digits);
  }

  divCeil$(v: DecimalLike, digits: bigint | number = 0): this {
    return this.divRound$(v, digits, 'ceil');
  }

  divCeil(v: DecimalLike, digits: bigint | number = 0): DecimalImpl {
    return this.clone().divCeil$(v, digits);
  }

  divTrunc$(v: DecimalLike, digits: bigint | number = 0): this {
    return this.divRound$(v, digits, 'trunc');
  }

  divTrunc(v: DecimalLike, digits: bigint | number = 0): DecimalImpl {
    return this.clone().divTrunc$(v, digits);
  }

  abs$(): this {
    if (this.isNegative()) this.coeff = -this.coeff;
    return this;
  }

  abs(): DecimalImpl {
    return this.clone().abs$();
  }

  mod$(v: DecimalLike): this {
    const value = Decimal(v);
    if (value.isZero()) throw new Error('Division by zero');
    const { digits, aCoeff, bCoeff } = alignForOperation(this, value);
    this.coeff = aCoeff % bCoeff;
    this.digits = digits;
    return this;
  }

  mod(v: DecimalLike): DecimalImpl {
    return this.clone().mod$(v);
  }

  modPositive$(v: DecimalLike): this {
    const divisor = Decimal(v);
    if (divisor.isNegative()) throw new Error('Modulo divisor must be positive');
    this.mod$(divisor);
    if (this.isNegative()) this.add$(divisor);
    return this;
  }

  modPositive(v: DecimalLike): DecimalImpl {
    return this.clone().modPositive$(v);
  }

  clamp$(minValue: DecimalLike | undefined, maxValue: DecimalLike | undefined): this {
    const lower = Decimal(minValue);
    const upper = Decimal(maxValue);
    if (lower && upper && lower.gt(upper)) throw new Error('Invalid clamp range');
    if (lower && this.lt(lower)) {
      this.coeff = lower.coeff;
      this.digits = lower.digits;
      return this;
    }
    if (upper && this.gt(upper)) {
      this.coeff = upper.coeff;
      this.digits = upper.digits;
      return this;
    }
    return this;
  }

  clamp(minValue: DecimalLike | undefined, maxValue: DecimalLike | undefined): DecimalImpl {
    return this.clone().clamp$(minValue, maxValue);
  }

  cmp(v: DecimalLike): number {
    return compare(this, Decimal(v));
  }

  eq(v: DecimalLike): boolean {
    return this.cmp(v) === 0;
  }

  neq(v: DecimalLike): boolean {
    return this.cmp(v) !== 0;
  }

  lt(v: DecimalLike): boolean {
    return this.cmp(v) < 0;
  }

  gt(v: DecimalLike): boolean {
    return this.cmp(v) > 0;
  }

  le(v: DecimalLike): boolean {
    return this.cmp(v) <= 0;
  }

  ge(v: DecimalLike): boolean {
    return this.cmp(v) >= 0;
  }

  between(minValue: DecimalLike | undefined, maxValue: DecimalLike | undefined): boolean {
    const lower = Decimal(minValue);
    const upper = Decimal(maxValue);
    if (lower && upper && lower.gt(upper)) throw new Error('Invalid between range');
    if (lower && this.lt(lower)) return false;
    if (upper && this.gt(upper)) return false;
    return true;
  }

  isCloseTo(v: DecimalLike, tolerance: DecimalLike): boolean {
    const toleranceValue = Decimal(tolerance);
    if (toleranceValue.isNegative()) throw new Error('Tolerance must be non-negative');

    return this.sub(v).abs$().le(toleranceValue);
  }

  pow$(exponent: DecimalLike, significantDigits?: bigint | number): this {
    const p = significantDigits === undefined ? undefined : ensurePrecision(significantDigits);
    const result = power(this, Decimal(exponent), p);
    return this.#set$(result.coeff, result.digits);
  }

  pow(exponent: DecimalLike, significantDigits?: bigint | number): DecimalImpl {
    return this.clone().pow$(exponent, significantDigits);
  }

  root$(degreeInput: bigint | number, significantDigits?: bigint | number): this {
    const degree = ensureInteger(degreeInput, 'Root degree must be an integer');
    const p = significantDigits === undefined ? undefined : ensurePrecision(significantDigits);
    const result = root(this, degree, p);
    return this.#set$(result.coeff, result.digits);
  }

  root(degree: bigint | number, significantDigits?: bigint | number): DecimalImpl {
    return this.clone().root$(degree, significantDigits);
  }

  sqrt$(significantDigits?: bigint | number): this {
    return this.root$(2n, significantDigits);
  }

  sqrt(significantDigits?: bigint | number): DecimalImpl {
    return this.clone().sqrt$(significantDigits);
  }

  log$(base: DecimalLike, significantDigits: bigint | number = DEFAULT_PRECISION): this {
    const p = ensurePrecision(significantDigits);
    const result = logarithm(this, Decimal(base), p);
    return this.#set$(result.coeff, result.digits);
  }

  log(base: DecimalLike, significantDigits: bigint | number = DEFAULT_PRECISION): DecimalImpl {
    return this.clone().log$(base, significantDigits);
  }

  sign$() {
    if (this.isZero()) return this;
    this.coeff = this.coeff < 0n ? -1n : 1n;
    this.digits = 0;
    return this;
  }

  sign() {
    return this.clone().sign$();
  }

  order(): bigint {
    return BigInt(order(this));
  }

  toFixed(fractionDigits: bigint | number): string {
    const errorMessage = 'Fraction digits must be a non-negative integer';
    const digits = ensureInteger(fractionDigits, errorMessage);
    if (digits < 0) throw new Error(errorMessage);
    return this.round(digits, true).toString();
  }

  toString(): string {
    if (this.coeff === 0n) {
      if (this.digits <= 0) return '0';
      return `0.${'0'.repeat(this.digits)}`;
    }
    const negative = this.coeff < 0n;
    const sign = negative ? '-' : '';
    const coeffDigits = (negative ? -this.coeff : this.coeff).toString();
    if (this.digits <= 0) {
      return `${sign}${coeffDigits}${'0'.repeat(-this.digits)}`;
    }
    const decimals = this.digits;
    const len = coeffDigits.length;
    if (len > decimals) {
      const split = len - decimals;
      return `${sign}${coeffDigits.slice(0, split)}.${coeffDigits.slice(split)}`;
    }
    if (len === decimals) {
      return `${sign}0.${coeffDigits}`;
    }
    return `${sign}0.${'0'.repeat(decimals - len)}${coeffDigits}`;
  }

  [Symbol.for('nodejs.util.inspect.custom')](_depth: number, options: object) {
    if ('colors' in options && options?.colors) {
      return `\x1b[33m${this.toString()}\x1b[m \x1b[90m(${this.coeff} * 10 ** ${-this.digits})\x1b[m`;
    }
    return this.toString();
  }

  number(): number {
    let coeff = Number(this.coeff);
    let digits = this.digits;
    if (!Number.isFinite(coeff) && digits > 0) {
      let bigintCoeff = this.coeff;
      // Retain Number's decimal range plus guard digits before discarding insignificant BigInt digits.
      const initialShift = Math.max(0, digits - 340);
      if (initialShift > 0) {
        bigintCoeff /= pow10n(initialShift);
        digits -= initialShift;
      }
      while (!Number.isFinite((coeff = Number(bigintCoeff))) && digits > 0) {
        const shift = Math.min(digits, 32);
        bigintCoeff /= pow10n(shift);
        digits -= shift;
      }
      if (coeff === 0) return this.coeff < 0n ? -0 : 0;
    }
    let exponent = -digits;
    while (exponent < -308) {
      coeff *= 1e-308;
      if (coeff === 0) return coeff;
      exponent += 308;
    }
    while (exponent > 308) {
      coeff *= 1e308;
      if (!Number.isFinite(coeff)) return coeff;
      exponent -= 308;
    }
    return exponent < 0 ? coeff / 10 ** -exponent : coeff * 10 ** exponent;
  }

  integer(): bigint {
    if (this.digits <= 0) {
      return this.coeff * pow10n(-this.digits);
    }
    return this.coeff / pow10n(this.digits);
  }
}

const DEFAULT_PRECISION = 18;
const DECIMAL_ONE = new DecimalImpl(1n);

// create pow10n cache
const pow10nCache: bigint[] = [];

(function createPowCache() {
  for (let i = 0; i < 256; i++) {
    pow10nCache[i] = 10n ** BigInt(i);
  }
})();

export function Decimal(v: null): null;
export function Decimal(v: undefined): undefined;
export function Decimal(v: DecimalLike): Decimal;
export function Decimal(v: DecimalLike | null): Decimal | null;
export function Decimal(v: DecimalLike | undefined): Decimal | undefined;
export function Decimal(v: DecimalLike | undefined | null): Decimal | undefined | null;
export function Decimal(v: DecimalLike | undefined | null): Decimal | undefined | null {
  if (v == null) return v;
  if (isDecimal(v)) return v;
  return new DecimalImpl(v) as Decimal;
}

export function isDecimal(v: unknown): v is Decimal {
  return v instanceof DecimalImpl;
}

export function isDecimalType(v: unknown): v is Decimal | DecimalType {
  if (isDecimal(v)) return true;
  if (typeof v === 'object' && v && 'coeff' in v && 'digits' in v && typeof v.coeff === 'bigint') {
    return true;
  }
  return false;
}

export function isDecimalLike(v: unknown): v is DecimalLike {
  if (isDecimalType(v)) return true;
  if (typeof v === 'string') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'bigint') return true;
  return false;
}

export function pow10(n: bigint | number): Decimal {
  const digits = -ensureInteger(n, 'Exponent must be an integer') || 0; // disallow -0
  return new DecimalImpl(1n, digits);
}

export function minmax(...values: (DecimalLike | null | undefined)[]): [Decimal | null, Decimal | null] {
  let minValue: Decimal | null = null;
  let maxValue: Decimal | null = null;
  for (let i = 0; i < values.length; i++) {
    const candidate = Decimal(values[i]);
    if (candidate == null) continue;
    if (minValue === null || candidate.lt(minValue)) minValue = candidate;
    if (maxValue === null || candidate.gt(maxValue)) maxValue = candidate;
  }
  return [minValue, maxValue];
}

export function min(...values: (DecimalLike | null | undefined)[]): Decimal | null {
  return minmax(...values)[0];
}

export function max(...values: (DecimalLike | null | undefined)[]): Decimal | null {
  return minmax(...values)[1];
}

export function equals(a: DecimalLike | null | undefined, b: DecimalLike | null | undefined) {
  return a === b || (a != null && b != null && Decimal(a).eq(Decimal(b)));
}

type typeOfIsDecimal = typeof isDecimal;
type typeOfIsDecimalType = typeof isDecimalType;
type typeOfIsDecimalLike = typeof isDecimalLike;
type typeOfPow10 = typeof pow10;
type typeOfMinmax = typeof minmax;
type typeOfMin = typeof min;
type typeOfMax = typeof max;
type typeOfEquals = typeof equals;

// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace Decimal {
  export const isDecimal: typeOfIsDecimal;
  export const isDecimalType: typeOfIsDecimalType;
  export const isDecimalLike: typeOfIsDecimalLike;
  export const pow10: typeOfPow10;
  export const minmax: typeOfMinmax;
  export const min: typeOfMin;
  export const max: typeOfMax;
  export const equals: typeOfEquals;
}

Object.assign(Decimal, {
  isDecimal,
  isDecimalType,
  isDecimalLike,
  pow10,
  minmax,
  min,
  max,
  equals,
});

export default Decimal;
