# Trace: Where does $3,461 come from in Savings Allocator?

## Display path

The intro message shows:
> "Your monthly savings target has changed from **$3,581** to **$3,461**"

- **$3,581** = `totalCurrent` (correct)
- **$3,461** = `totalProposed` (wrong; should be $4,000)

## Data flow for totalProposed

### 1. Intro message (line ~1286)
```tsx
const proposedMonthly = totals ? Math.round(totals.totalProposed) : ...
```
Uses `totalMonthlySavingsForChat.totalProposed`

### 2. totalProposed formula (lines 1245–1250)
```tsx
const totalProposed =
  effectivePreTax.k401Employee +      // ~$339 (401k)
  effectivePreTax.derivedMatch +      // ~$169 (employer match)
  (proposedPlanSnapshot.hsa$ ?? 0) +  // ~$200 (HSA)
  employerHsa +                       // ~$0
  proposedPlanSnapshot.monthlySavings; // POST-TAX (ef + debt + roth + brokerage)
```

If totalProposed = **$3,461**, then:
- pre-tax = 339 + 169 + 200 = **$708**
- **proposedPlanSnapshot.monthlySavings = $3,461 − $708 = $2,753** (post-tax)

### 3. proposedPlanSnapshot.monthlySavings (lines 1056–1070)
```tsx
const proposedPlanSnapshot = useMemo(() => {
  const baseForOverrides = engineSnapshot ?? effectiveCurrentPlan;
  if (hasOverrides) return applyOverridesAndRebalance(...);
  if (hasPretaxOverrides) return trimPostTaxToPool(...);
  return baseForOverrides;  // ← Returns engineSnapshot when engine ran
}, [...]);
```

So `proposedPlanSnapshot.monthlySavings` = **engineSnapshot.monthlySavings**

### 4. engineSnapshot.monthlySavings (lines 1006–1015)
```tsx
const postTaxTotal = allocation.ef$ + allocation.highAprDebt$ + allocation.retirementTaxAdv$ + allocation.brokerage$;
return {
  ...
  snapshot: {
    ...
    monthlySavings: postTaxTotal,  // ← Engine's post-tax allocation
  },
};
```

Engine allocates `savingsBudgetForEngine` across post-tax categories.  
So **engineSnapshot.monthlySavings = savingsBudgetForEngine** (what we passed in).

### 5. savingsBudgetForEngine (lines 846–852)
```tsx
const savingsBudgetForEngine = useMemo(() => {
  if (effectiveProposedTarget != null && effectiveProposedTarget > 0) {
    return Math.max(0, effectiveProposedTarget - preTaxTotalFromPlan);
    // When target=4000, preTax=708 → returns 3292 ✓
  }
  return budgetForProposedPlan ?? 0;  // ← When effectiveProposedTarget is null!
}, [effectiveProposedTarget, preTaxTotalFromPlan, budgetForProposedPlan]);
```

When **effectiveProposedTarget is null**, falls back to **budgetForProposedPlan**.

### 6. budgetForProposedPlan (lines 832–835)
```tsx
const budgetForProposedPlan = useMemo(() => {
  if (effectiveProposedTarget != null && effectiveProposedTarget > 0) return effectiveProposedTarget;
  return effectiveSavingsBudget;  // ← Uses current post-tax budget (~$2,753)
}, [effectiveProposedTarget, effectiveSavingsBudget]);
```

### 7. effectiveSavingsBudget (lines 821–829)
```tsx
const effectiveSavingsBudget = useMemo(() => {
  if (allocatorScenario === 'savings_decrease') return savingsBudget - simulateAmount;
  if (allocatorScenario === 'savings_increase') return savingsBudget + simulateAmount;
  return savingsBudget;  // = postTaxSavingsAvailable || baselineSavingsData.monthlySavings
}, [...]);
```

### 8. effectiveProposedTarget (lines 796–801)
```tsx
const effectiveProposedTarget = useMemo(() => {
  const fromUrl = urlTarget != null && urlTarget !== '' ? Number(urlTarget) : NaN;
  if (!Number.isNaN(fromUrl) && fromUrl > 0) return fromUrl;  // Should return 4000 when ?target=4000
  return proposedSavingsFromHelper ?? null;
}, [urlTarget, proposedSavingsFromHelper]);
```

---

## Root cause

**effectiveProposedTarget is null** when the engine runs, so:

1. `savingsBudgetForEngine` = `budgetForProposedPlan` = `effectiveSavingsBudget` ≈ **$2,753** (post-tax)
2. Engine allocates **$2,753** to post-tax
3. **totalProposed** = 2,753 + 708 = **$3,461**

## Why is effectiveProposedTarget null?

- **urlTarget** comes from `searchParams?.get('target')` (line ~100)
- If `useSearchParams()` returns empty/stale params on first render (e.g. during hydration or before client-side navigation finishes), `urlTarget` is undefined
- **proposedSavingsFromHelper** may also be null if:
  - Store hasn’t been updated yet
  - URL sync `useEffect` runs after the first engine run

## Possible fixes

1. **Ensure engine runs after URL is available** – e.g. add a short delay or wait for `urlTarget` before running the engine when `source=sidekick`
2. **Force re-run when urlTarget appears** – ensure `effectiveProposedTarget` (and thus `savingsBudgetForEngine`) updates when `urlTarget` becomes available
3. **Use a key to remount** – give the engine/allocator content a key that includes `urlTarget` so it remounts when the target changes
