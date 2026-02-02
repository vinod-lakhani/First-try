# Savings Calculations - Centralized Approach

## Overview

All savings calculations across the application now use a **centralized calculation utility** located at `lib/utils/savingsCalculations.ts`. This ensures consistency across all pages and tools.

## Core Formula

**Pre-tax vs Post-tax (source of truth):**
- **Cash (post-tax)** = EF + Debt extra + Roth + Brokerage — from take-home
- **Payroll (pre-tax)** = 401k employee + HSA — from gross, before taxes
- **HSA is NOT cash** — it is payroll (pre-tax)

When plan has custom allocation, use plan amounts. Otherwise:

- **NET income** (take-home): cash = net - needs - wants (401k/HSA already out of net)
- **GROSS only**: cash = (gross - needs - wants) - netPreTaxImpact

**Total Savings** = Cash + Payroll + Employer 401K Match + Employer HSA

## Usage

### Import the function

```typescript
import { calculateSavingsBreakdown } from '@/lib/utils/savingsCalculations';
```

### Calculate savings breakdown

```typescript
const savingsBreakdown = calculateSavingsBreakdown(
  income,           // IncomeState from store
  payrollContributions, // PayrollContributions from store
  monthlyNeeds,     // Sum of needs categories (essentials + debt_minimums)
  monthlyWants       // Sum of wants categories (fun_flexible)
);

// Access results:
const cashSavings = savingsBreakdown.cashSavingsMTD;
const payrollSavings = savingsBreakdown.payrollSavingsMTD;
const employerMatch = savingsBreakdown.employerMatchMTD;
const totalSavings = savingsBreakdown.totalSavingsMTD;
```

## Pages Using Centralized Calculation

✅ **Updated Pages:**
- `/app/app/income/page.tsx` - Income tab
- `/app/app/tools/monthly-pulse/page.tsx` - Monthly Pulse page
- `/components/home/HomeScreen.tsx` - Home screen Monthly Pulse card
- `/app/onboarding/plan-final/page.tsx` - Plan Final page

⚠️ **Pages Still Using Custom Logic (may need updates):**
- `/app/app/tools/income-allocator/page.tsx` - Uses custom logic for "what-if" scenarios
- `/app/app/tools/savings-helper/page.tsx` - Uses custom logic for comparisons
- `/app/app/tools/savings-allocator/page.tsx` - Uses custom logic for allocation tool

## Testing

Run the comprehensive test suite:

```bash
npm run test:savings
```

This validates:
- Base savings calculation
- Cash savings with/without pre-tax contributions
- Payroll savings calculation
- Employer match calculation
- Total savings calculation
- Formula consistency

## Data Flow

1. **Plan is source of truth** when custom allocation exists: Cash = EF + Debt + Roth + Brokerage (excludes 401k/HSA)
2. **Payroll (pre-tax)** = 401k employee + HSA from plan or payroll form
3. **Employer match** = derived via `calculateEmployerMatch()` using GROSS income
4. **Total Savings** = Cash + Payroll + Employer Match + Employer HSA

## Important Notes

- **Base Savings** should ALWAYS be calculated from `income - needs - wants`, NOT from `planData.paycheckCategories` when using custom allocation
- When `customSavingsAllocation` is used, the categories in `planData.paycheckCategories` already reflect post-tax amounts
- Always use the centralized function to ensure consistency

## Debugging

All pages log their calculations to the console with the prefix `[PageName] Savings Breakdown:` or `[PageName] Cash Savings Calculation:`. Check the browser console to verify calculations match across pages.
