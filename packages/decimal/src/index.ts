const __brand = Symbol.for('Decimal');

export interface DecimalInstance {
  readonly [__brand]: never;
}

export type DecimalLike = number | string | bigint | DecimalInstance | { coeff: bigint; digits: bigint };
export type RoundingMode = 'trunc' | 'floor' | 'ceil' | 'round';

export interface Decimal {
  readonly [__brand]: never;

  coeff: bigint;
  digits: bigint;

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

  // Sign and absolute
  neg$(): this;
  neg(): Decimal;
  abs$(): this;
  abs(): Decimal;
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
  inverse$(digits?: bigint | number): this;
  inverse(digits?: bigint | number): Decimal;
  div$(v: DecimalLike, digits?: bigint | number, mode?: RoundingMode): this;
  div(v: DecimalLike, digits?: bigint | number): Decimal;

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
  pow$(exponent: DecimalLike, digits?: bigint | number): this;
  pow(exponent: DecimalLike, digits?: bigint | number): Decimal;
  root$(degree: bigint | number, digits?: bigint | number): this;
  root(degree: bigint | number, digits?: bigint | number): Decimal;
  sqrt$(digits?: bigint | number): this;
  sqrt(digits?: bigint | number): Decimal;
  log$(base: DecimalLike, digits?: bigint | number): this;
  log(base: DecimalLike, digits?: bigint | number): Decimal;
  order(): bigint;

  // Conversion
  toString(): string;
  toFixed(fractionDigits: bigint | number): string;

  number(): number;
  integer(): bigint;
}

function ensureInteger(value: bigint | number, message = 'Digits must be an integer'): bigint {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) throw new Error(message);
    return BigInt(value);
  }
  return value;
}

function ensureDigits(value: bigint | number): bigint {
  const result = ensureInteger(value);
  if (result < 0n) return 0n;
  return result;
}

function pow5n(n: bigint | number): bigint {
  const nn = Number(n);
  if (nn < pow5nCache.length) return pow5nCache[nn];
  return 5n ** BigInt(n);
}

function pow10n(n: bigint | number): bigint {
  const nn = Number(n);
  if (nn < pow10nCache.length) return pow10nCache[nn];
  return 10n ** BigInt(n);
}

function powInt(base: Decimal, exponentInput: bigint | number, digits?: bigint | number): Decimal {
  let exponent = BigInt(exponentInput);
  if (exponent <= 0n) return new DecimalImpl(1n);
  const result = new DecimalImpl(1n);
  const factor = base.clone();
  while (true) {
    if (exponent & 1n) result.mul$(factor, digits);
    exponent >>= 1n;
    if (exponent === 0n) break;
    factor.mul$(factor, digits);
  }
  return result;
}

function powFrac(base: Decimal, fractional: Decimal, digits: bigint, digitsCount: number): Decimal {
  if (fractional.isZero() || digitsCount <= 0) return new DecimalImpl(1n);
  const { guardPrec, rootPrec } = estimatePowFractionalSettings(digits, digitsCount);
  const digitsString = abs(fractional.coeff).toString().padStart(digitsCount, '0');
  let progressiveRoot = base.round(rootPrec);
  const result = new DecimalImpl(1n);
  for (let i = 0; i < digitsCount; i++) {
    progressiveRoot = progressiveRoot.root(10n, rootPrec);
    const digit = digitsString.charCodeAt(i) - 48;
    if (digit <= 0) continue;
    const factor = powInt(progressiveRoot.clone(), digit, guardPrec);
    result.mul$(factor, guardPrec);
  }
  return result.round$(digits);
}

function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function parsePlainDecimal(input: string): { coeff: bigint; digits: bigint } {
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
  let intPart = str;
  let fracPart = '';
  if (dotIndex >= 0) {
    intPart = str.slice(0, dotIndex);
    fracPart = str.slice(dotIndex + 1);
  }
  if (intPart === '') intPart = '0';
  const combined = (intPart + fracPart).replace(/^0+/, '');
  const coeffStr = combined === '' ? '0' : combined;
  const coeff = sign * BigInt(coeffStr);
  const digits = BigInt(fracPart.length);
  return { coeff, digits };
}

