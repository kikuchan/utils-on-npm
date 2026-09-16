import { describe, expect, it, vi } from 'vitest';
import type { RoundingMode } from '../src/index.ts';
import { Decimal, type DecimalLike, isDecimal, max, min, minmax, pow10 } from '../src/index.ts';

describe('division precision contracts', () => {
  it('corrects quotient order guesses at powers of ten, including coefficients beyond Number range', () => {
    for (const exponent of [16, 100, 308, 309, 1000]) {
      const boundary = 10n ** BigInt(exponent);
      expect(
        Decimal(boundary - 1n)
          .div(1, 3, 'floor')
          .eq(999n * 10n ** BigInt(exponent - 3)),
      ).toBe(true);
      expect(
        Decimal(boundary + 1n)
          .div(1, 3, 'floor')
          .eq(boundary),
      ).toBe(true);
      expect(
        Decimal(boundary - 1n)
          .div(boundary, 3, 'floor')
          .eq('0.999'),
      ).toBe(true);
      expect(
        Decimal(boundary)
          .div(boundary + 1n, 3, 'floor')
          .eq('0.999'),
      ).toBe(true);
      expect(
        Decimal(boundary)
          .div(boundary - 1n, 3, 'floor')
          .eq(1),
      ).toBe(true);
      expect(
        Decimal(-boundary)
          .div(boundary + 1n, 3, 'ceil')
          .eq('-0.999'),
      ).toBe(true);
    }
  });

  it('subtracts operand scales before applying the output precision', () => {
    const digits = Number.MAX_SAFE_INTEGER;
    const a = Decimal({ coeff: 1n, digits });
    const b = Decimal({ coeff: 3n, digits });
    expect(a.divRound(b, 2).toString()).toBe('0.33');
    expect(a.div(b, 3).toString()).toBe('0.333');
    expect(Decimal({ coeff: 9999n, digits }).div(1, 1).digits).toBe(digits - 4);
    expect(() => Decimal({ coeff: 10n, digits: -digits }).div(1, 1)).toThrow(RangeError);
  });

  it('distinguishes exact, automatic, significant, and fallback precision', () => {
    expect(Decimal(1).div(8).toString()).toBe('0.125');
    expect(Decimal(1).div(8, 2).toString()).toBe('0.13');
    expect(Decimal(1).divExact(8, 2).toString()).toBe('0.125');
    expect(Decimal(1).divExact(3, 2).toString()).toBe('0.33');
    expect(() => Decimal(1).divExact(3)).toThrow('Non-terminating');
    expect(() => Decimal(1).divExact(3, undefined)).toThrow('Non-terminating');
    expect(Decimal(1).div(3, undefined).eq(Decimal(1).divExact(3, 18))).toBe(true);
    const x = Decimal('1.2345678901234567890123456789');
    expect(x.div(1).eq(x)).toBe(true);
    expect(x.div(1, 18).eq(x)).toBe(false);
  });

  it('retains tiny and huge quotients with bounded significant coefficients', () => {
    expect(Decimal(1).div('3e30').eq('3.33333333333333333e-31')).toBe(true);
    expect(Decimal('1e1000000').div(3).coeff).toBe(333333333333333333n);
    expect(Decimal('1e-1000000').div(3).digits).toBe(1000018);
    expect(Decimal('2e-20').div(2).eq('1e-20')).toBe(true);
    expect(Decimal('9.999').div(1, 3).eq(10)).toBe(true);
  });

  it('constructs exact quotients after cancellation and mixed factors', () => {
    expect(Decimal(3).divExact(6).toString()).toBe('0.5');
    expect(
      Decimal(1)
        .divExact(2n ** 100n)
        .mul(2n ** 100n)
        .eq(1),
    ).toBe(true);
    expect(Decimal('7e-80').divExact('280e20').eq('2.5e-102')).toBe(true);
    expect(Decimal('-7e80').divExact('-280e-20').eq('2.5e98')).toBe(true);
  });

  it('rounds the exact quotient directly at integer and fractional boundaries', () => {
    const x = Decimal('2.99999999999999999999');
    expect(x.div(3).floor().eq(1)).toBe(true);
    expect(x.divFloor(3).eq(0)).toBe(true);
    const y = Decimal('1.49999999999999999999');
    expect(y.div(3).round().eq(1)).toBe(true);
    expect(y.divRound(3).eq(0)).toBe(true);
    expect(Decimal(1).div(8, 2).floor(2).eq('0.13')).toBe(true);
    expect(Decimal(1).divFloor(8, 2).eq('0.12')).toBe(true);
  });

  it.each([
    [7, 3, 2, 3, 2],
    [-7, 3, -3, -2, -2],
    [7, -3, -3, -2, -2],
    [-7, -3, 2, 3, 2],
  ])('handles directed division of %s by %s', (a, b, floor, ceil, trunc) => {
    expect(Decimal(a).divFloor(b).eq(floor)).toBe(true);
    expect(Decimal(a).divCeil(b).eq(ceil)).toBe(true);
    expect(Decimal(a).divTrunc(b).eq(trunc)).toBe(true);
    expect(Decimal(a).divRound(b).eq(trunc)).toBe(true);
  });

  it('handles signs at ties and supports negative digit positions', () => {
    expect(Decimal(1).divRound(-8, 2).toString()).toBe('-0.13');
    expect(Decimal(-1).divRound(-8, 2).toString()).toBe('0.13');
    expect(Decimal(12345).divRound(7, -2).eq(1800)).toBe(true);
    expect(Decimal(12345).divFloor(7, -2).eq(1700)).toBe(true);
    expect(Decimal(-12345).divCeil(7, -2).eq(-1700)).toBe(true);
    expect(Decimal(-12345).divTrunc(7, -2).eq(-1700)).toBe(true);
  });

  it('preserves requested scale for zero and exact fixed-place results', () => {
    expect(Decimal(0).divRound(7, 4).toString()).toBe('0.0000');
    expect(Decimal(1).divFloor(2, 4).toString()).toBe('0.5000');
    expect(Decimal('1e-1000000').divRound(2, 2).toString()).toBe('0.00');
    expect(Decimal('-1e-1000000').divFloor(2, 2).toString()).toBe('-0.01');
    expect(Decimal('1e-1000000').divCeil(2, 2).toString()).toBe('0.01');
  });

  it('matches independent integer quotient and remainder rounding', () => {
    const modes: RoundingMode[] = ['round', 'floor', 'ceil', 'trunc'];
    for (let a = -15n; a <= 15n; a++) {
      for (let b = -9n; b <= 9n; b++) {
        if (!b) continue;
        for (const mode of modes) {
          const n = a * 100n * (b < 0n ? -1n : 1n);
          const d = b < 0n ? -b : b;
          const remainder = n % d;
          let expected = n / d;
          if (remainder) {
            if (mode === 'floor' && n < 0n) expected--;
            if (mode === 'ceil' && n > 0n) expected++;
            if (mode === 'round' && (remainder < 0n ? -remainder : remainder) * 2n >= d) {
              expected += n < 0n ? -1n : 1n;
            }
          }
          expect(Decimal(a).divRound(b, 2, mode).coeff).toBe(expected);
        }
      }
    }
  });

  it('supports self aliases and leaves mutable receivers intact on errors', () => {
    for (const method of ['div$', 'divExact$', 'divRound$', 'divFloor$', 'divCeil$', 'divTrunc$'] as const) {
      const x = Decimal('-12.345');
      expect(x[method](x)).toBe(x);
      expect(x.eq(1)).toBe(true);
      const y = Decimal('12.345');
      expect(() => y[method](0)).toThrow('Division by zero');
      expect(y.toString()).toBe('12.345');
    }
    const x = Decimal('0.1');
    expect(() => x.divExact$(3)).toThrow('Non-terminating');
    expect(x.toString()).toBe('0.1');
    expect(() => x.inverse$(0)).toThrow();
    expect(x.toString()).toBe('0.1');
  });

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 9007199254740992n])(
    'rejects invalid precision %s even on exact results',
    (p) => {
      expect(() => Decimal(1).div(1, p)).toThrow();
      expect(() => Decimal(1).divExact(1, p)).toThrow();
      expect(() => Decimal(1).pow(0, p)).toThrow();
      expect(() => Decimal(1).sqrt(p)).toThrow();
      expect(() => Decimal(1).log(10, p)).toThrow();
    },
  );

  it('checks scale arithmetic without overflowing number integers', () => {
    const x = Decimal({ coeff: 1n, digits: Number.MAX_SAFE_INTEGER });
    expect(x.div('1e-1').digits).toBe(Number.MAX_SAFE_INTEGER - 1);
    expect(x.div(1, 1).digits).toBe(Number.MAX_SAFE_INTEGER);
    expect(x.div(1, 18).digits).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => x.divExact(2)).toThrow();
    expect(() => x.mul$('0.1')).toThrow();
    expect(x.digits).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('significant precision mathematics', () => {
  it('keeps non-negative integer powers exact by default', () => {
    expect(Decimal(2).pow(100).coeff).toBe(2n ** 100n);
    expect(
      Decimal('0.5')
        .pow(100)
        .eq({ coeff: 5n ** 100n, digits: 100 }),
    ).toBe(true);
    expect(Decimal('1e-10').pow(2).eq('1e-20')).toBe(true);
    const x = Decimal('1.2345678901234567890123456789');
    expect(x.pow(1).eq(x)).toBe(true);
    expect(x.pow(2).eq(x.mul(x))).toBe(true);
    expect(Decimal(1).pow(Number.MAX_SAFE_INTEGER).eq(1)).toBe(true);
    expect(Decimal(-1).pow(Number.MAX_SAFE_INTEGER).eq(-1)).toBe(true);
  });

  it('unifies negative integer powers, reciprocals, and division', () => {
    for (const x of ['2', '3', '1e-1000', '-8']) {
      const value = Decimal(x);
      expect(value.pow(-1).eq(value.inverse())).toBe(true);
      expect(value.inverse().eq(Decimal(1).div(value))).toBe(true);
      expect(value.pow(-1, 5).eq(value.inverse(5))).toBe(true);
    }
    expect(Decimal(2).pow(-100).eq(Decimal('0.5').pow(100))).toBe(true);
  });

  it('bounds integer-power output without constructing the full exact coefficient', () => {
    expect(Decimal('1.0001').pow(1_000_000, 20).eq('2.6747109931421401729e43')).toBe(true);
    expect(Decimal(2).pow(1_000_000, 18).coeff.toString().length).toBeLessThanOrEqual(18);
    expect(Decimal('0.5').pow(1_000_000, 18).coeff.toString().length).toBeLessThanOrEqual(18);
    expect(
      Decimal(25)
        .pow(100, 139)
        .eq(Decimal(25n ** 100n).div(1, 139)),
    ).toBe(true);
  });

  it('matches exact integer powers rounded once, including reciprocal ties', () => {
    for (const x of ['-1.25', '0.5', '1.25', '2.5', '9.99', '0.03125']) {
      for (const n of [1, 2, 7, 30, 100]) {
        for (const p of [1, 3, 18]) {
          const exact = Decimal(x).pow(n);
          expect(Decimal(x).pow(n, p).eq(exact.div(1, p))).toBe(true);
          expect(Decimal(x).pow(-n, p).eq(Decimal(1).div(exact, p))).toBe(true);
        }
      }
    }
  });

  it('finds exact roots and rounds perfect roots only when requested', () => {
    expect(Decimal('1e-40').sqrt().eq('1e-20')).toBe(true);
    expect(Decimal('0.000144').sqrt().toString()).toBe('0.012');
    expect(Decimal('-0.000000027').root(3).toString()).toBe('-0.003');
    expect(Decimal('1.5241383936').sqrt().toString()).toBe('1.23456');
    expect(Decimal('1.5241383936').sqrt(5).toString()).toBe('1.2346');
    expect(Decimal('1.23456').root(1, 3).toString()).toBe('1.23');
  });

  it('rounds roots at and on both sides of a midpoint', () => {
    const boundary = Decimal('1.25').pow(3);
    expect(boundary.root(3, 2).toString()).toBe('1.3');
    expect(boundary.sub('1e-60').root(3, 2).toString()).toBe('1.2');
    expect(boundary.add('1e-60').root(3, 2).toString()).toBe('1.3');
    expect(boundary.neg().root(3, 2).toString()).toBe('-1.3');
    expect(Decimal(2).sqrt(30).toString()).toBe('1.41421356237309504880168872421');
  });

  it('computes roots independently of decimal exponent magnitude', () => {
    const small = Decimal('2e-1000000').sqrt(30);
    const large = Decimal('2e1000000').sqrt(30);
    expect(small.coeff).toBe(141421356237309504880168872421n);
    expect(small.digits).toBe(500029);
    expect(large.coeff).toBe(small.coeff);
    expect(large.digits).toBe(-499971);
    expect(Decimal(2).root(1000000000000n, 30).toString()).toBe('1.00000000000069314718056018554');
  });

  it('takes exact rational powers when possible', () => {
    expect(Decimal(32).pow('0.2').eq(2)).toBe(true);
    expect(Decimal(16).pow('1.25').eq(32)).toBe(true);
    expect(Decimal(4).pow('-0.5').eq('0.5')).toBe(true);
    expect(Decimal(9).pow('-0.5').eq(Decimal(1).div(3))).toBe(true);
    expect(Decimal(2).pow('0.5', 30).eq(Decimal(2).sqrt(30))).toBe(true);
    expect(Decimal('1e-1000000').pow('0.5').eq('1e-500000')).toBe(true);
  });

  it('matches independently computed fractional-power references', () => {
    expect(Decimal(2).pow('1.5', 30).toString()).toBe('2.82842712474619009760337744842');
    expect(Decimal(2).pow('0.1', 30).toString()).toBe('1.07177346253629316421300632502');
    expect(Decimal('1.0000000001').pow('0.9876543210123456789', 60).toString()).toBe(
      '1.00000000009876543210117360157401211674116516759003054574136',
    );
    expect(Decimal('7.8125').pow('-0.27182818284590452353', 50).toString()).toBe(
      '0.57189264128740039182515599298878760484013009527135',
    );
  });

  it('computes logarithms with significant precision and cancellation near unity', () => {
    expect(Decimal(3).log(2, 30).toString()).toBe('1.58496250072115618145373894395');
    expect(Decimal('0.05').log(10, 30).toString()).toBe('-1.30102999566398119521373889472');
    expect(Decimal('1.00000000000000000001').log('1.00000000000000000003', 30).toString()).toBe(
      '0.333333333333333333336666666667',
    );
    expect(Decimal('1e-1000000').log(10).eq(-1000000)).toBe(true);
    expect(Decimal(2).log(4, 1).eq('0.5')).toBe(true);
    expect(Decimal(1).log(2).eq(0)).toBe(true);
    expect(Decimal(8).log(2, 1).eq(3)).toBe(true);
  });

  it('does not modify mathematical receivers when validation fails', () => {
    const x = Decimal(-2);
    expect(() => x.pow$('0.5')).toThrow();
    expect(() => x.sqrt$()).toThrow();
    expect(() => x.log$(10)).toThrow();
    expect(x.eq(-2)).toBe(true);
  });
});

describe('Decimal construction', () => {
  it('creates decimals from native numbers', () => {
    const value = Decimal(123.45);
    expect(isDecimal(value)).toBe(true);
    expect(value.coeff).toBe(12345n);
    expect(value.digits).toBe(2);
  });

  it('creates decimals from bigint payloads', () => {
    const value = Decimal({ coeff: 987654321n, digits: 5 });
    expect(value.coeff).toBe(987654321n);
    expect(value.digits).toBe(5);
  });

  it('accepts bigint digit payloads in object inputs', () => {
    const value = Decimal({ coeff: 123n, digits: 4n });
    expect(value.coeff).toBe(123n);
    expect(value.digits).toBe(4);
  });

  it('rejects non-integer digit payloads in object inputs', () => {
    expect(() => Decimal({ coeff: 123n, digits: 1.5 } as never)).toThrow('Digits must be an integer');
  });

  it('returns existing decimal instances unchanged', () => {
    const value = Decimal(42);
    expect(Decimal(value)).toBe(value);
  });

  it('accepts digit overrides for bigint constructor calls', () => {
    const DecimalImpl = (Decimal(1) as any).constructor;
    const value = new DecimalImpl(12n, 3);
    expect(value.coeff).toBe(12n);
    expect(value.digits).toBe(3);
  });

  it('returns nullish inputs unchanged', () => {
    expect(Decimal(null)).toBeNull();
    expect(Decimal(undefined)).toBeUndefined();
  });
});

describe('Decimal arithmetic', () => {
  it('adds decimals with varying exponents', () => {
    const sum = Decimal(12.345).add(0.655);
    expect(sum.toString()).toBe('13.000');
  });

  it('preserves exponent when sums cancel to zero', () => {
    const left = Decimal({ coeff: 1234500n, digits: 4 });
    const right = Decimal({ coeff: -1234500n, digits: 4 });
    const sum = left.add(right);
    expect(sum.digits).toBe(4);
    expect(sum.toString()).toBe('0.0000');
  });

  it('subtracts decimals correctly', () => {
    const diff = Decimal(10).sub(2.75);
    expect(diff.toString()).toBe(Decimal(7.25).toString());
  });

  it('multiplies decimals and combines exponents', () => {
    const product = Decimal(1.5).mul(4);
    expect(product.toString()).toBe('6.0');
  });

  it('divides with finite decimal expansion', () => {
    const quotient = Decimal(7).div(2);
    expect(quotient.rescale().toString()).toBe('3.5');
  });

  it('divides with explicit digits', () => {
    const quotient = Decimal(1).div(3, 5n);
    expect(quotient.toString()).toBe('0.33333');
  });

  it('rounds divisions with negative divisors correctly', () => {
    const quotient = Decimal(1).clone();
    quotient.divRound$(-3, 0n, 'round');
    expect(quotient.toString()).toBe('0');
  });

  it('supports negative digit positions when dividing', () => {
    const quotient = Decimal(1).divRound(Decimal(3), -2n);
    expect(quotient.toString()).toBe('0');
    expect(quotient.digits).toBe(-2);
  });

  it('scales operands to align fractional digits when dividing', () => {
    const quotient = Decimal('1.23').div(3, 2n);
    expect(quotient.toString()).toBe('0.41');
    expect(quotient.digits).toBe(2);
  });

  it('throws when dividing by zero', () => {
    expect(() => Decimal(5).div(0)).toThrow('Division by zero');
  });

  it('preserves exponent when division result is zero', () => {
    const dividend = Decimal({ coeff: 0n, digits: 4 });
    const result = dividend.div(5);
    expect(result.digits).toBe(4);
    expect(result.toString()).toBe('0.0000');
  });

  it('rejects non-integer digit counts for division', () => {
    expect(() => Decimal(1).div(2, 1.2)).toThrow('Precision must be a positive safe integer');
  });

  it('ignores unknown rounding modes during division', () => {
    const value = Decimal(10).clone();
    value.divRound$(3, 0n, 'unknown' as RoundingMode);
    expect(value.toString()).toBe(Decimal(3).toString());
  });
});

describe('Decimal transforms', () => {
  it('clones decimals without sharing state', () => {
    const original = Decimal('123.45');
    const copy = original.clone();
    expect(copy).not.toBe(original);
    expect(copy.eq(original)).toBe(true);
    copy.add$(1);
    expect(original.toString()).toBe(Decimal('123.45').toString());
    expect(copy.toString()).toBe(Decimal('124.45').toString());
  });

  it('computes absolute values', () => {
    const result = Decimal(-3.25).abs();
    expect(result.toString()).toBe(Decimal(3.25).toString());
  });

  it('floors to the requested digit precision', () => {
    expect(Decimal(3.75).floor(1).toString()).toBe(Decimal('3.7').toString());
    expect(Decimal(-3.75).floor(1).toString()).toBe(Decimal('-3.8').toString());
    expect(Decimal(123.45).floor().toString()).toBe(Decimal(123).toString());
    expect(Decimal(123.45).floor(-1).toString()).toBe(Decimal(120).toString());
  });

  it('skips floor adjustment when precision is already coarse enough', () => {
    const value = Decimal('1.23');
    const floored = value.floor$(5n);
    expect(floored).toBe(value);
    expect(value.toString()).toBe('1.23');
  });

  it('rounds half away from zero at the requested digits', () => {
    expect(Decimal(3.5).round().toString()).toBe(Decimal(4).toString());
    expect(Decimal(-3.5).round().toString()).toBe(Decimal(-4).toString());
    expect(Decimal(3.245).round(2).toString()).toBe(Decimal('3.25').toString());
    expect(Decimal(-3.245).round(2).toString()).toBe(Decimal('-3.25').toString());
    expect(Decimal(125).round(-1).toString()).toBe(Decimal(130).toString());
    expect(Decimal(-125).round(-1).toString()).toBe(Decimal(-130).toString());
  });

  it('ceils using digit precision', () => {
    expect(Decimal(3.21).ceil(1).toString()).toBe(Decimal('3.3').toString());
    expect(Decimal(-3.21).ceil(1).toString()).toBe(Decimal('-3.2').toString());
    expect(Decimal(45).ceil(-1).toString()).toBe(Decimal(50).toString());
    expect(Decimal(-45).ceil(-1).toString()).toBe(Decimal(-40).toString());
  });

  it('skips ceil adjustment when precision is already coarse enough', () => {
    const value = Decimal('-1.2');
    const ceiled = value.ceil$(5n);
    expect(ceiled).toBe(value);
    expect(value.toString()).toBe('-1.2');
  });

  it('truncates digits toward zero', () => {
    expect(Decimal(3.987).trunc(2).toString()).toBe(Decimal('3.98').toString());
    expect(Decimal(-3.987).trunc(2).toString()).toBe(Decimal('-3.98').toString());
    expect(Decimal(678).trunc(-2).toString()).toBe(Decimal(600).toString());
    expect(Decimal(-678).trunc(-2).toString()).toBe(Decimal(-600).toString());
  });

  it('keeps the target exponent when truncating', () => {
    const value = Decimal({ coeff: 375n, digits: 2 });
    const truncated = value.trunc(2);
    expect(truncated.digits).toBe(2);
    expect(truncated.toString()).toBe('3.75');
  });

  it('splits into floor and fractional parts by default', () => {
    const value = Decimal(4.25);
    const [integral, fractional] = value.split();
    expect(integral.toString()).toBe(Decimal(4).toString());
    expect(fractional.toString()).toBe(Decimal(0.25).toString());
    expect(integral.add(fractional).eq(value)).toBe(true);
  });

  it('splits using trunc mode', () => {
    const value = Decimal(-1.875);
    const [integral, fractional] = value.split(undefined, 'trunc');
    expect(integral.toString()).toBe(Decimal(-1).toString());
    expect(fractional.toString()).toBe(Decimal('-0.875').toString());
    expect(integral.add(fractional).eq(value)).toBe(true);
  });

  it('splits using ceil mode', () => {
    const value = Decimal(-2.125);
    const [integral, fractional] = value.split(undefined, 'ceil');
    expect(integral.toString()).toBe(Decimal(-2).toString());
    expect(fractional.toString()).toBe(Decimal('-0.125').toString());
    expect(integral.add(fractional).eq(value)).toBe(true);
  });

  it('splits using round mode', () => {
    const value = Decimal(2.5);
    const [integral, fractional] = value.split(undefined, 'round');
    expect(integral.toString()).toBe(Decimal(3).toString());
    expect(fractional.toString()).toBe(Decimal('-0.5').toString());
    expect(integral.add(fractional).eq(value)).toBe(true);
  });

  it('splits with digit precision', () => {
    const value = Decimal('12.3456');
    const [integral, fractional] = value.split(2);
    expect(integral.toString()).toBe(Decimal('12.34').toString());
    expect(fractional.toString()).toBe(Decimal('0.0056').toString());
    expect(integral.add(fractional).eq(value)).toBe(true);
  });

  it('splits with digit precision in trunc mode', () => {
    const value = Decimal('-7.987');
    const [integral, fractional] = value.split(1, 'trunc');
    expect(integral.toString()).toBe(Decimal('-7.9').toString());
    expect(fractional.toString()).toBe(Decimal('-0.087').toString());
    expect(integral.add(fractional).eq(value)).toBe(true);
  });

  it('splits by step using floor mode by default', () => {
    const value = Decimal('5.83');
    const [integral, fractional] = value.splitBy('0.25');
    expect(integral.toString()).toBe(Decimal('5.75').toString());
    expect(fractional.toString()).toBe(Decimal('0.08').toString());
    expect(integral.add(fractional).eq(value)).toBe(true);
  });

  it('splits by step using trunc mode', () => {
    const value = Decimal('-3.6');
    const [integral, fractional] = value.splitBy('0.5', 'trunc');
    expect(integral.toString()).toBe(Decimal('-3.5').toString());
    expect(fractional.toString()).toBe(Decimal('-0.1').toString());
    expect(integral.add(fractional).eq(value)).toBe(true);
  });

  it('splits by step using ceil mode', () => {
    const value = Decimal(-4.1);
    const [integral, fractional] = value.splitBy(0.5, 'ceil');
    expect(integral.toString()).toBe('-4.0');
    expect(fractional.toString()).toBe(Decimal('-0.1').toString());
    expect(integral.add(fractional).eq(value)).toBe(true);
  });

  it('splits by step using round mode', () => {
    const value = Decimal('5.62');
    const [integral, fractional] = value.splitBy('0.25', 'round');
    expect(integral.toString()).toBe('5.50');
    expect(fractional.toString()).toBe(Decimal('0.12').toString());
    expect(integral.add(fractional).eq(value)).toBe(true);
  });
});

describe('Decimal fractional helpers', () => {
  it('returns the fractional part without mutating the original', () => {
    const value = Decimal('7.125');
    const fractional = value.frac();
    expect(fractional.toString()).toBe('0.125');
    expect(value.toString()).toBe('7.125');
    expect(fractional).not.toBe(value);
  });

  it('mutates in place with frac$', () => {
    const value = Decimal('12.3400');
    const result = value.frac$();
    expect(result).toBe(value);
    expect(value.toString()).toBe('0.3400');
    expect(value.digits).toBe(4);
  });

  it('returns zero for integer values', () => {
    const value = Decimal({ coeff: 12n, digits: -2 });
    const fractional = value.frac();
    expect(fractional.toString()).toBe('0');
    expect(fractional.digits).toBe(0);
  });

  it('preserves negative fractional signs', () => {
    const value = Decimal('-3.25');
    expect(value.frac().toString()).toBe('-0.25');
  });
});

describe('Decimal type guards', () => {
  it('detects decimals using isDecimal', () => {
    const value = Decimal(7);
    expect(Decimal.isDecimal(value)).toBe(true);
    expect(Decimal.isDecimal(7)).toBe(false);
  });

  it('detects decimal-like structs using isDecimalType', () => {
    expect(Decimal.isDecimalType(Decimal(7))).toBe(true);
    expect(Decimal.isDecimalType({ coeff: 123n, digits: 4 })).toBe(true);
    expect(Decimal.isDecimalType({ coeff: 123n, digits: 4n })).toBe(true);
    expect(Decimal.isDecimalType('7')).toBe(false);
    expect(Decimal.isDecimalType(7)).toBe(false);
    expect(Decimal.isDecimalType(7n)).toBe(false);
  });

  it('recognizes supported literal inputs', () => {
    expect(Decimal.isDecimalLike('42.00')).toBe(true);
    expect(Decimal.isDecimalLike(42)).toBe(true);
    expect(Decimal.isDecimalLike(42n)).toBe(true);
    expect(Decimal.isDecimalLike(null)).toBe(false);
    expect(Decimal.isDecimalLike(undefined)).toBe(false);
  });

  it('validates structured decimal-like payloads', () => {
    expect(Decimal.isDecimalLike(Decimal(7))).toBe(true);
    expect(Decimal.isDecimalLike({ coeff: 123n, digits: 4 })).toBe(true);
    expect(Decimal.isDecimalLike({ coeff: 123n, digits: 4n })).toBe(true);
    expect(Decimal.isDecimalLike({ coeff: 123, digits: 4 })).toBe(false);
    expect(Decimal.isDecimalLike({ coeff: 123n })).toBe(false);
    expect(Decimal.isDecimalLike({ digits: 4 })).toBe(false);
  });

  it('exposes pow10 on the namespace', () => {
    expect(Decimal.pow10(3).toString()).toBe('1000');
  });

  it('passes through nullish inputs for Decimal()', () => {
    expect(Decimal(null)).toBeNull();
    expect(Decimal(undefined)).toBeUndefined();
  });
});

describe('Decimal equals helper', () => {
  it('returns true for equivalent decimal-like values', () => {
    expect(Decimal.equals(Decimal('1.20'), '1.2')).toBe(true);
    expect(Decimal.equals(Decimal(5), 5n)).toBe(true);
  });

  it('returns false for different values', () => {
    expect(Decimal.equals(Decimal(1), 2)).toBe(false);
  });

  it('treats nullish pairs as equal only when identical', () => {
    expect(Decimal.equals(null, null)).toBe(true);
    expect(Decimal.equals(undefined, undefined)).toBe(true);
    expect(Decimal.equals(null, undefined)).toBe(false);
  });

  it('returns false when only one side is nullish', () => {
    expect(Decimal.equals(null, Decimal(0))).toBe(false);
    expect(Decimal.equals(undefined, 0)).toBe(false);
  });
});

describe('Decimal number parity', () => {
  it('converts safe coefficients across the exact power-of-ten range', () => {
    const samples = [
      { coeff: 9007199254740991n, digits: 0 },
      { coeff: 314159n, digits: 5 },
      { coeff: -314159n, digits: 5 },
      { coeff: 9007199254740991n, digits: 22 },
      { coeff: 9007199254740991n, digits: -22 },
    ];

    for (const sample of samples) {
      const decimal = Decimal(sample);
      expect(decimal.number()).toBe(Number(decimal.toString()));
    }
  });

  it('converts unsafe coefficients without string conversion', () => {
    const decimal = Decimal({ coeff: 9007199254740993n, digits: 1 });
    decimal.toString = () => {
      throw new Error('Unexpected string conversion');
    };

    expect(decimal.number()).toBe(Number(9007199254740993n) / 10);
  });

  it('scales coefficients that overflow Number before conversion', () => {
    expect(Decimal({ coeff: 10n ** 400n, digits: 400 }).number()).toBe(1);
    expect(Decimal({ coeff: -(10n ** 400n), digits: 400 }).number()).toBe(-1);
  });

  it('handles subnormal and overflowing results without intermediate underflow', () => {
    expect(Decimal({ coeff: 5n, digits: 324 }).number()).toBe(5e-324);
    expect(Decimal({ coeff: -5n, digits: 324 }).number()).toBe(-5e-324);
    expect(Decimal({ coeff: 1n, digits: -309 }).number()).toBe(Infinity);
  });

  it('matches Number(str) for challenging inputs', () => {
    const samples = [
      '0',
      '5e-324',
      '1e-324',
      '1e-4000',
      '1e4000',
      '1.7976931348623157e308',
      '2.2250738585072014e-308',
      '9007199254740991',
      '9007199254740993',
      '  3.1415926535897932384626433832795028841971  ',
    ];

    for (const input of samples) {
      const decimalValue = Decimal(input).number();
      const nativeValue = Number(input);
      if (Number.isNaN(nativeValue)) {
        expect(decimalValue).toBeNaN();
      } else {
        expect(decimalValue).toBe(nativeValue);
      }
    }
  });
});

describe('pow10', () => {
  it('returns one when exponent is zero', () => {
    const value = pow10(0n);
    expect(value.toString()).toBe(Decimal(1).toString());
    expect(value.digits).toBe(0);
  });

  it('normalizes negative zero exponents', () => {
    const value = pow10(-0);
    expect(value.digits).toBe(0);
    expect(Object.is(value.digits, -0)).toBe(false);
  });

  it('represents positive exponents using negative digit counts', () => {
    const value = pow10(5n);
    expect(value.coeff).toBe(1n);
    expect(value.digits).toBe(-5);
    expect(value.number()).toBe(100000);
  });

  it('handles negative exponents with fractional results', () => {
    const value = pow10(-3n);
    expect(value.coeff).toBe(1n);
    expect(value.digits).toBe(3);
    expect(value.toString()).toBe(Decimal('0.001').toString());
  });
});

describe('Decimal shift10', () => {
  it('shifts by positive exponents without changing the coefficient', () => {
    const original = Decimal('12.345');
    const shifted = original.shift10(2n);
    expect(shifted.toString()).toBe(Decimal('1234.5').toString());
    expect(shifted.coeff).toBe(original.coeff);
    expect(shifted.digits).toBe(1);
    expect(original.toString()).toBe(Decimal('12.345').toString());
  });

  it('shifts by negative exponents in place with shift10$', () => {
    const value = Decimal('9876.5');
    value.shift10$(-3);
    expect(value.toString()).toBe(Decimal('9.8765').toString());
    expect(value.digits).toBe(4);
  });

  it('ignores zero shifts in place', () => {
    const value = Decimal('1.2345');
    const shifted = value.shift10$(0);
    expect(shifted).toBe(value);
    expect(value.toString()).toBe('1.2345');
  });

  it('rejects non-integer shift amounts', () => {
    expect(() => Decimal(1).shift10(1.2)).toThrow('Shift amount must be an integer');
  });
});

describe('Decimal sign helpers', () => {
  it('identifies zero, positive, and negative values', () => {
    const zero = Decimal({ coeff: 0n, digits: 3 });
    const positive = Decimal({ coeff: 123n, digits: 2 });
    const negative = Decimal({ coeff: -45n, digits: 1 });
    expect(zero.isZero()).toBe(true);
    expect(zero.isPositive()).toBe(false);
    expect(zero.isNegative()).toBe(false);
    expect(positive.isZero()).toBe(false);
    expect(positive.isPositive()).toBe(true);
    expect(positive.isNegative()).toBe(false);
    expect(negative.isZero()).toBe(false);
    expect(negative.isPositive()).toBe(false);
    expect(negative.isNegative()).toBe(true);
  });

  describe('sign', () => {
    it('returns a 0', () => {
      const value = Decimal(0);
      expect(value.sign().toString()).toBe('0');
    });
    it('returns a -1', () => {
      const value = Decimal(-1.987);
      expect(value.sign().toString()).toBe('-1');
    });
    it('returns a 1', () => {
      const value = Decimal(1.987);
      expect(value.sign().toString()).toBe('1');
    });
  });

  describe('neg', () => {
    it('returns negated value', () => {
      const value = Decimal(1.987);
      expect(value.neg(true).toString()).toBe('-1.987');
    });
    it('returns original value', () => {
      const value = Decimal(1.987);
      expect(value.neg(false).toString()).toBe('1.987');
    });
  });
});

describe('Decimal truncation', () => {
  it('returns a new instance truncated to the requested digits', () => {
    const original = Decimal(1.2345);
    const truncated = original.trunc(2);
    expect(truncated.toString()).toBe('1.23');
    expect(original.toString()).toBe('1.2345');
  });

  it('mutates in place with trunc$', () => {
    const value = Decimal(-1.987);
    value.trunc$(1);
    expect(value.toString()).toBe('-1.9');
  });

  it('preserves target digits when truncating zero', () => {
    const value = Decimal({ coeff: 0n, digits: 5 });
    const truncated = value.trunc(3);
    expect(truncated.digits).toBe(3);
    expect(truncated.toString()).toBe('0.000');
  });
});

describe('Decimal proximity checks', () => {
  it('detects differences within absolute tolerance', () => {
    const base = Decimal(1.2345);
    const nearby = Decimal(1.2349);
    expect(base.isCloseTo(nearby, 0.0005)).toBe(true);
    expect(base.isCloseTo(nearby, 0.0003)).toBe(false);
  });

  it('treats identical values as within zero tolerance', () => {
    const value = Decimal({ coeff: 42000n, digits: 3 });
    expect(value.isCloseTo(value, 0)).toBe(true);
  });

  it('rejects negative tolerance values', () => {
    const base = Decimal(1);
    expect(() => base.isCloseTo(Decimal(1.1), -0.1)).toThrow('Tolerance must be non-negative');
  });
});

describe('Decimal pow', () => {
  it('raises to integer exponents', () => {
    const value = Decimal(3);
    const powered = value.pow(4n, 8n);
    expect(powered.toString()).toBe('81');
  });

  it('handles fractional exponents with requested precision', () => {
    const result = Decimal(2).pow(Decimal({ coeff: 15n, digits: 1 }), 9n);
    expect(result.number()).toBeCloseTo(Math.pow(2, 1.5), 8);
  });

  it('supports negative exponents by returning reciprocals', () => {
    const result = Decimal(8).pow(-2n, 9n);
    expect(result.toString()).toBe('0.015625');
    expect(result.rescale().toString()).toBe('0.015625');
  });

  it('rounds reciprocal results to requested digits', () => {
    const result = Decimal(3).pow(-1n, 2n);
    expect(result.toString()).toBe('0.33');
    expect(result.digits).toBe(2);
  });

  it('preserves zero exponent when base is zero', () => {
    const base = Decimal({ coeff: 0n, digits: 4 });
    const result = base.pow(2n, 8n);
    expect(result.digits).toBe(4);
    expect(result.toString()).toBe('0.0000');
  });

  it('returns unity for zero exponents', () => {
    const result = Decimal('123.456').pow(0n, 6n);
    expect(result.toString()).toBe(Decimal(1).toString());
    expect(result.digits).toBe(0);
  });

  it('matches high-precision reference for fractional exponents', () => {
    const base = Decimal('1.0000000001');
    const exponent = Decimal('0.9876543210123456789');
    const digits = 60;
    const highPrecision = base.pow(exponent, digits + 30).div(1, digits);
    const result = base.pow(exponent, digits);
    expect(result.eq(highPrecision)).toBe(true);
  });

  it('preserves precision for negative fractional exponents', () => {
    const base = Decimal('7.8125');
    const exponent = Decimal('-0.27182818284590452353');
    const digits = 50;
    const highPrecision = base.pow(exponent, digits + 30).div(1, digits);
    const result = base.pow(exponent, digits);
    expect(result.eq(highPrecision)).toBe(true);
  });
});

describe('Decimal logarithms', () => {
  it('computes logarithms with precision for bases greater than one', () => {
    const value = Decimal(125);
    const result = value.log(5, 10n);
    expect(result.toString()).toBe(Decimal(3).toString());
  });

  it('computes logarithms for fractional values', () => {
    const value = Decimal(0.05);
    const result = value.log(Decimal(10), 6n);
    const expected = Decimal({ coeff: -1301030n, digits: 6 });
    expect(result.isCloseTo(expected, 1e-6)).toBe(true);
  });

  it('supports bases between zero and one', () => {
    const value = Decimal(2);
    const result = value.log(Decimal({ coeff: 5n, digits: 1 }), 8n);
    expect(result.isCloseTo(Decimal(-1), 1e-7)).toBe(true);
  });

  it('round-trips with pow using the same precision', () => {
    const base = Decimal(7.5);
    const value = Decimal(123.456);
    const logValue = value.log(base, 8n);
    const reconstructed = base.pow(logValue, 8n);

    expect(reconstructed.toFixed(8)).toBe(value.toFixed(8));
    // expect(reconstructed.isCloseTo(value, 1e-8)).toBe(true);
  });

  it('computes negative integer logarithms for inverse powers', () => {
    const value = Decimal('0.001');
    const result = value.log(Decimal(10), 6n);
    expect(result.toString()).toBe(Decimal(-3).toString());
  });

  it('returns zero when logging unity', () => {
    const result = Decimal(1).log(Decimal(10), 8n);
    expect(result.toString()).toBe(Decimal(0).toString());
  });

  it('returns correct integer part for near-unity ratios', () => {
    const base = Decimal('1.0000000001');
    const value = Decimal('1.000000000099999999');
    const result = value.log(base, 1n);
    expect(result.toString()).toBe(Decimal(1).toString());
  });

  it('retains integer part for powers with tiny deltas', () => {
    const base = Decimal('1.00000000001');
    const powered = base.pow(2n, 32n);
    const result = powered.log(base, 1n);
    expect(result.toString()).toBe(Decimal(2).toString());
  });

  it('matches coarse precision with high-precision reference near unity', () => {
    const base = Decimal('1.000000000001');
    const value = Decimal('1.000000000009');
    const highPrecision = value.log(base, 20n).div(1, 1n);
    const coarse = value.log(base, 1n);
    expect(coarse.eq(highPrecision)).toBe(true);
  });

  it('rejects non-positive logarithm precision', () => {
    expect(() => Decimal(10).log(10, -1n)).toThrow();
    expect(() => Decimal(10).log(10, 0n)).toThrow();
  });

  it('returns logarithms with requested significant digits', () => {
    const digits = 6;
    const result = Decimal(0.05).log(Decimal(10), digits);
    expect(result.toString()).toBe('-1.30103');
    expect(result.coeff.toString().replace('-', '').length).toBe(digits);
  });

  it('does not expose logarithm guard digits', () => {
    const digits = 6;
    const result = Decimal(0.05).log(Decimal(10), digits);
    expect(result.toFixed(6)).toBe('-1.301030');
    expect(result.div(1, digits).eq(result)).toBe(true);
  });

  it('supports single-digit logarithms', () => {
    const digits = 1;
    const base = Decimal(10);
    const value = Decimal(0.05);
    const result = value.log(base, digits);
    expect(result.eq(-1)).toBe(true);
  });

  it('supports high-precision logarithms without exposing working digits', () => {
    const digits = 80;
    const base = Decimal(10);
    const value = Decimal(0.05);
    const result = value.log(base, digits);
    expect(result.coeff.toString().replace('-', '').length).toBeLessThanOrEqual(digits);
    expect(result.toString()).toBe(
      '-1.3010299956639811952137388947244930267681898814621085413104274611271081892744245',
    );
  });

  it('rejects non-positive arguments', () => {
    expect(() => Decimal(0).log(Decimal(10), 6n)).toThrow('Logarithm argument must be positive');
    expect(() => Decimal(-5).log(Decimal(10), 6n)).toThrow('Logarithm argument must be positive');
  });

  it('rejects non-positive bases', () => {
    expect(() => Decimal(10).log(Decimal(0), 6n)).toThrow('Logarithm base must be positive');
    expect(() => Decimal(10).log(Decimal(-2), 6n)).toThrow('Logarithm base must be positive');
  });

  it('rejects base equal to one', () => {
    expect(() => Decimal(10).log(Decimal(1), 6n)).toThrow('Logarithm base cannot be one');
  });

  it('computes logarithms with significant digit control for other bases', () => {
    const result = Decimal(3).log(Decimal(2), 6n);
    expect(result.toString()).toBe('1.58496');
  });
});

describe('Decimal order', () => {
  it('returns integer exponents for powers of ten', () => {
    const result = Decimal(1000).order();
    expect(result).toBe(3n);
  });

  it('returns the integer part of the base-10 logarithm', () => {
    const result = Decimal(987654.321).order();
    expect(result).toBe(5n);
  });

  it('returns negative exponents for sub-unit values', () => {
    const result = Decimal(0.05).order();
    expect(result).toBe(-2n);
  });

  it('rejects 0 arguments', () => {
    expect(() => Decimal(0n).order()).toThrow();
  });
});

describe('Decimal roots', () => {
  it('computes square roots with requested precision', () => {
    const root = Decimal(2).sqrt(10n);
    expect(root.number()).toBeCloseTo(Math.sqrt(2), 9);
  });

  it('mutates in place when using sqrt$', () => {
    const value = Decimal('7.29');
    value.sqrt$(4n);
    expect(value.toString()).toBe('2.7');
    expect(value.rescale().toString()).toBe('2.7');
    expect(value.digits).toBe(1);
  });

  it('matches general root computation for sqrt$', () => {
    const input = Decimal('0.000625');
    const clone = input.clone();
    const sqrtDigits = 8;
    input.sqrt$(sqrtDigits);
    const viaRoot = clone.root$(2n, sqrtDigits);
    expect(input.toFixed(sqrtDigits)).toBe(viaRoot.toFixed(sqrtDigits));
  });

  it('computes general integer roots', () => {
    const root = Decimal(81).root(4n, 8n);
    expect(root.toString()).toBe('3');
  });

  it('computes roots safely when fallback inverse is unity', () => {
    const root = Decimal(9).root(2n, 8n);
    expect(root.toString()).toBe('3');
  });

  it('supports odd roots of negative numbers', () => {
    const root = Decimal(-27).root(3n, 8n);
    expect(root.toString()).toBe('-3');
  });

  it('does not require floating approximations for moderate roots', () => {
    const powSpy = vi.spyOn(Math, 'pow');
    const root = Decimal(256).root(4n, 6n);
    expect(powSpy).not.toHaveBeenCalled();
    expect(root.eq(Decimal(4))).toBe(true);
    powSpy.mockRestore();
  });

  it('throws on even roots of negative numbers', () => {
    expect(() => Decimal(-16).root(2n, 8n)).toThrowError();
  });

  it('accepts numeric root degrees', () => {
    const root = Decimal(16).root(2, 6n);
    expect(root.toString()).toBe('4');
  });

  it('rejects non-integer numeric root degrees', () => {
    expect(() => Decimal(16).root(2.5, 6n)).toThrow('Root degree must be an integer');
  });

  it('preserves exponent when root of zero is taken', () => {
    const value = Decimal({ coeff: 0n, digits: 6 });
    const root = value.root(3n, 6n);
    expect(root.digits).toBe(6);
    expect(root.toString()).toBe('0.000000');
  });

  it('rejects non-positive root degrees', () => {
    expect(() => Decimal(9).root(0n, 4n)).toThrow('Invalid root degree');
  });

  it('rejects negative root precision', () => {
    expect(() => Decimal(9).root(2n, -1n)).toThrow();
  });

  it('computes large-magnitude roots without relying on floating guesses', () => {
    const value = Decimal({ coeff: 1n, digits: -2000 });
    const root = value.root(2n, 12n);
    const expected = Decimal({ coeff: 1n, digits: -1000 });
    expect(root.eq(expected)).toBe(true);
  });

  it('computes tiny-magnitude roots without relying on floating guesses', () => {
    const value = Decimal({ coeff: 1n, digits: 2000 });
    const root = value.root(2n, 1200n);
    const expected = Decimal({ coeff: 1n, digits: 1000 });
    expect(root.eq(expected)).toBe(true);
  });

  it('preserves tiny roots at single-digit precision', () => {
    const value = Decimal({ coeff: 1n, digits: 2000 });
    const root = value.root(10n, 1n);
    expect(root.coeff).toBe(1n);
    expect(root.digits).toBe(200);
  });

  it('handles high-degree roots for tiny magnitudes with coarse precision', () => {
    const value = Decimal({ coeff: 1n, digits: 2000 });
    const root = value.root(20n, 1n);
    expect(root.coeff).toBe(1n);
    expect(root.digits).toBe(100);
  });

  it('matches high-precision power check for fractional roots', () => {
    const value = Decimal('98765.4321');
    const degree = 5n;
    const digits = 60;
    const root = value.root(degree, digits);
    const recomposed = root.pow(degree, digits + 30).rescale(digits);
    const tolerance = value
      .abs()
      .mul(degree)
      .mul(pow10(-(digits - 1)));
    expect(recomposed.isCloseTo(value.rescale(digits), tolerance)).toBe(true);
  });

  it('retains precision for odd roots of negatives', () => {
    const value = Decimal('-42.424242');
    const degree = 3n;
    const digits = 50;
    const root = value.root(degree, digits);
    const recomposed = root.pow(degree, digits + 30).rescale(digits);
    const tolerance = pow10(-(digits - 4));
    expect(recomposed.isCloseTo(value.rescale(digits), tolerance)).toBe(true);
  });

  it('falls back to order-based estimates when floating guesses overflow', () => {
    const powSpy = vi.spyOn(Math, 'pow');
    const huge = Decimal({ coeff: 1n, digits: -5000 });
    const root = huge.root(2n, 4n);
    expect(powSpy).not.toHaveBeenCalled();
    expect(root.digits).toBe(-2500);
    powSpy.mockRestore();
  });

  it('works independently of floating power results', () => {
    const powSpy = vi.spyOn(Math, 'pow').mockReturnValueOnce(Number.NaN);
    const root = Decimal(64).root(3n, 8n);
    expect(powSpy).not.toHaveBeenCalled();
    expect(root.eq(Decimal(4))).toBe(true);
    powSpy.mockRestore();
  });

  it('rejects root degrees outside the safe integer range without mutating the receiver', () => {
    const value = Decimal(16);
    expect(() => value.root$(9007199254740992n)).toThrow(RangeError);
    expect(() => value.root$(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
    expect(value.eq(16)).toBe(true);
  });
});

describe('Decimal modular helpers', () => {
  it('computes modulo respecting signs', () => {
    expect(Decimal(17).mod(5).toString()).toBe(Decimal(2).toString());
    expect(Decimal(-17).mod(5).toString()).toBe(Decimal(-2).toString());
  });

  it('returns positive modulo', () => {
    expect(Decimal(-17).modPositive(5).toString()).toBe(Decimal(3).toString());
  });

  it('leaves positive remainders unchanged in modPositive', () => {
    const result = Decimal(17).modPositive(5);
    expect(result.toString()).toBe(Decimal(2).toString());
  });

  it('rejects negative divisors for positive modulo', () => {
    expect(() => Decimal(1).modPositive(-5)).toThrow('Modulo divisor must be positive');
  });

  it('aligns to multiples with step helpers', () => {
    expect(Decimal(17).floorBy(4).toString()).toBe(Decimal(16).toString());
    expect(Decimal(-17).floorBy(4).toString()).toBe(Decimal(-20).toString());
    expect(Decimal(17).ceilBy(4).toString()).toBe(Decimal(20).toString());
    expect(Decimal(-17).ceilBy(4).toString()).toBe(Decimal(-16).toString());
    expect(Decimal(17).truncBy(4).toString()).toBe(Decimal(16).toString());
    expect(Decimal(-17).truncBy(4).toString()).toBe(Decimal(-16).toString());
  });

  it('ceilBy advances values that exceed the step by tiny margins', () => {
    const value = Decimal('4.0000000000000000005');
    const aligned = value.ceilBy(1);
    expect(aligned.toString()).toBe('5');
  });

  it('floorBy drops negatives that are just below the previous multiple', () => {
    const value = Decimal('-4.0000000000000000005');
    const aligned = value.floorBy(1);
    expect(aligned.toString()).toBe('-5');
  });

  it('rounds to step size using explicit mode', () => {
    expect(Decimal(6).roundBy(4, 'floor').toString()).toBe(Decimal(4).toString());
    expect(Decimal(6).roundBy(4, 'ceil').toString()).toBe(Decimal(8).toString());
    expect(Decimal(-6).roundBy(4, 'ceil').toString()).toBe(Decimal(-4).toString());
  });

  it('rounds to the nearest step by default', () => {
    expect(Decimal(6).roundBy(4).toString()).toBe(Decimal(8).toString());
    expect(Decimal(2).roundBy(4).toString()).toBe(Decimal(4).toString());
    expect(Decimal(-6).roundBy(4).toString()).toBe(Decimal(-8).toString());
  });

  it('rounds to the nearest step in place by default', () => {
    const value = Decimal('5.75');
    value.roundBy$('0.5');
    expect(value.toString()).toBe('6.0');
    value.add$(0.24);
    value.roundBy$('0.5');
    expect(value.toString()).toBe('6.0');
  });
});

describe('Decimal comparisons', () => {
  it('compares equality and inequality', () => {
    const a = Decimal(1.234);
    const b = Decimal({ coeff: 1234n, digits: 3 });
    expect(a.eq(b)).toBe(true);
    expect(a.neq(Decimal(2))).toBe(true);
  });

  it('orders decimals correctly', () => {
    const a = Decimal(-2.5);
    const b = Decimal(-2.4);
    expect(a.lt(b)).toBe(true);
    expect(b.gt(a)).toBe(true);
    expect(a.le(a)).toBe(true);
    expect(b.ge(a)).toBe(true);
  });

  it('checks inclusive bounds using between', () => {
    expect(Decimal(5).between(1, 10)).toBe(true);
    expect(Decimal(10).between(1, 10)).toBe(true);
    expect(Decimal(0).between(1, 10)).toBe(false);
  });

  it('handles undefined bounds in between', () => {
    expect(Decimal(5).between(undefined, 5)).toBe(true);
    expect(Decimal(-2).between(-2, undefined)).toBe(true);
    expect(Decimal(12).between(undefined, 5)).toBe(false);
  });

  it('rejects inverted ranges in between checks', () => {
    expect(() => Decimal(5).between(10, 1)).toThrow('Invalid between range');
  });
});

describe('Decimal presentation', () => {
  it('renders to string with trailing zeros', () => {
    const value = Decimal({ coeff: 12300n, digits: 2 });
    expect(value.toString()).toBe('123.00');
  });

  it('renders zero respecting exponent', () => {
    const value = Decimal({ coeff: 0n, digits: 3 });
    expect(value.toString()).toBe('0.000');
  });

  it('renders zero compactly when exponential shorthand is used', () => {
    const value = Decimal('0e5');
    expect(value.toString()).toBe('0');
  });

  it('renders values less than one with leading zero', () => {
    const value = Decimal(0.005);
    expect(value.toString()).toBe('0.005');
  });

  it('throws when decimal precision exceeds safe conversion range', () => {
    expect(() => Decimal({ coeff: 1n, digits: 9007199254740992 })).toThrow(RangeError);
  });

  it('produces fixed decimals with padding without rounding', () => {
    const value = Decimal(1.2);
    expect(value.toFixed(3)).toBe('1.200');
  });

  it('rounds half away from zero when fixing digits', () => {
    expect(Decimal(1.235).toFixed(2)).toBe('1.24');
    expect(Decimal(-1.235).toFixed(2)).toBe('-1.24');
  });

  it('supports bigint fraction digits without mutating original', () => {
    const value = Decimal(2.5);
    const result = value.toFixed(0n);
    expect(result).toBe('3');
    expect(value.toString()).toBe('2.5');
  });

  it('rejects negative fraction digits', () => {
    expect(() => Decimal(1).toFixed(-1)).toThrow('Fraction digits must be a non-negative integer');
  });
});

describe('NumberLike utilities', () => {
  it('computes min and max across inputs', () => {
    const minResult = min(Decimal(5), 3, 4);
    const maxResult = max(Decimal(5), 7, 4);
    expect(minResult).not.toBeNull();
    expect(maxResult).not.toBeNull();
    expect(minResult?.toString()).toBe(Decimal(3).toString());
    expect(maxResult?.toString()).toBe(Decimal(7).toString());
  });

  it('computes minmax across inputs', () => {
    const [minValue, maxValue] = minmax(Decimal(5), 3, 4, null);
    expect(minValue).not.toBeNull();
    expect(maxValue).not.toBeNull();
    expect(minValue?.toString()).toBe(Decimal(3).toString());
    expect(maxValue?.toString()).toBe(Decimal(5).toString());
  });

  it('ignores nullish values when aggregating', () => {
    const minResult = min(null, undefined, 4, Decimal(2));
    const maxResult = max(undefined, null, Decimal(2), 8);
    expect(minResult).not.toBeNull();
    expect(maxResult).not.toBeNull();
    expect(minResult?.toString()).toBe(Decimal(2).toString());
    expect(maxResult?.toString()).toBe(Decimal(8).toString());
  });

  it('returns null when all inputs are nullish', () => {
    expect(min(null, undefined)).toBeNull();
    expect(max(undefined, null)).toBeNull();
    const [minValue, maxValue] = minmax(undefined, null);
    expect(minValue).toBeNull();
    expect(maxValue).toBeNull();
    const [emptyMin, emptyMax] = minmax();
    expect(emptyMin).toBeNull();
    expect(emptyMax).toBeNull();
  });

  it('clamps values within bounds', () => {
    expect(Decimal(10).clamp(0, 5).toString()).toBe(Decimal(5).toString());
    expect(Decimal(-1).clamp(0, 5).toString()).toBe(Decimal(0).toString());
  });

  it('ignores undefined lower bound when clamping', () => {
    const result = Decimal(3).clamp(undefined, Decimal(2));
    expect(result.toString()).toBe(Decimal(2).toString());
  });

  it('ignores undefined upper bound when clamping', () => {
    const result = Decimal(-3).clamp(Decimal(-1), undefined);
    expect(result.toString()).toBe(Decimal(-1).toString());
  });

  it('creates decimals from string inputs', () => {
    expect(Decimal('123.45').toString()).toBe(Decimal(123.45).toString());
  });

  it('exposes namespace helpers for min and max', () => {
    const nsMin = Decimal.min(Decimal(10), 3, null);
    const nsMax = Decimal.max(undefined, 7, Decimal(8));
    expect(nsMin?.toString()).toBe(Decimal(3).toString());
    expect(nsMax?.toString()).toBe(Decimal(8).toString());
  });
});

describe('Decimal numeric accessors', () => {
  it('produces native number output', () => {
    const value = Decimal({ coeff: 314159n, digits: 5 });
    expect(value.number()).toBeCloseTo(3.14159);
  });

  it('throws when integer scaling uses non-integer digits', () => {
    const value = Decimal(1) as Decimal & { digits: number };
    value.digits = -1.5;
    expect(() => value.integer()).toThrow();
  });

  it('returns integer part as bigint', () => {
    const value = Decimal({ coeff: -98765n, digits: 2 });
    expect(value.integer()).toBe(-987n);
  });

  it('round trips non-terminating binary fractions', () => {
    const cases = [0.1, 0.2, 0.3, 0.1 + 0.2, 1 / 3, 0.615];
    for (const value of cases) {
      expect(Decimal(value).number()).toBe(value);
    }
  });
});

describe('Decimal string parsing', () => {
  it('accepts scientific notation strings', () => {
    expect(Decimal('1.5e2').toString()).toBe(Decimal(150).toString());
  });

  it('trims whitespace around strings', () => {
    expect(Decimal('  -2.5e1 ').toString()).toBe(Decimal(-25).toString());
  });

  it('throws on invalid empty strings', () => {
    expect(() => Decimal('')).toThrow('Invalid number');
  });

  it('accepts explicit positive prefixes', () => {
    expect(Decimal('+42.1').toString()).toBe(Decimal(42.1).toString());
  });

  it('throws when exponent lacks a mantissa', () => {
    expect(() => Decimal('e10')).toThrow('Invalid number');
  });

  it('throws on sign-only strings', () => {
    expect(() => Decimal('+')).toThrow('Invalid number');
    expect(() => Decimal('-')).toThrow('Invalid number');
  });

  it('parses values that start with a decimal point', () => {
    expect(Decimal('.5').toString()).toBe(Decimal(0.5).toString());
  });
});

describe('Decimal boundaries', () => {
  it('rejects NaN inputs', () => {
    expect(() => Decimal(Number.NaN)).toThrow('Invalid number');
  });

  it('rejects malformed scientific notation', () => {
    expect(() => Decimal('1e')).toThrow('Invalid number');
  });

  it('rejects exponent values that exceed the safe integer range', () => {
    const huge = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
    expect(() => Decimal(`1e${huge}`)).toThrow('Exponent is out of range');
  });

  it('rejects unsupported input payloads', () => {
    expect(() => Decimal({} as unknown as never)).toThrow('Invalid input type for Decimal');
  });

  it('throws when rounding with zero step', () => {
    expect(() => Decimal(5).roundBy(0)).toThrow('Cannot align to zero');
  });

  it('throws when modulo divisor is zero', () => {
    expect(() => Decimal(7).mod(0)).toThrow('Division by zero');
  });

  it('throws when clamp bounds are inverted', () => {
    expect(() => Decimal(1).clamp(5, 1)).toThrow('Invalid clamp range');
  });

  it('throws when raising zero to a negative exponent', () => {
    expect(() => Decimal(0).pow(-1n, 6n)).toThrow('Zero to negative exponent is undefined');
  });

  it('rejects negative power precision', () => {
    expect(() => Decimal(2).pow(2n, -1n)).toThrow();
  });

  it('throws when raising negative bases to fractional exponents', () => {
    expect(() => Decimal(-4).pow(Decimal({ coeff: 5n, digits: 1 }), 8n)).toThrow(
      'Fractional exponent requires non-negative base',
    );
  });

  it('rejects pow10 exponents beyond safe integer range', () => {
    const huge = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
    expect(() => Decimal.pow10(huge)).toThrow('Exponent must be an integer');
  });

  it('returns one when exponent is zero', () => {
    const result = Decimal(7).pow(0n, 6n);
    expect(result.toString()).toBe(Decimal(1).toString());
  });

  it('handles positive-exponent integer parts when exponentiating', () => {
    const exponent = Decimal({ coeff: 12n, digits: -1 });
    const result = Decimal(2).pow(exponent);
    const expected = Decimal({ coeff: 1n << 120n, digits: 0 });
    expect(result.eq(expected)).toBe(true);
  });

  it('negates values without mutating the original', () => {
    const original = Decimal(3.5);
    const negated = original.neg();
    expect(negated.toString()).toBe(Decimal(-3.5).toString());
    expect(original.toString()).toBe(Decimal(3.5).toString());
  });

  it('does not pad degree-one roots to the precision', () => {
    const value = Decimal({ coeff: 1234000n, digits: 6 });
    const result = value.root(1n, 8n);
    expect(result.toString()).toBe('1.234');
    expect(result.digits).toBe(3);
  });

  it('rounds degree-one roots to significant precision', () => {
    const value = Decimal({ coeff: 1234000n, digits: 6 });
    const result = value.root(1n, 3n);
    expect(result.toString()).toBe('1.23');
    expect(result.digits).toBe(2);
    expect(value.digits).toBe(6);
  });

  it('retains requested digits when dividing with trailing zeros', () => {
    const result = Decimal(1).divRound(Decimal(2), 4n);
    expect(result.toString()).toBe(Decimal('0.5000').toString());
    expect(result.digits).toBe(4);
  });

  it('does not pad significant digits when raising to negative exponents', () => {
    const result = Decimal(2).pow(-1n, 6n);
    expect(result.toString()).toBe('0.5');
    expect(result.digits).toBe(1);
  });

  it('normalizes significant-precision roots with trailing zeros', () => {
    const result = Decimal('1.440000').root(2n, 6n);
    expect(result.toString()).toBe('1.2');
    expect(result.digits).toBe(1);
  });

  it('rescale compresses digits only when explicitly invoked', () => {
    const value = Decimal(1).divRound(2, 6n);
    const compressed = value.rescale();
    expect(value.digits).toBe(6);
    expect(compressed.toString()).toBe(Decimal('0.5').toString());
    expect(compressed.digits).toBe(1);
  });

  it('keeps negative-scale values unchanged when rescaling without digits', () => {
    const value = Decimal({ coeff: 123n, digits: -2 });
    const rescaled = value.rescale();
    expect(rescaled.toString()).toBe('12300');
    expect(rescaled.digits).toBe(-2);
  });

  it('computes logarithms with fractional digits', () => {
    const result = Decimal(3).log(Decimal(2), 6n);
    expect(result.number()).toBeCloseTo(Math.log2(3), 5);
  });

  it('computes fractional logarithms at the requested precision', () => {
    const result = Decimal(3).log(10, 8n);
    expect(result.toString()).toBe('0.47712125');
  });

  it('rejects unsafe logarithm precision before mutating the receiver', () => {
    const value = Decimal(3);
    expect(() => value.log$(10, Number.MAX_SAFE_INTEGER + 1)).toThrow();
    expect(value.eq(3)).toBe(true);
  });

  it('converts positive exponent decimals to strings without decimal points', () => {
    const value = Decimal({ coeff: 123n, digits: -2 });
    expect(value.toString()).toBe('12300');
  });

  it('returns integer values respecting positive exponents', () => {
    const value = Decimal({ coeff: 12n, digits: -2 });
    expect(value.integer()).toBe(1200n);
  });

  it('returns null when min and max receive no operands', () => {
    expect(min()).toBeNull();
    expect(max()).toBeNull();
  });

  it('keeps values unchanged when already within clamp bounds', () => {
    const original = Decimal(3.5);
    const clamped = original.clamp(Decimal(0), Decimal(5));
    expect(clamped.eq(original)).toBe(true);
  });

  it('compresses zero to standard form with rescale', () => {
    const value = Decimal({ coeff: 0n, digits: 5 });
    const compressed = value.rescale();
    expect(compressed.digits).toBe(0);
    expect(compressed.toString()).toBe('0');
  });

  it('compresses zero with negative exponent to standard form with rescale', () => {
    const value = Decimal({ coeff: 0n, digits: -5 });
    const compressed = value.rescale();
    expect(compressed.digits).toBe(0);
    expect(compressed.toString()).toBe('0');
  });
});

describe('Decimal inverse operations', () => {
  it('computes multiplicative inverses without mutating the original', () => {
    const original = Decimal('4');
    const inverse = original.inverse(4n);
    expect(inverse.toString()).toBe('0.25');
    expect(original.toString()).toBe('4');
  });

  it('inverts in place with inverse$', () => {
    const value = Decimal('8');
    value.inverse$(3n);
    expect(value.toString()).toBe('0.125');
  });

  it('throws when inverting zero in place', () => {
    const zero = Decimal(0);
    expect(() => zero.inverse$()).toThrow('Division by zero');
  });
});

describe('Decimal primitive integrations', () => {
  it('uses Symbol.toString for string coercion', () => {
    const value = Decimal('-12.5') as any;
    const primitive = value.toString();
    expect(primitive).toBe('-12.5');
  });

  it('formats inspect output based on color hint', () => {
    const toInspect = Decimal('3.14') as any;
    const inspectedWithColor = toInspect[Symbol.for('nodejs.util.inspect.custom')](0, { colors: true });
    const inspectedWithoutColor = toInspect[Symbol.for('nodejs.util.inspect.custom')](0, { colors: false });
    expect(inspectedWithColor).toContain('\u001B[33m3.14\u001B[m');
    expect(inspectedWithColor).toContain('(314 * 10 ** -2)');
    expect(inspectedWithoutColor).toBe('3.14');
  });
});
