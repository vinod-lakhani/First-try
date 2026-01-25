# Savings Calculations - Centralized Approach

## Overview

All savings calculations across the application now use a **centralized calculation utility** located at `lib/utils/savingsCalculations.ts`. This ensures consistency across all pages and tools.

## Core Formula

The standardized calculation for **Cash Savings (Post-tax)** is:

```
baseSavingsMonthly = income - needs - wants
preTaxSavingsTotal = 401k + HSA contributions
taxSavingsMonthly = preTaxSavingsTotal * 0.25 (estimated marginal tax rate)
netPreTaxImpact = preTaxSavingsTotal - taxSavingsMonthly
cashSavingsMTD = max(0, baseSavingsMonthly - netPreTaxImpact)
```

**Total Savings** = Cash Savings + Payroll Savings + Employer Match

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

1. **Income Allocation Engine** calculates: `income - needs - wants = baseSavingsMonthly`
2. **Payroll Contributions** determine: `preTaxSavingsTotal` (401k + HSA)
3. **Tax Savings** calculated: `preTaxSavingsTotal * 0.25`
4. **Cash Savings** = `baseSavingsMonthly - (preTaxSavingsTotal - taxSavingsMonthly)`
5. **Total Savings** = `cashSavings + payrollSavings + employerMatch`

## Important Notes

- **Base Savings** should ALWAYS be calculated from `income - needs - wants`, NOT from `planData.paycheckCategories` when using custom allocation
- When `customSavingsAllocation` is used, the categories in `planData.paycheckCategories` already reflect post-tax amounts
- Always use the centralized function to ensure consistency

## Debugging

All pages log their calculations to the console with the prefix `[PageName] Savings Breakdown:` or `[PageName] Cash Savings Calculation:`. Check the browser console to verify calculations match across pages.
