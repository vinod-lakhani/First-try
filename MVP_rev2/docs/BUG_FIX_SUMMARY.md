# Bug Fix Summary: Debt Payment Unit Mismatch

## Problem Identified

**User's Concern**: "The confusing part is that actualSavings is higher than targetSavings, so then why increase it. I am concerned that we may be confusing monthly data and paycheck data, please verify"

**Root Cause**: There was a unit mismatch in `calculateActualsFromExpenses()` where debt minimum payments were being added without converting from per-paycheck to monthly amounts.

---

## The Bug

### Location
**File**: `lib/onboarding/plan.ts`  
**Function**: `calculateActualsFromExpenses()`  
**Lines**: 237-241 (before fix)

### Issue
Debt minimum payments are stored as **per-paycheck** amounts, but the code was treating them as if they were already **monthly**, causing:

1. **Incorrect actuals3m percentages**:
   - Needs percentage too low (debt payments undercounted)
   - Savings percentage too high (inflated because needs were too low)

2. **Wrong savings gap calculations**:
   - Engine compared wrong actual savings to targets
   - Could trigger shifts when they shouldn't, or miss shifts when they should

3. **Inconsistent calculations**:
   - `monthly-plan-design/page.tsx` correctly converts debt payments to monthly
   - `calculateActualsFromExpenses` did not
   - Results didn't match

---

## The Fix

### Changed Code (lines 237-262)

**Before**:
```typescript
// Add debt minimum payments to needs
if (debts && debts.length > 0) {
  const totalDebtMinPayments$ = debts.reduce((sum, d) => sum + d.minPayment$, 0);
  needsTotal += totalDebtMinPayments$;  // ❌ BUG: Not converting to monthly
}

// Determine if incomePeriod$ is monthly or per-paycheck
const isIncomeMonthly = incomePayFrequency === 'monthly';
// ... rest of conversion logic
```

**After**:
```typescript
// Determine if incomePeriod$ is monthly or per-paycheck FIRST
const isIncomeMonthly = incomePayFrequency === 'monthly';
let monthlyIncome: number;
let paychecksPerMonth: number;
if (isIncomeMonthly) {
  monthlyIncome = incomePeriod$;
  paychecksPerMonth = 1;
} else {
  paychecksPerMonth = getPaychecksPerMonth(incomePayFrequency || 'biweekly');
  monthlyIncome = incomePeriod$ * paychecksPerMonth;
}

// Add debt minimum payments to needs (AFTER determining paychecksPerMonth)
// Debt payments are stored as per-paycheck amounts, convert to monthly
if (debts && debts.length > 0) {
  const totalDebtMinPayments$ = debts.reduce((sum, d) => sum + d.minPayment$, 0);
  // Convert per-paycheck debt payments to monthly
  const monthlyDebtMinPayments = isIncomeMonthly 
    ? totalDebtMinPayments$  // If income is monthly, assume debt payments are also monthly
    : totalDebtMinPayments$ * paychecksPerMonth;  // ✅ FIXED: Convert per-paycheck to monthly
  needsTotal += monthlyDebtMinPayments;
}
```

### Key Changes

1. **Moved debt payment calculation** to AFTER determining `paychecksPerMonth`
2. **Added conversion** from per-paycheck to monthly amounts
3. **Handles monthly income case** (though rare, keeps logic correct)

---

## Impact

### Before Fix

**Example**:
- Debt minimum payments: $500 per paycheck (biweekly)
- Monthly debt payments should be: $500 × 2.17 = $1,085
- Code was using: $500 (incorrect)
- Needs undercounted by: $585
- Savings inflated by: $585

### After Fix

- Debt payments correctly converted: $500 × 2.17 = $1,085
- Needs calculated correctly
- Savings calculated correctly
- Actuals3m percentages match reality

---

## Verification

### Expected Results After Fix

1. **actuals3m percentages** should match current values in monthly-plan-design page
2. **Savings gap calculations** should be correct
3. **Engine recommendations** should align with actual spending patterns
4. **No more confusion** about why expenses decrease when savings is already high

### Testing Checklist

- [ ] Test with biweekly income and debt payments
- [ ] Test with weekly income and debt payments
- [ ] Test with monthly income (if supported)
- [ ] Verify actuals3m percentages match UI calculations
- [ ] Verify savings gap calculations are correct
- [ ] Check that engine recommendations make sense

---

## Related Files

- **Fixed**: `lib/onboarding/plan.ts` (lines 237-262)
- **Already correct**: `app/onboarding/monthly-plan-design/page.tsx` (lines 48-52)
- **Documentation**: `docs/BUG_DEBT_PAYMENT_UNIT_MISMATCH.md`

---

## Next Steps

1. **Test the fix** with real user data
2. **Verify** actuals3m calculations match UI
3. **Monitor** engine recommendations for correctness
4. **Consider** adding unit tests to prevent regression

