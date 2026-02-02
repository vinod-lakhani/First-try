# Debt Payment Unit Consistency Check Report

## Summary

Checked all files that handle debt minimum payments (`minPayment$`) for consistent conversion between per-paycheck and monthly amounts.

---

## Key Finding: Debt Payments Are Stored as Per-Paycheck

**Storage Format**: Debt `minPayment$` is stored as **per-paycheck** amounts in the state.

**Conversion Rule**: When calculating monthly amounts, must multiply by `paychecksPerMonth`.

---

## Files Checked and Status

### ✅ CORRECT (Converting to Monthly)

1. **`app/onboarding/monthly-plan-current/page.tsx`** (lines 69-72)
   ```typescript
   const totalDebtMinPayments = debts.reduce((sum, d) => sum + d.minPayment$, 0);
   const monthlyDebtMinPayments = totalDebtMinPayments * paychecksPerMonth;
   ```
   ✅ Correctly converts to monthly

2. **`app/onboarding/monthly-plan/page.tsx`** (lines 207-210)
   ```typescript
   const totalDebtMinPayments$ = debts.reduce((sum, d) => sum + d.minPayment$, 0);
   const monthlyDebtMinPayments = totalDebtMinPayments$ * paychecksPerMonth;
   ```
   ✅ Correctly converts to monthly

3. **`app/onboarding/monthly-plan-design/page.tsx`** (lines 49-51)
   ```typescript
   const totalDebtMinPayments = debts.reduce((sum, d) => sum + d.minPayment$, 0);
   needsTotal += totalDebtMinPayments * paychecksPerMonth;
   ```
   ✅ Correctly converts to monthly

4. **`app/app/tools/income-allocator/page.tsx`** (lines 121-124)
   ```typescript
   const debtMinPayments = debts.reduce((sum, d) => {
     const monthly = d.minPayment$ * getPaychecksPerMonth(income?.payFrequency || 'biweekly');
     return sum + monthly;
   }, 0);
   ```
   ✅ Correctly converts to monthly

5. **`app/app/components/FinancialSidekick.tsx`** (lines 148, 199)
   ```typescript
   return sum + (debt.minPayment$ * paychecksPerMonth);
   minPayment: debt.minPayment$ * paychecksPerMonth,
   ```
   ✅ Correctly converts to monthly

6. **`components/onboarding/OnboardingChat.tsx`** (lines 98, 149)
   ```typescript
   return sum + (debt.minPayment$ * paychecksPerMonth);
   minPayment: debt.minPayment$ * paychecksPerMonth,
   ```
   ✅ Correctly converts to monthly

7. **`lib/onboarding/plan.ts` - `calculateActualsFromExpenses()`** (lines 256-261) - **FIXED**
   ```typescript
   const monthlyDebtMinPayments = isIncomeMonthly 
     ? totalDebtMinPayments$
     : totalDebtMinPayments$ * paychecksPerMonth;
   ```
   ✅ Now correctly converts to monthly

---

### ✅ CORRECT (Per-Paycheck Context - No Conversion Needed)

1. **`app/onboarding/paycheck-plan/page.tsx`** (lines 154-161)
   ```typescript
   const totalDebtMinPayments$ = debts.reduce((sum, d) => sum + d.minPayment$, 0);
   amount: totalDebtMinPayments$,
   ```
   ✅ Correct - This page displays per-paycheck amounts, so no conversion needed

---

### ❌ BUG FOUND: `lib/onboarding/plan.ts` - `buildFinalPlanData()`

**Location**: Line 939  
**Issue**: `monthlyDebtMinimums` is assigned `totalDebtMinPayments$` without converting to monthly

**Current Code**:
```typescript
// Calculate total debt minimum payments before monthly conversions
const totalDebtMinPayments$ = debts.reduce((sum, d) => sum + d.minPayment$, 0);

// Convert to monthly for savings allocation (everything is monthly now)
const paychecksPerMonth = getPaychecksPerMonth(income.payFrequency || 'biweekly');
const monthlySavingsBudget = incomeAlloc.savings$ * paychecksPerMonth;
const monthlyNeedsTotal = incomeAlloc.needs$ * paychecksPerMonth;
const monthlyDebtMinimums = totalDebtMinPayments$;  // ❌ BUG: Not converting to monthly!
const monthlyEssentials = Math.max(0, monthlyNeedsTotal - monthlyDebtMinimums);
```

**Fix Needed**:
```typescript
const monthlyDebtMinimums = totalDebtMinPayments$ * paychecksPerMonth;  // ✅ FIXED
```

---

### ⚠️ NEEDS VERIFICATION

1. **`app/app/tools/monthly-pulse/page.tsx`** (line 89)
   ```typescript
   amount: debt.minPayment$,
   ```
   ⚠️ Need to check context - if displaying monthly, should convert

2. **`app/app/income/page.tsx`** (lines 104-110)
   ```typescript
   // Debts should have minPayment$ in monthly terms (single source of truth)
   minPayment$ should already be monthly (single source of truth)
   amount: debt.minPayment$, // minPayment$ should already be monthly
   ```
   ⚠️ Comment says it should be monthly, but contradicts our finding that it's per-paycheck

---

## Issues to Fix

### Issue 1: `buildFinalPlanData()` Debt Conversion

**File**: `lib/onboarding/plan.ts`  
**Line**: 939  
**Severity**: HIGH (affects savings allocation calculations)

**Fix**:
```typescript
const monthlyDebtMinimums = totalDebtMinPayments$ * paychecksPerMonth;
```

---

## Consistency Rules Established

1. **Storage**: Debt `minPayment$` is stored as **per-paycheck** amounts
2. **Monthly Calculations**: Always multiply by `paychecksPerMonth` when calculating monthly amounts
3. **Per-Paycheck Display**: If displaying per-paycheck amounts (like in `paycheck-plan/page.tsx`), use directly without conversion
4. **Comment Accuracy**: Comments should accurately reflect the actual storage format

---

## Next Steps

1. ✅ Fix `calculateActualsFromExpenses()` - **DONE**
2. ⏳ Fix `buildFinalPlanData()` - **TODO**
3. ⏳ Verify and fix `app/app/income/page.tsx` comments - **TODO**
4. ⏳ Verify `app/app/tools/monthly-pulse/page.tsx` - **TODO**

