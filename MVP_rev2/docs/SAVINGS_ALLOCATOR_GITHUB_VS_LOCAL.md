# Savings Allocator: GitHub vs Local Comparison

Comparison of [GitHub MVP_rev2](https://github.com/vinod-lakhani/First-try/tree/main/MVP_rev2) savings-allocator with local MVP_rev2 to ensure consistency across all modes.

## Modes (AllocatorScenario)

- **my_data** – User has or had a saved plan; Current = last locked, Proposed = engine/overrides.
- **first_time** – Onboarding, no saved plan; no Current plan, Proposed = engine recommendation (Ribbit Proposal).
- **savings_decrease** – Same budget minus `simulateAmount`.
- **savings_increase** – Same budget plus `simulateAmount`.
- **no_match** – User not contributing to 401k; engine recommends capturing match; Current shows 401k=0, match=0.
- **no_hsa** – User not contributing to HSA; engine can recommend HSA; payroll has `currentlyContributingHSA: 'no'`.

---

## 1. Target / Budget Source

| Aspect | GitHub | Local |
|--------|--------|--------|
| URL target | Not used | `?target=4500` from params + `window.location.search` fallback for first paint |
| Store target | `proposedSavingsFromHelper` (store + sessionStorage restore) | Same + synced from `urlTarget` when present |
| Effective target | `proposedSavingsFromHelper` only | `effectiveProposedTarget = urlTarget ?? proposedSavingsFromHelper` |

**Intent:** Local keeps GitHub behavior and adds URL-driven target so Feed/links can open allocator with a target immediately.

---

## 2. savingsBudget (base budget before scenario/target)

| Aspect | GitHub | Local |
|--------|--------|--------|
| When no baselineSavingsData | Return 0 | Return 0 except in **first_time**: use `postTaxSavingsAvailable ?? 0` |
| When has baselineSavingsData | `postTaxSavingsAvailable \|\| baselineSavingsData.monthlySavings` | Same, **unless** hasCustomAlloc and no external target → use `baselineSavingsData.monthlySavings` so proposed = current when reopening after Apply |

**Intent:** Local matches GitHub for normal cases; adds first_time fallback when plan not ready and “reopen after apply” behavior so the table doesn’t show a false “target changed”.

---

## 3. budgetForProposedPlan

| Aspect | GitHub | Local |
|--------|--------|--------|
| When target set | `proposedSavingsFromHelper` | `effectiveProposedTarget` (includes urlTarget) |
| Else | `effectiveSavingsBudget` | `effectiveSavingsBudget` |

**Intent:** Same logic; local uses unified `effectiveProposedTarget`.

---

## 4. Engine budget (savingsBudgetForEngine) and employer match

| Aspect | GitHub | Local |
|--------|--------|--------|
| Engine input | Always `budgetForProposedPlan` (no separate var) | `savingsBudgetForEngine`: when **target set** → `effectiveProposedTarget - employerMatchForTarget`; else `budgetForProposedPlan` |
| Employer match | Not subtracted | Subtracted only when user sets a target (savings-helper) so “target” = total including match and table sum = target |

**Intent:**

- **first_time / my_data (no target):** Engine gets full budget (e.g. 3412). Display adds employer match → total = 3412 + match (e.g. 3751). Same as GitHub.
- **Target from savings-helper (e.g. 4500):** Target is “total including match”. Local passes (4500 − match) to engine so proposed table total = 4500. GitHub would pass 4500 and table would be 4500 + match; local fixes that.

---

## 5. effectiveSavingsBudget (scenario modifiers)

| Scenario | GitHub | Local |
|----------|--------|--------|
| my_data / first_time (default) | savingsBudget | savingsBudget |
| savings_decrease | savingsBudget - simulateAmount | Same |
| savings_increase | savingsBudget + simulateAmount | Same |
| no_match / no_hsa | savingsBudget (no change) | Same |

**Intent:** Identical.

---

## 6. Engine run

| Aspect | GitHub | Local |
|--------|--------|--------|
| Guard | `!budgetForProposedPlan \|\| budgetForProposedPlan <= 0 \|\| !baselineState.safetyStrategy` → null | `!savingsBudgetForEngine \|\| savingsBudgetForEngine <= 0` → null; strategy = `baselineState.safetyStrategy ?? { onIDR, liquidity, retirementFocus defaults }` |
| matchNeed$ / hsaRoomThisYear$ | Real values (match rec, HSA room) | Real values (always) |
| currentPlanForEngine | Same (no_match → 0 401k, unallocated→brokerage; no_hsa → 0 HSA) | Same |

**Intent:** Local allows engine to run when target is set but safetyStrategy is missing (defaults). Otherwise same; both pass real match/HSA need so 401k/HSA are allocated.

---

## 7. effectivePreTax

| Aspect | GitHub | Local |
|--------|--------|--------|
| Source | pretaxOverrides ?? engine (no payroll overlay) | pretaxOverrides ?? engine |
| derivedMatch | From k401 + calculateEmployerMatch | Same |

**Intent:** Same; no “payroll overlay” in either.

---

## 8. postTaxBudgetForRebalance

| Aspect | GitHub | Local |
|--------|--------|--------|
| Formula | `budgetForProposedPlan - effectivePreTax.k401Employee - effectivePreTax.hsa` | When target set: `effectiveProposedTarget - effectivePreTax.k401Employee - effectivePreTax.hsa`; else same as GitHub |

**Intent:** Same when no target; when target set, rebalance pool = target minus pre-tax so overrides stay within target.

---

## 9. proposedPlanSnapshot / useEngineForTarget

| Aspect | GitHub | Local |
|--------|--------|--------|
| Base | engineSnapshot ?? effectiveCurrentPlan, then withPretax (match, HSA from effectivePreTax) | Same + when `useEngineForTarget` (target set and engineSnapshot) return withPretax so 401k/match/HSA correct in table |

**Intent:** Local adds explicit use of engine + pretax when target set so Proposed column is correct.

---

## 10. displaySavingsBreakdown

| Aspect | GitHub | Local |
|--------|--------|--------|
| Args | income, payroll, monthlyNeeds, monthlyWants, baselinePlanData?.paycheckCategories | Same + `baselineState.safetyStrategy?.customSavingsAllocation` |

**Intent:** Local passes customSavingsAllocation so display reflects applied plan (Income tab consistency).

---

## 11. Intro message / totalMonthlySavingsForChat

| Aspect | GitHub | Local |
|--------|--------|--------|
| currentMonthly / proposedMonthly | effectiveSavingsBudget; proposedPlanSnapshot.monthlySavings ?? budgetForProposedPlan | totalMonthlySavingsForChat (current = payroll + post-tax; proposed = effectiveProposedTarget when set else post-tax + payroll); samePlan for “on track” |
| first_time | “I've designed a savings strategy…” | Same |
| VALIDATED | “Your savings plan is on track.” | Same when samePlan |

**Intent:** Local uses full current/proposed totals (including payroll) and “on track” when current ≈ proposed.

---

## Summary: Mode-by-mode engine budget

| Mode | GitHub engine gets | Local engine gets |
|------|--------------------|-------------------|
| first_time | Full budget (postTax \|\| baseline.monthlySavings) | Full budget; if no baselineSavingsData use postTaxSavingsAvailable |
| my_data, no target | Full budget | Full budget; if hasCustomAlloc use baselineSavingsData.monthlySavings for savingsBudget |
| my_data, target set | proposedSavingsFromHelper (e.g. 4500) | effectiveProposedTarget − employerMatch (so table = 4500) |
| no_match | Same budget | Same |
| no_hsa | Same budget | Same |
| savings_decrease | savingsBudget − simulateAmount | Same |
| savings_increase | savingsBudget + simulateAmount | Same |

---

## Consistency checklist

- [x] first_time: engine gets full user budget; match added on top for display (total = budget + match).
- [x] my_data no target: engine gets full budget; reopen after apply uses applied plan total so no false “target changed”.
- [x] my_data with target: engine gets (target − match) so proposed table sum = target.
- [x] no_match / no_hsa: same budget and payroll handling as GitHub.
- [x] savings_decrease / savings_increase: same effectiveSavingsBudget.
- [x] URL target + store: local adds urlTarget and syncs to store; GitHub only has store.
- [x] Engine run when safetyStrategy missing: local runs with defaults when target set; GitHub requires safetyStrategy.
- [x] displaySavingsBreakdown: local passes customSavingsAllocation for applied-plan display.

No missing behavior from GitHub; local keeps GitHub behavior and adds target-from-URL, “reopen after apply”, first_time fallback, and target-including-match fix.
