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

## Used by Savings Helper (e.g. $500 undersaved)

The savings-helper net worth chart and projection cards use **this simulator with investment returns on**:

1. **Where assumptions come from:** `buildFinalPlanData` in `lib/onboarding/plan.ts` passes `ScenarioInput` with:
   - `nominalReturnPct`: `riskConstraints?.assumptions?.nominalReturnPct || 9.0`
   - `cashYieldPct`: `riskConstraints?.assumptions?.cashYieldPct || 4.0`
   - `inflationRatePct`: `riskConstraints?.assumptions?.inflationRatePct || 2.5` (used for goals/display, not asset growth)
   - `taxDragBrokeragePct`: 0.5

2. **How net worth is computed over time (monthly):**
   - **Apply growth** to existing balances: cash × (1 + cashYield), brokerage × (1 + brokerageReturn), retirement × (1 + nominalReturn), HSA × (1 + nominalReturn).
   - **Add inflows** from the plan: EF, brokerage, 401k, match, HSA, Roth, etc. (these are the savings from the plan; undersaved = lower contributions here).
   - **Update liabilities** (interest + payments).
   - **Subtract outflows** from cash: debt payments only. Needs and wants are paid from income, not from the emergency fund, so they are not subtracted from cash (this keeps the EF from incorrectly depleting to $0 over time).

3. **So for $500 undersaved:** The proposed plan has $500/month less in total savings. That flows into lower monthly contributions to EF, retirement, brokerage, etc. Each month the proposed path adds less to investments, and existing balances still grow at the same rates (9%, 4%, etc.). So the **gap** between "Planned net worth (current)" and "Proposed plan" grows over time because (a) you contribute less each month, and (b) that foregone savings does not earn the 9% (or 4%) return.

If you want a **no-return** or **conservative** projection, you would set `nominalReturnPct` and `cashYieldPct` to 0 (or a lower number) in `riskConstraints.assumptions`; the simulator does not currently expose that toggle in the savings-helper UI.
