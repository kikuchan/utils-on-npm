# @kikuchan/calendar

Arbitrary precision date and time library built on top of `@kikuchan/decimal`. Handles fractional seconds, time zones, and calendar alignment operations.

## Installation

```bash
npm install @kikuchan/calendar @kikuchan/decimal
```

## Quick Start

```ts
import { Calendar } from '@kikuchan/calendar';

// Current time in UTC
const now = new Calendar();

// From calendar components
const date = new Calendar(2024, 6, 15, 12, 30, '45.123', 'utc');
console.log(date.format('YYYY-MM-DD hh:mm:ss.SSS')); // "2024-06-15 12:30:45.123"

// From epoch seconds (with arbitrary precision)
const epoch = Calendar.fromEpoch('1718451045.123456789', 'utc');
console.log(epoch.seconds().toString()); // "45.123456789"
```

## Creating Calendar Instances

### Constructors

```ts
// Current time in UTC
new Calendar();

// From epoch seconds with optional time zone
new Calendar(epochSeconds);
new Calendar(epochSeconds, 'America/New_York');

// From calendar components (year, month, day, hour?, minutes?, seconds?, zone?)
new Calendar(2024, 6, 15);
new Calendar(2024, 6, 15, 12, 30, '45.5', 'utc');

// From native Date
new Calendar(new Date(), 'local');
```

### Static Methods

```ts
Calendar.fromEpoch(epochSeconds, zone?)       // from Unix epoch seconds
Calendar.fromDate(date, zone?)                // from native Date
Calendar.fromComponents(components, zone?)    // from object { year, month, day, ... }
Calendar.parse(value, format, zone?)          // from formatted string
```

## Time Zones

Supports UTC, local system time, and IANA time zone names:

```ts
const date = Calendar.fromEpoch(0, 'utc');

date.zone();                    // 'utc'
date.zone('America/New_York');  // new instance with different zone
date.utc();                     // shorthand for zone('utc')
date.local();                   // shorthand for zone('local')

// In-place mutation with $ suffix
date.zone$('Asia/Tokyo');
date.utc$();
date.local$();
```

## API Overview

### Component Accessors

All getters return the value; setters return a new instance (immutable):

```ts
const date = Calendar.fromComponents({ year: 2024n, month: 6n, day: 15n }, 'utc');

date.year();       // 2024n (bigint)
date.month();      // 6n
date.day();        // 15n
date.hour();       // 0n
date.minutes();    // 0n
date.seconds();    // Decimal(0)
date.weekday();    // 6 (Saturday, 0=Sunday)

// Setters return new instances
date.year(2025);   // new Calendar with year 2025
date.month(12).day(31);  // chaining works
```

### Mutable Operations

Methods ending with `$` modify the instance in place:

```ts
const date = Calendar.fromEpoch(0, 'utc');
date.year$(2000).month$(6).day$(15);
date.hour$(12).minutes$(30).seconds$('45.5');
```

### Epoch Access

```ts
const date = Calendar.fromEpoch('1718451045.123', 'utc');

date.epoch();              // Decimal('1718451045.123')
date.epoch('0');           // new instance at epoch 0
date.epoch$('123.456');    // mutate in place
```

### Components

```ts
const date = new Calendar(2024, 6, 15, 12, 30, '45.5', 'utc');
date.components();
// {
//   year: 2024n,
//   month: 6n,
//   day: 15n,
//   hour: 12n,
//   minutes: 30n,
//   seconds: Decimal('45.5'),
//   weekday: 6
// }
```

### Cloning

```ts
const copy = date.clone();
```

## Alignment & Stepping

Align dates to boundaries or step to the next boundary. Time components are reset to midnight for day/month/year alignment.

### Day Alignment