function parseDecimalString(value: string): { coeff: bigint; digits: bigint } {
  const exponentIndex = value.search(/[eE]/);
  if (exponentIndex === -1) return parsePlainDecimal(value);
  const basePart = value.slice(0, exponentIndex);
  const exponentPart = value.slice(exponentIndex + 1);
  if (exponentPart.trim() === '') throw new Error('Invalid number');
  const { coeff, digits } = parsePlainDecimal(basePart);
  const adjustment = BigInt(exponentPart);
  return { coeff, digits: digits - adjustment };
}

function alignForOperation(a: Decimal, b: Decimal) {
  const digits = a.digits > b.digits ? a.digits : b.digits;
  const aDiff = digits - a.digits;
  const bDiff = digits - b.digits;
  return {
    digits,
    aCoeff: a.coeff * pow10n(aDiff),
    bCoeff: b.coeff * pow10n(bDiff),
  };
}

function toBoundedNonNegativeNumber(value: bigint): number {
  const numeric = Math.max(0, Number(value));
  return Math.min(Number.MAX_SAFE_INTEGER, numeric);
}

function estimateLogGuardSettings(target: number, baseDigits: bigint, valueDigits: bigint) {
  const baseScale = toBoundedNonNegativeNumber(baseDigits);
  const valueScale = toBoundedNonNegativeNumber(valueDigits);
  const minGuard = Math.max(baseScale, valueScale) + 1;
  let guardPrec = Math.max(minGuard, 1);
  let fracPrec = target + guardPrec;
  while (true) {
    const bits = Math.ceil(fracPrec * LOG_BINARY_PER_DECIMAL) + guardPrec;
    const ops = Math.max(bits * 2, 1);
    const required = Math.max(minGuard, Math.ceil(Math.log10(ops)) + 1);
    if (required <= guardPrec) {
      const divPrec = fracPrec + guardPrec;
      return { guardPrec, fracPrec, bits, divPrec };
    }
    guardPrec = required;
    fracPrec = target + guardPrec;
  }
}

function estimatePowFractionalSettings(target: bigint, digitsCount: number) {
  const count = Math.max(1, digitsCount);
  const guardExtra = Math.max(6, Math.ceil(Math.log10(count * 4)) + 2);
  const guardPrec = target + BigInt(guardExtra);
  const rootPrec = guardPrec + BigInt(Math.max(guardExtra, 6));
  return { guardPrec, rootPrec };
}

function estimateRootIterSettings(target: bigint, degree: bigint) {
  const degreeDigits = Math.max(1, degree.toString().replace('-', '').length);
  const extra = Math.max(12, degreeDigits + 4);
  const iterPrec = target + BigInt(extra);
  const stopShift = target + 2n;
  return { iterPrec, stopShift };
}

function extractLogIntegerPositive(
  value: Decimal,
  base: Decimal,
  digits: number,
  guardPrec: number,
): {
  exponent: bigint;
  remainder: Decimal;
} {
  const powers: Decimal[] = [];
  const exponents: bigint[] = [];
  let power = new DecimalImpl(base);
  let exponent = 1n;
  const divDigits = digits + Math.max(guardPrec, 1);
  while (power.le(value)) {
    powers.push(power);
    exponents.push(exponent);
    power = power.mul(power);
    exponent *= 2n;
  }
  const remainder = new DecimalImpl(value);
  let result = 0n;
  for (let i = powers.length - 1; i >= 0; i--) {
    const candidate = powers[i];
    if (remainder.ge(candidate)) {
      remainder.div$(candidate, divDigits);
      result += exponents[i];
    }
  }
  return { exponent: result, remainder };
}

