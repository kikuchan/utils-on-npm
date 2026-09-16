# @kikuchan/decimal

Arbitrary precision decimal arithmetic for TypeScript and JavaScript. Avoids binary floating-point rounding errors.

## Installation

```bash
npm install @kikuchan/decimal
```

## Quick Start

```ts
import { Decimal } from '@kikuchan/decimal';

const price = Decimal('12.345');
const quantity = Decimal(3);
const total = price.mul(quantity).round(2);

console.log(total.toString()); // "37.04"
```

## Creating Decimals

The `Decimal()` constructor accepts numbers, strings, bigints, or existing Decimal instances:

```ts
Decimal(100)           // from number
Decimal('12.345')      // from string
Decimal('1.5e2')       // scientific notation
Decimal(12345n)        // from bigint
Decimal(existing)      // from another Decimal

// Nullable values pass through unchanged
Decimal(null)          // returns null
Decimal(undefined)     // returns undefined
```

## API Overview

### Arithmetic Operations

All operations are **immutable by default** and return new Decimal instances:

```ts
const a = Decimal('10.5');
const b = Decimal('2.3');

a.add(b)        // addition
a.sub(b)        // subtraction
a.mul(b)        // multiplication
a.div(b)        // exact when terminating; otherwise 18 significant digits
a.div(b, 5)     // round the quotient to 5 significant digits
a.divExact(b)   // exact quotient, or throw if the decimal expansion is non-terminating
a.divExact(b, 5) // exact when possible; otherwise 5 significant digits
a.divRound(b, 2) // round the exact quotient to 2 decimal places
a.divFloor(b)  // floor the exact quotient to an integer
a.divCeil(b)   // ceil the exact quotient to an integer
a.divTrunc(b)  // truncate the exact quotient toward zero

a.mod(b)        // modulo (same sign rules as JavaScript %)
a.modPositive(b)  // always non-negative remainder
```

### Mutable Operations

Methods ending with `$` modify the value in place and return `this`:

```ts
const value = Decimal('1.2345');
value.round$(2);  // value is now 1.23

// Both styles support chaining
value.add$(1).mul$(2).round$(0);
Decimal('10').add(5).mul(2).round(0);  // 30
```

### Rounding & Precision

```ts
const num = Decimal('12.3456');

num.round(2)     // 12.35 (half away from zero)
num.floor(2)     // 12.34
num.ceil(2)      // 12.35
num.trunc(2)     // 12.34

// Negative precision rounds to powers of 10
Decimal('1234').round(-2)  // 1200 (nearest hundred)

// Round to specific step sizes
Decimal('12.7').roundBy('0.5')  // 13.0
Decimal('47').roundBy(10)       // 50
```

**Digit positions** (`round`, `floor`, `ceil`, `trunc`, `divRound`, `divFloor`, `divCeil`, `divTrunc`):
- Positive values: digits after decimal point
- Zero: round to whole units
- Negative values: powers of ten (e.g., `-2` = hundreds)

**Significant precision** (`div`, `inverse`, `pow`, `root`, `sqrt`, `log`):

- A positive safe integer, supplied as `number` or `bigint`.
- Counts from the first nonzero digit, regardless of the decimal point's position.
- Limits the result's precision without padding trailing zeros.
- Explicit zero, negative, fractional, or unsafe precision values throw, even for exact results.

```ts
Decimal(1).div('3e30', 18).eq('3.33333333333333333e-31') // true
Decimal(12345).div(7, 3).toString()                     // "1760"
Decimal(12345).divRound(7, 3).toString()                // "1763.571"
Decimal(12345).divFloor(7, -2).toString()               // "1700"
```

### Exact and Rounded Division

`a.div(b)` is equivalent to `a.divExact(b, 18)`, **not** to `a.div(b, 18)`:

| Call | Terminating quotient | Non-terminating quotient |
| --- | --- | --- |
| `div(b)` | Exact | 18 significant digits |
| `div(b, precision)` | Rounded to precision | Rounded to precision |
| `divExact(b)` | Exact | Throws `RangeError` |
| `divExact(b, fallbackPrecision)` | Exact | Rounded to fallback precision |

Passing `undefined` is equivalent to omitting that argument. An explicit fallback permits approximation only
for non-terminating quotients; it does not suppress division-by-zero or invalid-argument errors.

```ts
Decimal(1).div(8, 2).toString()       // "0.13"
Decimal(1).divExact(8, 2).toString()  // "0.125"
Decimal(1).divExact(3, 2).toString()  // "0.33"
Decimal(1).divExact(3)               // throws: Non-terminating decimal expansion
```

`divRound(b, digits = 0, mode = 'round')` rounds the **exact** quotient directly to the requested digit
position. `divFloor`, `divCeil`, and `divTrunc` accept the same `digits` argument and select a fixed direction.
These methods preserve the requested scale, including for zero. All have mutable `$` counterparts.

Direct rounding avoids double rounding and incorrect integer boundary decisions:

```ts
const x = Decimal('2.99999999999999999999');
x.div(3).floor().toString() // "1": division rounded the intermediate quotient
x.divFloor(3).toString()   // "0": floors the exact quotient
Decimal(0).divRound(3, 4).toString() // "0.0000"
```

### Sign & Absolute Value