```ts
const date = Calendar.fromComponents(
  { year: 2024n, month: 6n, day: 17n, hour: 10n, minutes: 30n, seconds: 0 },
  'utc'
);

date.alignToDay();        // same day at 00:00:00
date.alignToDay(5);       // align to nearest 5th (day 15)
date.alignToDay([1, 15]); // align to nearest from list (day 15)

date.nextDay(5);          // next 5-day boundary (day 20)
date.nextDay([1, 15]);    // next from list (July 1 if past 15th)
```

### Month Alignment

```ts
date.alignToMonth();     // first day of current month
date.alignToMonth(3);    // align to nearest quarter (month 4, 7, 10, or 1)

date.nextMonth(3);       // next quarter boundary
```

### Year Alignment

```ts
date.alignToYear();      // January 1 of current year
date.alignToYear(10);    // align to nearest decade

date.nextYear(10);       // next decade boundary

// Era-aware alignment (handles BC/AD transition)
date.alignToYear(100, { era: true });
date.nextYear(100, { era: true });
```

### Second Alignment

```ts
// Align to 15-second intervals within the day
date.alignToSecond(15);

// Align to 5-minute intervals
date.alignToSecond(300);
```

## Formatting

```ts
const date = Calendar.fromEpoch('12.3456', 'utc');

date.format('YYYY-MM-DD');                  // "1970-01-01"
date.format('YYYY-MM-DD hh:mm:ss');         // "1970-01-01 00:00:12"
date.format('YYYY-MM-DD hh:mm:ss.SSS');     // "1970-01-01 00:00:12.345"
date.format('YYYY-MM-DD hh:mm:ss.SSSSSS');  // "1970-01-01 00:00:12.345600"
```

## Parsing

```ts
const date = Calendar.parse('2024-06-15 12:30:45.123', 'YYYY-MM-DD hh:mm:ss.SSS', 'utc');
date.year(); // 2024n
```

Parsing defaults missing lower-order components to the start of the period (day = 1, time = 00:00:00), requires year
and month tokens, and validates calendar ranges (e.g. invalid dates throw). Duplicate tokens must resolve to the same
value.

### Format Tokens

| Token    | Description                        | Example               |
|----------|------------------------------------|-----------------------|
| `YYYY`   | 4+ digit year                      | `0123`                |
| `yyyy`   | 4+ digit year (alias)              | `0123`                |
| `y`      | Year without padding               | `123`                 |
| `MM`     | 2-digit month (1-2 digits parsed)  | `06`                  |
| `M`      | Month without padding              | `6`                   |
| `DD`     | 2-digit day (1-2 digits parsed)    | `15`                  |
| `hh`     | 2-digit hour (1-2 digits parsed)   | `14`                  |
| `h`      | Hour without padding               | `4`                   |
| `mm`     | 2-digit minutes (1-2 digits parsed)| `30`                  |
| `ss`     | 2-digit seconds (1-2 digits parsed)| `45`                  |
| `S`      | Fractional seconds (1 digit)       | `1`                   |
| `SS`     | Fractional seconds (2 digits)      | `12`                  |
| `SSS`    | Fractional seconds (3 digits)      | `123`                 |
| `SSSSSS` | Fractional seconds (6 digits)      | `123456`              |
| `G`      | Era year with AD/BC                | `BC 1` / `123 AD`     |
| `GGGG`   | Era year padded with AD/BC         | `BC 0001` / `0123 AD` |
| `g`      | Era year with BC prefix            | `BC 1` / `123`        |
| `gggg`   | Era year padded with BC prefix     | `BC 0001` / `0123`    |

Era tokens map to proleptic years where year 1 BC is `0`, 2 BC is `-1`, and so on.

## Important Notes

- **Immutability**: Operations return new instances unless using `$` methods
- **Precision**: Seconds support arbitrary precision via `@kikuchan/decimal`
- **Bigint**: Year, month, day, hour, and minutes are returned as `bigint`
- **Weekday**: Sunday = 0, Monday = 1, ..., Saturday = 6
- **Time Zones**: Uses `Intl.DateTimeFormat` for IANA zone support

## License

See LICENSE file for details.