function extractLogIntegerAndNormalize(
  value: Decimal,
  base: Decimal,
  digits: number,
  guardPrec: number,
): {
  exponent: bigint;
  remainder: Decimal;
} {
  const divDigits = digits + Math.max(guardPrec, 1);
  if (value.eq(DECIMAL_ONE)) return { exponent: 0n, remainder: DECIMAL_ONE.clone() };
  if (value.ge(DECIMAL_ONE)) return extractLogIntegerPositive(value, base, digits, guardPrec);
  const positive = extractLogIntegerPositive(DECIMAL_ONE.div(value, divDigits), base, digits, guardPrec);
  if (positive.remainder.eq(DECIMAL_ONE)) {
    return { exponent: -positive.exponent, remainder: DECIMAL_ONE.clone() };
  }
  return {
    exponent: -positive.exponent - 1n,
    remainder: DECIMAL_ONE.div(positive.remainder, divDigits).mul$(base),
  };
}

class DecimalImpl implements Decimal {
  declare readonly [__brand]: never;

  public coeff: bigint;
  public digits: bigint;

  constructor(v: DecimalLike, digitsOverride?: bigint) {
    if (typeof v === 'number') {
      if (v !== v || v === Infinity || v === -Infinity) throw new Error('Invalid number');
      ({ coeff: this.coeff, digits: this.digits } = parseDecimalString(v.toString()));
    } else if (typeof v === 'string') {
      const trimmed = v.trim();
      if (trimmed === '') throw new Error('Invalid number');
      ({ coeff: this.coeff, digits: this.digits } = parseDecimalString(trimmed));
    } else if (typeof v === 'bigint') {
      this.coeff = v;
      this.digits = digitsOverride ?? 0n;
    } else if (
      typeof v === 'object' &&
      v !== null &&
      'coeff' in v &&
      typeof v.coeff === 'bigint' &&
      'digits' in v &&
      typeof v.digits === 'bigint'
    ) {
      this.coeff = v.coeff;
      this.digits = v.digits;
    } else {
      throw new Error('Invalid input type for Decimal');
    }
  }

  clone(): DecimalImpl {
    return new DecimalImpl({ coeff: this.coeff, digits: this.digits });
  }

