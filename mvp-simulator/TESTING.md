# MVP Simulator Test Suite

## Purpose

This test suite validates all core functions of the MVP simulator so that:

1. **Regression safety** – Changes to allocation or plan logic don’t break known behavior.
2. **Shareable contracts** – Inputs and results are logged so the team can compare the real product against the same cases.
3. **Documentation** – Test cases double as specs for “given these inputs, we expect these outputs.”

## Methodology

### 1. Test pyramid

- **Unit tests** – Pure engines in isolation: `allocateIncome`, `allocateSavings`, `simulateScenario`. Fast, many cases, easy to debug.
- **Integration tests** – Full plan pipeline: build `OnboardingState` → `buildFinalPlanData` / `generateBoostedPlanAndProjection`. Fewer cases, cover real flows.
- **Regression tests** – Explicit cases for past bugs (e.g. shift limit 4%, EF target 0). Keep these so the bugs don’t come back.

### 2. Contract-style cases

Each important case is structured as:

- **Input** – Exact payload (income, targets, actuals, shift limit, EF months, etc.).
- **Expected output** – Key numbers and invariants (e.g. `needs$ + wants$ + savings$ === income$`, shift capped at 4%).
- **Optional notes** – Business rule being tested (e.g. “EF target 0 → no EF allocation”).

These inputs/outputs are written to `test-results/` so you can:

- Share `test-cases.json` (or the summary) with the team.
- Reuse the **same inputs** in the real product and compare results (same allocation engine contract).

### 3. Using this for the real product

- **Same engines** – If the product uses the same `allocateIncome` / `allocateSavings` / net worth sim, run it with the same inputs and diff the outputs.
- **Different engines** – If the product has its own implementation, use `test-cases.json` as the **contract**: same inputs → outputs should match (or differences documented and accepted).
- **Process** – On each release (or before major changes), run `npm run test:report`, attach `test-results/test-summary-<timestamp>.txt` and `test-results/test-cases.json` to the release or Slack, and optionally run the same cases in staging/production and compare.

### 4. What we log

- **Unit / integration** – For each test: `{ name, inputs, outputs, notes }`. Outputs are trimmed to the fields that define “correct” (e.g. allocation dollars, KPIs).
- **Summary** – A human-readable `test-summary-<timestamp>.txt` with pass/fail, case names, and a short summary of inputs/outputs for key cases.

## Running tests

```bash
# Run all tests (no report files)
npm test

# Run tests and write shareable report to test-results/
npm run test:report
```

Reports are written under `test-results/`:

- `test-cases.json` – All recorded cases (inputs + outputs) for sharing or reuse.
- `test-summary-<timestamp>.txt` – Human-readable summary for quick review.

## Test layout

| File | Scope | What it covers |
|------|--------|----------------|
| `__tests__/income.alloc.test.ts` | Unit | `round2`, `allocateIncome`: shift limit, wants floor, no shift when targets match actuals. |
| `__tests__/savings.alloc.test.ts` | Unit | `allocateSavings`: EF, match, HSA, debt, retirement/brokerage split; EF target 0. |
| `__tests__/netWorth.test.ts` | Unit | `simulateScenario`: growth, EF target reached, debt paydown. |
| `__tests__/plan.integration.test.ts` | Integration | `buildFinalPlanData` / `generateBoostedPlanAndProjection`: full flow from minimal state. |
| `__tests__/regression.test.ts` | Regression | Shift limit 4% (not 5%), EF target 0 (no $9400 target), and other past bugs. |

## Adding new cases

1. Add a test in the right file (unit vs integration vs regression).
2. Use `recordTestCase('Case name', inputs, outputs)` so the case is included in `test-cases.json` and the summary.
3. Keep inputs minimal and outputs focused on the contract (dollars, percentages, KPIs).

## Dependencies

- **Vitest** – Test runner and assertions.
- No extra runtime deps; report is plain JSON + text.
