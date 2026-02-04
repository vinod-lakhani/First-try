# Net Worth Simulator — Growth Rates

All rates are configurable via `ScenarioInput`. Defaults match the standalone net-worth-interactive experience.

## What grows at what rate

| Asset | Rate used | Input param | Default (approx) | Notes |
|-------|-----------|-------------|-------------------|--------|
| **Cash** (emergency fund, HYSA) | Cash yield | `cashYieldPct` | **4%/yr** | Liquid, low risk |
| **Brokerage** (taxable investing) | Nominal return − tax drag | `nominalReturnPct` − `taxDragBrokeragePct` | **8.5%/yr** | 9% − 0.5% drag |
| **Retirement** (401k, Roth IRA, etc.) | Nominal return | `nominalReturnPct` | **9%/yr** | Tax-advantaged, full growth |
| **HSA** (health savings) | Nominal return | `nominalReturnPct` | **9%/yr** | Invested like retirement |
| **Liabilities** (debts) | Per-debt APR | each liability’s `aprPct` | varies | Interest accrues monthly |

- **Investment rate (9% default)** is used for: **Retirement** (401k, match, Roth, etc.) and **HSA**. Only **Cash** uses the lower cash rate (4%).
- **Brokerage** uses the same nominal return as retirement but with a tax-drag reduction (default 0.5%/yr) to reflect taxable investing.