  #set$(coeff: bigint | Decimal, digits: bigint = 0n): this {
    if (isDecimal(coeff)) {
      digits = coeff.digits;
      coeff = coeff.coeff;
    }
    this.coeff = coeff;
    this.digits = digits;
    return this;
  }

  #div$(divisor: Decimal, targetDigits: bigint, mode: RoundingMode): this {
    let numerator = this.coeff;
    let denominator = divisor.coeff;

    const shift = divisor.digits + targetDigits - this.digits;
    if (shift >= 0n) {
      numerator *= pow10n(shift);
    } else {
      denominator *= pow10n(-shift);
    }

    let quotient = numerator / denominator;
    const remainder = numerator - quotient * denominator;
    if (remainder !== 0n && mode !== 'trunc') {
      const positive = numerator >= 0n;
      switch (mode) {
        case 'floor':
          if (!positive) quotient -= 1n;
          break;
        case 'ceil':
          if (positive) quotient += 1n;
          break;
        case 'round': {
          const absRemainder = abs(remainder);
          const threshold = denominator < 0n ? -denominator : denominator;
          if (absRemainder * 2n >= threshold) {
            quotient += positive ? 1n : -1n;
          }
          break;
        }
        default:
          break;
      }
    }

    return this.#set$(quotient, targetDigits);
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

  #stripTrailingZeros$(): this {
    if (this.digits <= 0n || this.coeff === 0n) return this;
    while (this.digits > 0n && this.coeff % 10n === 0n) {
      this.coeff /= 10n;
      this.digits -= 1n;
    }
    return this;
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

    return this.div$(multiple, 0n, mode).mul$(multiple);
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
    if (digits == null) return this.#stripTrailingZeros$();
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
    return this.#splitWith((value) => value.#rescale$(digits ?? 0n, mode));
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

  neg$(): this {
    this.coeff = -this.coeff;
    return this;
  }

  neg(): DecimalImpl {
    return this.clone().neg$();
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

  add$(v: DecimalLike): this {
    const value = Decimal(v);
    const { digits, aCoeff, bCoeff } = alignForOperation(this, value);
    this.coeff = aCoeff + bCoeff;
    this.digits = digits;
    return this;
  }

  add(v: DecimalLike): DecimalImpl {
    return this.clone().add$(v);
  }

  sub$(v: DecimalLike): this {
    const value = Decimal(v);
    const { digits, aCoeff, bCoeff } = alignForOperation(this, value);
    this.coeff = aCoeff - bCoeff;
    this.digits = digits;
    return this;
  }

  sub(v: DecimalLike): DecimalImpl {
    return this.clone().sub$(v);
  }

  mul$(v: DecimalLike, digits?: number | bigint | undefined): this {
    const value = Decimal(v);
    this.coeff *= value.coeff;
    this.digits += value.digits;
    if (digits !== undefined) this.round$(digits);
    return this;
  }

  mul(v: DecimalLike, digits?: number | bigint | undefined): DecimalImpl {
    return this.clone().mul$(v, digits);
  }

  shift10$(exponent: bigint | number): this {
    const normalized = ensureInteger(exponent, 'Shift amount must be an integer');
    if (normalized === 0n) return this;
    this.digits -= normalized;
    return this;
  }

  shift10(exponent: bigint | number): DecimalImpl {
    return this.clone().shift10$(exponent);
  }

  inverse$(digits: bigint | number = DEFAULT_DIVISION_PRECISION): this {
    if (this.isZero()) throw new Error('Division by zero');
    const target = ensureDigits(digits);
    const divisor = this.clone();
    return this.#set$(1n).div$(divisor, target);
  }

  inverse(digits: bigint | number = DEFAULT_DIVISION_PRECISION): DecimalImpl {
    return this.clone().inverse$(digits);
  }

  div$(v: DecimalLike, digits?: bigint | number, mode: RoundingMode = 'round'): this {
    const stripTrailingZeros = digits === undefined;
    const targetDigits = ensureDigits(digits ?? DEFAULT_DIVISION_PRECISION);
    const divisor = Decimal(v);
    if (divisor.isZero()) throw new Error('Division by zero');
    if (this.isZero()) return this;

    this.#div$(divisor, targetDigits, mode);
    return stripTrailingZeros ? this.#stripTrailingZeros$() : this;
  }

  div(v: DecimalLike, digits?: bigint | number, mode: RoundingMode = 'round'): DecimalImpl {
    return this.clone().div$(v, digits, mode);
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
    const other = Decimal(v);
    const { aCoeff, bCoeff } = alignForOperation(this, other);
    if (aCoeff === bCoeff) return 0;
    return aCoeff > bCoeff ? 1 : -1;
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

  pow$(exponent: DecimalLike, digits: bigint | number = DEFAULT_DIVISION_PRECISION): this {
    const prec = ensureDigits(digits);
    const expVal = Decimal(exponent);
    if (expVal.isZero()) return this.#set$(1n);
    if (this.isZero()) {
      if (expVal.isNegative()) throw new Error('Zero to negative exponent is undefined');
      return this;
    }
    const negExp = expVal.isNegative();
    const [intPart, fracPart] = expVal.abs().split$();
    const base = this.clone();
    const fracScale = fracPart.isZero() ? 0 : Number(fracPart.digits);
    if (base.isNegative() && fracScale > 0) throw new Error('Fractional exponent requires non-negative base');

    const result = powInt(base, intPart.coeff);
    let fracPrec = prec;
    if (fracScale > 0) {
      const fracPad = BigInt(Math.max(4, fracScale));
      fracPrec = prec + fracPad;
    }
    const fracFactor = powFrac(base, fracPart, fracPrec, fracScale);
    if (fracScale > 0) {
      result.mul$(fracFactor, fracPrec);
    }
    const workPrec = fracPrec > prec ? fracPrec : prec;
    const outPrec = fracScale > 0 ? fracPrec : prec;

    if (negExp) {
      this.#set$(1n).div$(result, workPrec);
    } else {
      result.round$(workPrec, true);
      this.#set$(result);
    }

    this.round$(outPrec, outPrec === 0n);
    return this;
  }

  pow(exponent: DecimalLike, digits: bigint | number = DEFAULT_DIVISION_PRECISION): DecimalImpl {
    return this.clone().pow$(exponent, digits);
  }

  root$(degreeInput: bigint | number, digits: bigint | number = DEFAULT_DIVISION_PRECISION): this {
    const degree = ensureInteger(degreeInput, 'Root degree must be an integer');
    if (degree <= 0n) throw new Error('Invalid root degree');
    const prec = ensureDigits(digits);
    if (degree === 1n) {
      return prec < this.digits ? this : this.trunc$(prec, true);
    }
    if (this.isZero()) return this;

    const wasNegative = this.isNegative();
    if (wasNegative && degree % 2n === 0n) throw new Error('Even root of negative value is not defined');

    const magnitude = this.abs();
    const degMinusOne = degree - 1n;
    const { iterPrec, stopShift } = estimateRootIterSettings(prec, degree);
    const tolerance = pow10(-stopShift);

    const initial = (() => {
      const approx = magnitude.number();
      if (Number.isFinite(approx) && approx > 0) {
        const degAsNumber = Number(degree);
        if (degAsNumber > 0) {
          const rootApprox = Math.pow(approx, 1 / degAsNumber);
          if (Number.isFinite(rootApprox) && rootApprox > 0) {
            const guess = new DecimalImpl(rootApprox);
            return guess.round$(iterPrec, true);
          }
        }
      }
      const orderEstimate = magnitude.order();
      return new DecimalImpl(pow10(orderEstimate / degree)).round$(iterPrec, true);
    })();

    this.#set$(initial.coeff, initial.digits);
    if (this.isZero()) this.#set$(1n);

    for (let i = 0; i < 64; i++) {
      const power = powInt(this.clone(), degMinusOne, iterPrec);
      if (power.isZero()) break;
      const term = magnitude.div(power, iterPrec);
      const next = this.mul(degMinusOne, iterPrec).add$(term).div$(degree, iterPrec);
      if (next.isCloseTo(this, tolerance) || next.eq(this)) {
        this.#set$(next);
        break;
      }
      this.#set$(next);
    }

    this.round$(iterPrec, true);
    this.round$(prec, prec === 0n);
    if (wasNegative) this.neg$();
    return this;
  }

  root(degree: bigint | number, digits: bigint | number = DEFAULT_DIVISION_PRECISION): DecimalImpl {
    return this.clone().root$(degree, digits);
  }

  sqrt$(digits: bigint | number = DEFAULT_DIVISION_PRECISION): this {
    return this.root$(2n, digits);
  }

  sqrt(digits: bigint | number = DEFAULT_DIVISION_PRECISION): DecimalImpl {
    return this.clone().sqrt$(digits);
  }

  log$(base: DecimalLike, digits: bigint | number = DEFAULT_DIVISION_PRECISION): this {
    const precision = Number(ensureDigits(digits));
    const baseValue = new DecimalImpl(base);

    if (!this.isPositive()) throw new Error('Logarithm argument must be positive');
    if (!baseValue.isPositive()) throw new Error('Logarithm base must be positive');
    if (baseValue.eq(DECIMAL_ONE)) throw new Error('Logarithm base cannot be one');

    const { guardPrec, fracPrec, bits, divPrec } = estimateLogGuardSettings(precision, baseValue.digits, this.digits);

    const baseBelowOne = baseValue.lt(DECIMAL_ONE);
    const baseNorm = baseBelowOne ? DECIMAL_ONE.div(baseValue, divPrec) : baseValue;

    const { exponent: intExp, remainder } = extractLogIntegerAndNormalize(this, baseNorm, fracPrec, guardPrec);

    this.#set$(intExp);
    if (fracPrec > 0) {
      let flags = 0n;
      for (let i = 0; i < bits; i++) {
        remainder.mul$(remainder, divPrec);
        flags <<= 1n;
        if (remainder.ge(baseNorm)) {
          remainder.div$(baseNorm, divPrec);
          flags |= 1n;
        }
      }
      if (flags !== 0n) {
        this.add$({ coeff: flags * pow5n(bits), digits: BigInt(bits) });
      }
    }

    const finalPrec = precision === 0 ? 0 : fracPrec;
    this.round$(finalPrec);
    if (baseBelowOne) this.neg$();
    return this;
  }

  log(base: DecimalLike, digits: bigint | number = DEFAULT_DIVISION_PRECISION): DecimalImpl {
    return this.clone().log$(base, digits);
  }

  order(): bigint {
    if (this.isZero()) throw new RangeError('order undefined for 0');
    return BigInt(abs(this.coeff).toString().length) - 1n - this.digits;
  }

  toFixed(fractionDigits: bigint | number): string {
    const errorMessage = 'Fraction digits must be a non-negative integer';
    const digits = ensureInteger(fractionDigits, errorMessage);
    if (digits < 0n) throw new Error(errorMessage);
    return this.round(digits, true).toString();
  }

  toString(): string {
    if (this.coeff === 0n) {
      if (this.digits <= 0n) return '0';
      return `0.${'0'.repeat(Number(this.digits))}`;
    }
    const negative = this.coeff < 0n;
    const sign = negative ? '-' : '';
    const coeffDigits = (negative ? -this.coeff : this.coeff).toString();
    if (this.digits <= 0n) {
      return `${sign}${coeffDigits}${'0'.repeat(Number(-this.digits))}`;
    }
    const decimals = Number(this.digits);
    const padded = coeffDigits.padStart(decimals + 1, '0');
    const split = padded.length - decimals;
    const integerPart = padded.slice(0, split);
    const fractionPart = padded.slice(split).padEnd(decimals, '0');
    return `${sign}${integerPart}.${fractionPart}`;
  }

  [Symbol.for('nodejs.util.inspect.custom')](_depth: number, options: object) {
    if ('colors' in options && options?.colors) {
      return `\x1b[33m${this.toString()}\x1b[m \x1b[90m(${this.coeff} * 10 ** ${-this.digits})\x1b[m`;
    }
    return this.toString();
  }

  number(): number {
    return Number(this.toString());
  }

  integer(): bigint {
    if (this.digits <= 0n) {
      return this.coeff * pow10n(-this.digits);
    }
    return this.coeff / pow10n(this.digits);
  }
}

const DEFAULT_DIVISION_PRECISION = 18n;
const LOG_BINARY_PER_DECIMAL = Math.log2(10);

const DECIMAL_ONE = new DecimalImpl(1n);

// create pow10n cache
const pow5nCache: bigint[] = [];
const pow10nCache: bigint[] = [];

(function craetePowCache() {
  for (let i = 0; i < 256; i++) {
    pow10nCache[i] = 10n ** BigInt(i);
    pow5nCache[i] = 5n ** BigInt(i);
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

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Decimal {
  export function isDecimal(v: unknown): v is Decimal {
    return v instanceof DecimalImpl;
  }

  export function isDecimalLike(v: unknown): v is DecimalLike {
    if (isDecimal(v)) return true;
    if (typeof v === 'string') return true;
    if (typeof v === 'number') return true;
    if (typeof v === 'bigint') return true;
    if (
      typeof v === 'object' &&
      v &&
      'coeff' in v &&
      'digits' in v &&
      typeof v.coeff === 'bigint' &&
      typeof v.digits === 'bigint'
    ) {
      return true;
    }
    return false;
  }

  export function pow10(n: bigint | number): Decimal {
    return new DecimalImpl({ coeff: 1n, digits: -BigInt(n) });
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

  /* c8 ignore next */
  export function max(...values: (DecimalLike | null | undefined)[]): Decimal | null {
    return minmax(...values)[1];
  }
}

export const isDecimal = Decimal.isDecimal;
export const isDecimalLike = Decimal.isDecimalLike;
export const pow10 = Decimal.pow10;
export const minmax = Decimal.minmax;
export const min = Decimal.min;
export const max = Decimal.max;

export default Decimal;
