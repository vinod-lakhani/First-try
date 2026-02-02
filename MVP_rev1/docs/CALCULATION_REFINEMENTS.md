# Calculation Refinements - Prompt Enhancement

## Overview

Refined the prompt to include explicit calculation formulas and verification steps to ensure precise numeric examples in LLM responses.

## Changes Made

### 1. Income Allocation Calculations ✅

**Added explicit formulas for:**
- Baseline calculation (3-month average actuals)
- Savings gap correction with step-by-step formula
- Total verification requirement

**Example Formula Added:**
```
Savings gap $ = target savings $ - actual savings $
Savings gap % = (savings gap $ / monthly income) × 100
Shift % = min(savings gap %, shift limit %)
Shift amount $ = monthly income × shift %
Final Wants $ = actual wants $ - shift amount $
Final Savings $ = actual savings $ + shift amount $
Always verify: Needs $ + Wants $ + Savings $ = monthly income (exactly)
```

**Example with Numbers:**
- Income $4,000, target savings $800 (20%), actual savings $680 (17%)
- Savings gap = $800 - $680 = $120 (3% of income)
- Shift limit = 4% = $160, so shift $120 (the gap, which is smaller)
- Final: Needs $2,320 (fixed), Wants $880 ($1,000 - $120), Savings $800 ($680 + $120)
- Total: $2,320 + $880 + $800 = $4,000 ✓

### 2. Income Change Calculations ✅

**Added explicit formulas for:**
- Recalculating targets as percentages of new income
- Understanding how actual spending percentages change

**Formula Added:**
```
New target Needs $ = new monthly income × target needs % (e.g., 0.50)
New target Wants $ = new monthly income × target wants % (e.g., 0.30)
New target Savings $ = new monthly income × target savings % (e.g., 0.20)
Actual spending percentages may change when calculated against new income
```

### 3. Savings Allocation Priority Stack ✅

**Added explicit formulas for:**

#### Step 1: Emergency Fund
```
EF gap $ = max(0, EF target $ - EF current $)
EF cap $ = savings budget $ × 0.40
EF allocation $ = min(EF gap $, EF cap $, remaining budget $)
```

#### Step 2: High-APR Debt
```
Remaining after EF = savings budget $ - EF allocation $
Debt cap $ = remaining after EF × 0.40
Total high-APR debt balance $ = sum of all debts with APR > 10%
Debt allocation $ = min(total high-APR debt balance $, debt cap $, remaining after EF $)
```

#### Step 5: Retirement vs Brokerage Split
```
Remaining after steps 1-4 = savings budget $ - EF $ - Debt $ - Match $
[retirementPct, brokeragePct] = getLiquidityRetirementSplit(liquidity, retirementFocus)
Retirement budget $ = remaining $ × retirementPct
Brokerage budget $ = remaining $ × brokeragePct
Verify: Retirement $ + Brokerage $ = remaining $ ✓
```

#### Step 6: Route Retirement Dollars
```
IRA limit = $7,000/year (under 50) or $8,000/year (50+)
IRA remaining room = IRA limit - IRA contributions YTD
401(k) limit = $23,000/year (under 50) or $30,500/year (50+)
401(k) remaining room = 401(k) limit - 401(k) contributions YTD (excluding match)

Route to IRA first: IRA allocation $ = min(retirement budget $, IRA remaining room $)
Remaining after IRA = retirement budget $ - IRA allocation $
Route to 401(k): 401(k) allocation $ = min(remaining after IRA $, 401(k) remaining room $)
Remaining after 401(k) = remaining after IRA $ - 401(k) allocation $
Spill to brokerage: brokerage from retirement $ = remaining after 401(k) $

Verify: IRA $ + 401(k) $ + Spill $ = retirement budget $ ✓
```

### 4. Negative Savings Handling ✅

**Added explicit guidance for:**
- Identifying spending deficit
- Calculating required reductions
- Prioritizing expense cuts

**Formula Added:**
```
Deficit $ = monthly income - (needs $ + wants $)
Target: Reduce Wants to minimum until deficit eliminated
Priority: Start with Wants (discretionary) before Needs
```

**Example:**
- Income $3,000, Needs $1,800, Wants $1,500 → Deficit $300
- Current: Total spending $3,300 > Income $3,000 (deficit $300)
- Target: Reduce Wants from $1,500 to $1,200 (deficit eliminated)
- Result: Needs $1,800, Wants $1,200, Savings $0 (break-even)

### 5. Critical Calculation Rules ✅

**Added to Answer Instructions:**
- Always show your work: Break down calculations step-by-step
- Verify totals: Income allocations must sum to monthly income exactly
- Verify totals: Savings allocations must sum to savings budget exactly
- Use actual numbers from user data, not approximations
- Show both percentages and dollar amounts

**Example Formats Added:**
- Income allocation: "Needs $2,320 (fixed), Wants $880 (reduced by $120 shift), Savings $800 (increased by $120). Total: $4,000 ✓"
- Savings allocation: "EF $2,000 + Debt $1,200 + Retirement $1,260 + Brokerage $540 = $5,000 ✓"

## Expected Improvements

### Before Refinements:
- Calculations sometimes had inconsistencies
- Final totals didn't always add up correctly
- Some examples used approximations

### After Refinements:
- ✅ Explicit step-by-step formulas for all calculations
- ✅ Verification requirements (totals must sum exactly)
- ✅ Concrete examples with actual numbers
- ✅ Clear format guidelines for showing calculations

## Testing Recommendations

Test the refined prompt with the same scenarios to verify:
1. **Calculation Precision**: Final numbers add up correctly
2. **Step-by-Step Clarity**: Calculations are shown transparently
3. **Verification**: LLM includes verification steps (totals sum correctly)

## Files Modified

- `app/api/chat/route.ts` - Enhanced prompt with calculation formulas

## Next Steps

1. ✅ Calculation formulas added
2. ⏳ Re-test scenarios to verify improved precision
3. ⏳ Monitor user interactions for calculation clarity

---

**Status**: ✅ Refinements complete. Ready for testing.

