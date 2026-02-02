# Debt Payment Consistency Fixes - Summary

## Overview

Checked and fixed all inconsistencies in how debt minimum payments (`minPayment$`) are converted between per-paycheck and monthly amounts throughout the codebase.

---

## Key Finding

**Debt `minPayment$` is stored as per-paycheck amounts** and must be converted to monthly by multiplying by `paychecksPerMonth` when calculating monthly values.

---

## Fixes Applied

### ✅ Fix 1: `lib/onboarding/plan.ts` - `calculateActualsFromExpenses()`

**Issue**: Debt payments were added without converting from per-paycheck to monthly.

**Location**: Lines 237-262

**Fix**: Moved debt payment calculation to AFTER determining `paychecksPerMonth` and added conversion.

```typescript
// Convert per-paycheck debt payments to monthly
const monthlyDebtMinPayments = isIncomeMonthly 
  ? totalDebtMinPayments$  
  : totalDebtMinPayments$ * paychecksPerMonth;
needsTotal += monthlyDebtMinPayments;
```

**Impact**: Fixes incorrect actuals3m percentages, which were causing wrong savings gap calculations.

---

### ✅ Fix 2: `lib/onboarding/plan.ts` - `buildFinalPlanData()`

**Issue**: `monthlyDebtMinimums` was assigned per-paycheck value without conversion.

**Location**: Line 940

**Fix**: Added conversion to monthly:

```typescript
// Convert debt minimum payments from per-paycheck to monthly
const monthlyDebtMinimums = totalDebtMinPayments$ * paychecksPerMonth;
```

**Impact**: Fixes savings allocation calculations that depend on accurate monthly debt minimums.

---

### ✅ Fix 3: `app/app/income/page.tsx`

**Issue**: Debt payments displayed directly without conversion, but page shows monthly amounts.

**Location**: Lines 104-111

**Fix**: Added conversion to monthly and corrected comment:

```typescript
// Debt minPayment$ is stored as per-paycheck, convert to monthly
state.debts.forEach(debt => {
  const monthlyDebtPayment = debt.minPayment$ * paychecksPerMonth;
  needsList.push({
    label: debt.name,
    amount: monthlyDebtPayment,
  });
});
```

**Impact**: Fixes incorrect debt payment display on Income page.

---

### ✅ Fix 4: `app/app/tools/monthly-pulse/page.tsx`

**Issue**: Debt payments displayed directly without conversion, but page shows monthly amounts.

**Location**: Lines 85-91

**Fix**: Added conversion to monthly:

```typescript
// Debt minPayment$ is stored as per-paycheck, convert to monthly
state.debts.forEach(debt => {
  const monthlyDebtPayment = debt.minPayment$ * paychecksPerMonth;
  needsList.push({
    label: debt.name,
    amount: monthlyDebtPayment,
  });
});
```

**Impact**: Fixes incorrect debt payment display on Monthly Pulse page.

---

## Files Already Correct

These files were already handling debt payments correctly:

1. ✅ `app/onboarding/monthly-plan-current/page.tsx` - Correctly converts to monthly
2. ✅ `app/onboarding/monthly-plan/page.tsx` - Correctly converts to monthly
3. ✅ `app/onboarding/monthly-plan-design/page.tsx` - Correctly converts to monthly
4. ✅ `app/app/tools/income-allocator/page.tsx` - Correctly converts to monthly
5. ✅ `app/app/components/FinancialSidekick.tsx` - Correctly converts to monthly
6. ✅ `components/onboarding/OnboardingChat.tsx` - Correctly converts to monthly
7. ✅ `app/onboarding/paycheck-plan/page.tsx` - Correctly shows per-paycheck (no conversion needed)

---

## Consistency Rule Established

**Standard Practice**: 
- Debt `minPayment$` is stored as **per-paycheck** amounts
- When calculating/displaying **monthly** amounts, always multiply by `paychecksPerMonth`
- When displaying **per-paycheck** amounts (like in paycheck-plan page), use directly

---

## Testing Recommendations

1. **Test actuals3m calculation**: Verify percentages match UI calculations
2. **Test savings allocation**: Verify monthly debt minimums are correct
3. **Test Income page**: Verify debt payments display correctly as monthly
4. **Test Monthly Pulse page**: Verify debt payments display correctly as monthly
5. **Compare across pages**: Ensure debt payments are consistent across all pages

---

## Related Documentation

- `docs/BUG_DEBT_PAYMENT_UNIT_MISMATCH.md` - Detailed bug analysis
- `docs/BUG_FIX_SUMMARY.md` - Initial bug fix summary
- `docs/CONSISTENCY_CHECK_REPORT.md` - Comprehensive consistency check

---

## Status

✅ **All consistency issues fixed**  
✅ **No linter errors**  
✅ **Ready for testing**

