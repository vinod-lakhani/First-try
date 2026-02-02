# BUG: Debt Payment Unit Mismatch - Monthly vs Per-Paycheck

## The Problem

**There's a unit mismatch in how debt minimum payments are handled**, causing incorrect actuals3m percentages to be calculated, which leads to incorrect savings gap calculations.

---

## The Bug

### In `calculateActualsFromExpenses()` (lib/onboarding/plan.ts, lines 237-241)

```typescript
// Add debt minimum payments to needs
if (debts && debts.length > 0) {
  const totalDebtMinPayments$ = debts.reduce((sum, d) => sum + d.minPayment$, 0);
  needsTotal += totalDebtMinPayments$;  // ❌ BUG: Not converting to monthly!
}
```

**Problem**: Debt minimum payments are stored as **per-paycheck** amounts, but this code treats them as if they're already **monthly**.

### In `monthly-plan-design/page.tsx` (lines 48-52)

```typescript
// Add debt minimum payments to needs
const totalDebtMinPayments = debts.reduce((sum, d) => sum + d.minPayment$, 0);
if (totalDebtMinPayments > 0.01) {
  needsTotal += totalDebtMinPayments * paychecksPerMonth;  // ✅ CORRECT: Converts to monthly
}
```

**Correct**: This correctly multiplies by `paychecksPerMonth` to convert per-paycheck to monthly.

---

## Impact

### Example Scenario

**User has:**
- Income: $4,000 per paycheck (biweekly)
- Monthly income: $8,680 ($4,000 × 2.17)
- Debt minimum payments: $500 per paycheck
- Monthly debt payments: $1,085 ($500 × 2.17)

### Current (Buggy) Calculation in `calculateActualsFromExpenses`

```typescript
// Wrong: Treats $500 as monthly instead of per-paycheck
needsTotal += $500;  // Should be $1,085!

// Result:
// - Needs are $585 too low
// - Savings are $585 too high
// - actualSavingsPct appears higher than reality
```

### Correct Calculation (as done in monthly-plan-design/page.tsx)

```typescript
// Correct: Converts per-paycheck to monthly
needsTotal += $500 * 2.17 = $1,085;
```

---

## Why This Causes the Issue

### The Flow

1. **`calculateActualsFromExpenses`** calculates `actuals3m` percentages incorrectly:
   - Needs: Too low (missing $585 in this example)
   - Savings: Too high (inflated by $585)

2. **Income Allocation Engine** receives wrong actuals3m:
   - Sees savings percentage as HIGHER than it actually is
   - But the engine only shifts if savings is BELOW target
   - However, the percentages don't sum correctly, causing normalization issues

3. **Monthly Plan Design Page** calculates current values correctly:
   - Uses correct monthly debt payments
   - Shows different numbers than what engine calculated

### Result

- **Actual savings appears HIGHER than reality** (because debt payments weren't fully counted)
- **Engine might calculate savings gap incorrectly**
- **Recommended plan might be based on wrong baseline**

---

## The Fix

### Option 1: Fix `calculateActualsFromExpenses` (Recommended)

**File**: `lib/onboarding/plan.ts` lines 237-241

**Current (Buggy)**:
```typescript
// Add debt minimum payments to needs
if (debts && debts.length > 0) {
  const totalDebtMinPayments$ = debts.reduce((sum, d) => sum + d.minPayment$, 0);
  needsTotal += totalDebtMinPayments$;
}
```

**Fixed**:
```typescript
// Add debt minimum payments to needs
if (debts && debts.length > 0) {
  const totalDebtMinPayments$ = debts.reduce((sum, d) => sum + d.minPayment$, 0);
  // Debt payments are per-paycheck, convert to monthly
  if (!isIncomeMonthly) {
    const paychecksPerMonth = getPaychecksPerMonth(incomePayFrequency || 'biweekly');
    needsTotal += totalDebtMinPayments$ * paychecksPerMonth;
  } else {
    // Income is monthly, debt payments should already be monthly
    needsTotal += totalDebtMinPayments$;
  }
}
```

**OR simpler** (if debt payments are always per-paycheck):
```typescript
// Add debt minimum payments to needs
if (debts && debts.length > 0) {
  const totalDebtMinPayments$ = debts.reduce((sum, d) => sum + d.minPayment$, 0);
  // Debt payments are stored as per-paycheck, convert to monthly
  if (!isIncomeMonthly) {
    needsTotal += totalDebtMinPayments$ * paychecksPerMonth;  // Already calculated above
  } else {
    // If income is monthly, debt payments might be monthly too
    // Need to verify how debts are stored in this case
    needsTotal += totalDebtMinPayments$;
  }
}
```

### Option 2: Verify How Debt Payments Are Stored

**Need to check**: Are debt minimum payments ALWAYS stored as per-paycheck, or can they be monthly?

**Check**:
- How debts are added/edited in the UI
- How Plaid data stores debt payments
- Whether there's a frequency field on debts

---

## Verification Steps

1. **Add logging** to see what's being calculated:

```typescript
console.log('[calculateActualsFromExpenses] Debt payments:', {
  totalDebtMinPayments$,
  isIncomeMonthly,
  paychecksPerMonth,
  monthlyDebtPayments: isIncomeMonthly ? totalDebtMinPayments$ : totalDebtMinPayments$ * paychecksPerMonth,
  needsTotalBefore: needsTotal,
  needsTotalAfter: needsTotal + (isIncomeMonthly ? totalDebtMinPayments$ : totalDebtMinPayments$ * paychecksPerMonth),
});
```

2. **Compare** actuals3m percentages to current values in monthly-plan-design page
3. **Verify** they match after the fix

---

## Related Code Locations

- **Bug location**: `lib/onboarding/plan.ts` lines 237-241
- **Correct implementation**: `app/onboarding/monthly-plan-design/page.tsx` lines 48-52
- **Other locations using debt payments**:
  - `app/onboarding/monthly-plan-current/page.tsx` lines 66-78 (correct)
  - `app/app/tools/income-allocator/page.tsx` lines 120-124 (correct)
  - `app/onboarding/monthly-plan/page.tsx` lines 206-217 (correct)

---

## Summary

**The bug**: `calculateActualsFromExpenses` doesn't convert debt minimum payments from per-paycheck to monthly, causing:
- Incorrect actuals3m percentages
- Wrong savings gap calculations
- Potentially incorrect recommended plans

**The fix**: Convert debt payments to monthly before adding to needsTotal, matching the pattern used in other parts of the codebase.

