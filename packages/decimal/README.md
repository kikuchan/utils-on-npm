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
a.div(b)        // division (default 18 decimal places)
a.div(b, 5)     // division with custom precision

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

**Precision control:**
- Positive values: digits after decimal point
- Zero: round to whole units
- Negative values: powers of ten (e.g., `-2` = hundreds)

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

// All accept optional precision argument
num.sqrt(10)         // 10 decimal places
num.log(10, 20)      // 20 decimal places
```

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

All rounding operations support these modes:

- `'round'` — half away from zero (default)
- `'floor'` — toward negative infinity
- `'ceil'` — toward positive infinity
- `'trunc'` — toward zero

```ts
const num = Decimal('12.75');
num.round(1, 'round')  // 12.8
num.round(1, 'floor')  // 12.7
num.round(1, 'ceil')   // 12.8
num.round(1, 'trunc')  // 12.7
```

## Important Notes

- **Immutability**: Operations return new instances unless using `$` methods
- **Precision**: Division and advanced math default to 18 decimal places
- **No silent overflow**: All operations maintain arbitrary precision
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