```ts
const num = Decimal('-5.5');

num.neg()         // 5.5
num.abs()         // 5.5
num.isNegative()  // true
num.isPositive()  // false
num.isZero()      // false
```

### Comparison

```ts
const a = Decimal('10');
const b = Decimal('20');

a.cmp(b)      // -1 (less), 0 (equal), or 1 (greater)
a.eq(b)       // false
a.lt(b)       // true
a.le(b)       // true
a.gt(b)       // false
a.ge(b)       // false

a.between(5, 15)        // true
a.between(15, 25)       // false
a.isCloseTo(10.001, 0.01)  // true
```

### Advanced Math

```ts
const num = Decimal('100');

num.sqrt()           // square root
num.root(3)          // cube root
num.pow(2)           // exponentiation
num.pow('0.5')       // fractional exponents (non-negative bases only)
num.log(10)          // logarithm (base 10)
num.inverse()        // 1 / num

// All accept an optional significant precision argument
num.sqrt(10)         // at most 10 significant digits
num.log(10, 20)      // at most 20 significant digits
```

Without explicit precision, powers and roots return an exact finite decimal whenever one exists; otherwise
they round to 18 significant digits. Non-negative integer powers are exact by default. Negative integer powers
use the same exact-first policy as division. Fractional powers detect exact rational roots before using approximation.
`inverse(p)` is numerically equivalent to `Decimal(1).div(value, p)`.

```ts
Decimal(2).pow(100).eq(2n ** 100n)                        // true
Decimal('0.5').pow(100).eq({ coeff: 5n ** 100n, digits: 100 }) // true
Decimal('1e-40').sqrt().eq('1e-20')                       // true
Decimal(16).pow('1.25').toString()                       // "32"
Decimal('1.5241383936').sqrt(5).toString()                // "1.2346"
```

An explicit precision rounds even exact results, including `pow(1, p)` and `root(1, p)`. Integer powers with
explicit precision use bounded working coefficients rather than constructing the entire exact power first.
Exact results can grow with the operands and exponent; use explicit precision to bound result precision.

`log(base, precision = 18)` always uses significant precision, including for exactly representable logarithms.
Arguments and bases must be positive, and the base must not be one. Root degrees must be positive safe integers;
negative radicands require odd degrees. Fractional powers retain the non-negative-base restriction. As before,
`pow(0)` returns one (including `0^0`), and zero raised to a negative exponent throws.

**Accuracy:** division, powers, and roots are rounded as if computed exactly and then rounded once.
General logarithms have absolute error less than one unit in the last place of the requested significant precision;
at an exceptionally close rounding boundary, their last digit may differ from the correctly rounded result.
The implementation uses outward-rounded intervals and increases working precision to resolve the output.
If refinement cannot resolve the requested accuracy, it throws `RangeError` instead of returning an unchecked iterate.
The precision applies to each operation, not to an entire chain of rounded operations.

### Decimal Point Manipulation

```ts
const num = Decimal('12.345');

num.shift10(2)       // 1234.5 (shift right = multiply by 10²)
num.shift10(-1)      // 1.2345 (shift left = divide by 10)

// Split into integer and fractional parts
const [whole, frac] = num.split(2);  // [12.34, 0.005]
```

### Conversion

```ts
const num = Decimal('12.345');

num.toString()       // "12.345"
num.toFixed(2)       // "12.35"
num.number()         // 12.345 (native number)
num.integer()        // 12n (bigint, truncated)
```

### Utilities

```ts
Decimal('12.3000').rescale()   // "12.3" (remove trailing zeros)

const a = Decimal('5.5');
a.clamp(0, 10)        // 5.5 (bounded)
a.clamp(6, 10)        // 6 (clamped to minimum)

// Exported utility functions
import { min, max, minmax, pow10, isDecimal } from '@kikuchan/decimal';

min(1, 2, 3)              // Decimal(1)
max('1.5', '2.5', '3.5')  // Decimal(3.5)
minmax(5, 1, 3)           // [Decimal(1), Decimal(5)]
pow10(3)                  // Decimal(1000)
isDecimal(value)          // type guard
```

## Rounding Modes

`div`, `divExact`, and `divRound` accept a third rounding-mode argument. `rescale`, `roundBy`, and the split
helpers also accept modes; `round`, `floor`, `ceil`, and `trunc` select their direction by name.

- `'round'` — half away from zero (default)
- `'floor'` — toward negative infinity
- `'ceil'` — toward positive infinity
- `'trunc'` — toward zero

```ts
const num = Decimal('12.75');
num.round(1)  // 12.8
num.floor(1)  // 12.7
num.ceil(1)   // 12.8
num.trunc(1)  // 12.7
num.div(7, 10, 'floor')
num.divRound(7, 2, 'ceil')
```

## Important Notes

- **Immutability**: Operations return new instances unless using `$` methods
- **Precision**: Exact-first division, powers, and roots; 18 significant digits when approximation is needed
- **Range**: Coefficients use BigInt; scales, integer power exponents, and root degrees use safe integers. Internal scale and exponent calculations use numbers without a BigInt fallback. Runtime and memory still depend on input and result size
- **Null-safe**: `Decimal(null)` and `Decimal(undefined)` pass through unchanged

## Development

```bash
pnpm test      # Run tests
pnpm build     # Build package
pnpm lint      # Lint source
pnpm format    # Check formatting
```

## License

See LICENSE file for details.
