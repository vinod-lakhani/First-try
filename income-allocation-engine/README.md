# Income Allocation Engine

A TypeScript module implementing the Needs/Wants/Savings allocation framework with gradual adjustments based on 3-month actual spending averages.

## Overview

This engine allocates income based on target percentages (default 50/30/20 rule) and adjusts gradually using actual spending data. The key principle is that Fixed/Needs expenses are largely unchangeable in the short term, so adjustments primarily come from Variable/Wants spending.

## Installation

```bash
npm install
```

## Usage

```typescript
import { allocateIncome, IncomeInputs } from './lib/alloc/income';

const inputs: IncomeInputs = {
  incomePeriod$: 4000,
  targets: { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 },
  actuals3m: { needsPct: 0.50, wantsPct: 0.35, savingsPct: 0.15 },
  shiftLimitPct: 0.04, // Optional: default is 4%
};

const allocation = allocateIncome(inputs);
console.log(allocation);
// {
//   needs$: 2000,
//   wants$: 1240,
//   savings$: 760,
//   notes: ["Applied 4% shift from Wants→Savings"]
// }
```

## Running Tests

```bash
npm test
```

## File Structure

```
income-allocation-engine/
├── lib/
│   └── alloc/
│       └── income.ts          # Main engine implementation
├── __tests__/
│   └── income.alloc.test.ts    # Unit tests
├── package.json
├── tsconfig.json
└── README.md
```

## API

### `IncomeInputs`

- `incomePeriod$`: Paycheck or monthly net income in dollars
- `targets`: Target percentages for Needs/Wants/Savings (must sum to 1.0)
- `actuals3m`: 3-month average actual percentages (must sum to 1.0)
- `shiftLimitPct?`: Maximum shift percentage per period (default: 0.04 = 4%)

### `IncomeAllocation`

- `needs$`: Allocated dollars for Needs
- `wants$`: Allocated dollars for Wants
- `savings$`: Allocated dollars for Savings
- `notes`: Array of notes about adjustments made

## Rules

1. Start from targets; compare to 3-month actuals
2. If Savings < target, shift from Wants up to `min(gap, shiftLimitPct * income, (aWants - targetWants))`
3. Keep Needs at actual short-term; do not reduce below actuals
4. If Wants cannot fully cover the gap, apply partial shift and add note
5. Output dollars that sum exactly to `incomePeriod$`; reconcile rounding on savings

