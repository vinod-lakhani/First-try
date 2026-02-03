# Monthly Plan Design - Savings Increase Logic Walkthrough

## Overview

This document explains the logic behind how the Monthly Plan Design screen calculates and displays savings increases when expenses are reduced.

---

## Screen Layout (Based on Image)

The screen shows two columns: **Current** (actual spending) and **Plan** (recommended/editable):

```
┌─────────────────────────────────────┐
│ Current                             │
│ Income:    $8,680.00                │
│ Expenses:  $5,268.00                │
│ Savings:   $3,412.00                │
├─────────────────────────────────────┤
│ Plan                                 │
│ Income:    $8,680.00                │
│ Expenses:  $4,800.00  ← REDUCED     │
│ Savings:   $3,880.00  ← INCREASED   │
└─────────────────────────────────────┘
```

**Key Change**: Expenses decreased by **$468** ($5,268 → $4,800), Savings increased by **$468** ($3,412 → $3,880)

---

## How Values Are Calculated

### 1. **Current Values** (From Actual Spending)

**File**: `app/onboarding/monthly-plan-design/page.tsx` (lines 24-59)

#### Current Income
```typescript
currentIncome = incomeAmount × paychecksPerMonth
```
- Uses `netIncome$` or `grossIncome$` from store
- Converts to monthly based on pay frequency (weekly, biweekly, semimonthly, monthly)
- **Example**: If biweekly pay is $4,000, monthly = $4,000 × 2.17 = $8,680

#### Current Needs
```typescript
currentNeeds = sum(all needs expenses) + debt minimum payments
```
- Sums all `fixedExpenses` where `category === 'needs'` or no category
- Converts each expense to monthly based on frequency
- Adds debt minimum payments (converted to monthly)

#### Current Wants
```typescript
currentWants = sum(all wants expenses)
```
- Sums all `fixedExpenses` where `category === 'wants'`
- Converts each expense to monthly based on frequency

#### Current Savings
```typescript
currentSavings = currentIncome - (currentNeeds + currentWants)
```
- Automatically calculated as what's left after expenses
- **Example**: $8,680 - ($X needs + $Y wants) = $3,412

---

### 2. **Recommended Plan Values** (From Income Allocation Engine)

**File**: `lib/onboarding/plan.ts` → `generateInitialPaycheckPlanFromEngines()`

The recommended plan is calculated using the **Income Allocation Engine** which applies business logic:

#### Step 1: Get 3-Month Average Actuals
- Calculated from `riskConstraints.actuals3m` (if available)
- OR calculated from `fixedExpenses` and `debts` if no actuals exist
- Represents smoothed spending patterns (not single-month spikes)

#### Step 2: Get Target Percentages
- Default: 50% Needs, 30% Wants, 20% Savings
- OR custom targets from `riskConstraints.targets`
- OR based on `primaryGoal` (different targets for different goals)

#### Step 3: Apply Income Allocation Logic

**File**: `lib/alloc/income.ts` → `allocateIncome()`

The engine follows these rules:

1. **Start from 3-month actuals as baseline**
   - Needs: Keep at actual level (fixed short-term)
   - Wants: Start at actual level
   - Savings: Start at actual level

2. **Calculate Savings Gap**
   ```typescript
   savingsGap$ = targetSavings$ - actualSavings$
   savingsGap% = (savingsGap$ / monthlyIncome) × 100
   ```

3. **Shift from Wants → Savings (if gap exists)**
   ```typescript
   shiftLimit% = 4% (default, prevents drastic changes)
   shift% = min(savingsGap%, shiftLimit%)
   shiftAmount$ = monthlyIncome × shift%
   
   finalWants$ = actualWants$ - shiftAmount$
   finalSavings$ = actualSavings$ + shiftAmount$
   ```

4. **Keep Needs Fixed**
   - Needs stay at actual level (can't reduce immediately)
   - This is why expenses can decrease (Wants reduction) but Needs stay the same

#### Step 4: Convert to Monthly Values
```typescript
recommendedNeeds = engine.needs$ × paychecksPerMonth
recommendedWants = engine.wants$ × paychecksPerMonth
recommendedSavings = engine.savings$ × paychecksPerMonth
```

#### Step 5: Calculate Recommended Expenses
```typescript
recommendedExpenses = recommendedNeeds + recommendedWants
```

---

### 3. **Plan Savings Calculation** (Auto-Calculated in Component)

**File**: `components/monthly-plan/MonthlyPlanDesign.tsx` (lines 48-52)

```typescript
// Derived values - calculated in real-time
const expenses = needs + wants;  // Plan expenses
const savings = income - expenses;  // Plan savings (AUTO-CALCULATED)
```

**Key Logic**: 
- **Savings is NOT a slider** - it's automatically calculated
- As user adjusts Income, Needs, or Wants sliders, Savings updates automatically
- Formula: `Savings = Income - (Needs + Wants)`

---

## How Savings Increases (Based on Your Image)

### Example from Image:
- **Current**: Income $8,680, Expenses $5,268, Savings $3,412
- **Plan**: Income $8,680, Expenses $4,800, Savings $3,880

### What Happened:

1. **Engine Calculated Recommended Plan**:
   - Needs: Likely stayed similar to current (fixed short-term)
   - Wants: Reduced from actuals (shift applied)
   - Result: Expenses reduced, Savings increased

2. **Expense Reduction Breakdown**:
   ```
   Current Expenses: $5,268
   Plan Expenses:    $4,800
   Reduction:        $468
   
   This $468 reduction comes from:
   - Wants reduction (shift from Wants → Savings)
   - Possibly some Needs reduction if recommended by engine
   ```

3. **Savings Increase**:
   ```
   Plan Savings = Income - Plan Expenses
   $3,880 = $8,680 - $4,800
   
   Increase = $3,880 - $3,412 = $468
   ```

**The $468 increase in savings = The $468 decrease in expenses** ✓

---

## User Interactions (How Savings Can Increase)

Users can adjust three sliders that affect savings:

### 1. **Income Slider** (Increase Income → Increase Savings)
```
Current: Income $8,680
User increases to: $9,000
Result: Savings increases by $320 (if expenses unchanged)
```

**Logic**:
- When income increases, needs and wants can stay the same
- Savings = Income - Expenses
- More income → More savings (assuming expenses unchanged)

**Code**: `handleIncomeChange()` (lines 77-87)
- If needs + wants would exceed new income, they scale down proportionally
- Otherwise, they stay the same, and savings increases

### 2. **Needs Slider** (Decrease Needs → Increase Savings)
```
Current: Needs $X
User decreases to: $X - $200
Result: Savings increases by $200
```

**Logic**:
- Reducing needs directly reduces expenses
- Savings = Income - Expenses
- Less expenses → More savings

**Code**: `handleNeedsChange()` (lines 89-92)
- Ensures needs + wants <= income
- Savings automatically recalculates

### 3. **Wants Slider** (Decrease Wants → Increase Savings)
```
Current: Wants $Y
User decreases to: $Y - $300
Result: Savings increases by $300
```

**Logic**:
- Reducing wants directly reduces expenses
- Savings = Income - Expenses
- Less expenses → More savings

**Code**: `handleWantsChange()` (lines 94-97)
- Ensures needs + wants <= income
- Savings automatically recalculates

---

## Mathematical Relationship

### The Core Formula

```
Savings = Income - Expenses
        = Income - (Needs + Wants)
```

### Changes in Savings

```
ΔSavings = -ΔExpenses
         = -(ΔNeeds + ΔWants)
```

**Key Insight**: 
- To increase savings, you must decrease expenses (needs or wants)
- OR increase income
- Savings change is the opposite of expense change

### Example Calculation

**Before**:
- Income: $8,680
- Needs: $4,000, Wants: $1,268
- Expenses: $5,268
- Savings: $3,412

**After (Plan)**:
- Income: $8,680 (unchanged)
- Needs: $4,000 (fixed), Wants: $800 (reduced by $468)
- Expenses: $4,800 (reduced by $468)
- Savings: $3,880 (increased by $468)

**Verification**:
- Expenses change: $5,268 - $4,800 = -$468
- Savings change: $3,880 - $3,412 = +$468
- Relationship: -(-$468) = +$468 ✓

---

## Recommended Plan Logic (Why Expenses Decrease)

The income allocation engine recommends reducing expenses to increase savings:

### Scenario from Image

**Assumptions** (based on typical logic):
- Current actuals: Needs ~60.7%, Wants ~14.6%, Savings ~39.3%
- Target: Needs 50%, Wants 30%, Savings 20%

**Engine Logic**:
1. **Needs**: Keep at actual level (fixed) = ~$5,268 (if all expenses were needs)
   - Actually, needs likely ~$4,000-$4,500
2. **Wants**: Start at actual, but shift some to savings
   - If actual wants = $1,268, shift ~$468 to savings (within shift limit)
3. **Result**: 
   - Needs: Stays same (fixed)
   - Wants: Reduced to ~$800
   - Expenses: Reduced by $468
   - Savings: Increased by $468

### Why the Recommendation?

The engine identifies:
- ✅ Savings is below target (or can be improved)
- ✅ Wants can be reduced without drastic lifestyle change
- ✅ Shift limit protects user from too-aggressive changes

**The recommended plan suggests**: "You can reduce expenses by $468/month (mainly from wants) to increase savings by $468/month."

---

## Component State Flow

### Initial State (Component Loads)

```typescript
// From props (calculated in page.tsx)
currentIncome = $8,680
currentNeeds = calculated from expenses
currentWants = calculated from expenses

// Recommended values (from engine)
recommendedNeeds = engine result × paychecksPerMonth
recommendedWants = engine result × paychecksPerMonth
recommendedIncome = currentIncome (same)

// Component state (initialized from recommended)
income = recommendedIncome ?? currentIncome  // $8,680
needs = recommendedNeeds ?? currentNeeds      // $4,800 (estimated)
wants = recommendedWants ?? currentWants      // $800 (estimated)
```

### Derived Values (Auto-Calculated)

```typescript
expenses = needs + wants           // $4,800 + $800 = $5,600 (if this were the case)
savings = income - expenses        // $8,680 - $5,600 = $3,080

// Actually, based on image:
expenses = needs + wants = $4,800
savings = $8,680 - $4,800 = $3,880
```

### When User Adjusts Sliders

**Example: User reduces Wants by $100**

```typescript
// User moves Wants slider down
wants = $800 - $100 = $700

// Auto-recalculated:
expenses = needs + wants = $4,800 + $700 = $5,500
savings = income - expenses = $8,680 - $5,500 = $3,180

// Wait, this doesn't match image. Let me recalculate...

// Based on image:
expenses = $4,800
If expenses = needs + wants, then:
needs + wants = $4,800

// If needs stayed same (~$4,268 from $5,268 - $1,000 wants):
needs = $4,268 (estimated)
wants = $532 (estimated, from $4,800 - $4,268)
savings = $8,680 - $4,800 = $3,880 ✓
```

---

## Key Constraints

### 1. **Needs Stay Fixed (Short-Term)**
- Needs can't be reduced immediately (rent, utilities, etc. are fixed)
- Engine keeps needs at actual level
- User can still adjust needs slider, but engine recommendation keeps them fixed

### 2. **Shift Limit Protection**
- Default shift limit: 3-5% of income
- Prevents aggressive expense reductions
- Protects user from drastic lifestyle changes

### 3. **Total Must Equal Income**
```
Income = Needs + Wants + Savings (always)
```
- Component enforces: `needs + wants <= income`
- If user tries to exceed, values are capped
- Savings automatically fills the gap

---

## Visual Indicators

The component shows:

1. **Current vs Plan Comparison**
   - Side-by-side display
   - Shows exactly what changes

2. **Savings Highlight**
   - Green text when savings > current savings
   - Shows difference: "+$468 vs your current savings"

3. **Reference Markers**
   - "Current" dashed line on sliders
   - Shows where current values are

4. **Auto-Calculated Savings Card**
   - Not editable (no slider)
   - Updates in real-time as other sliders change

---

## Summary

### How Savings Increases:

1. **Automatic Calculation**: Savings = Income - (Needs + Wants)
2. **Three Ways to Increase**:
   - ✅ Increase Income (slider)
   - ✅ Decrease Needs (slider)
   - ✅ Decrease Wants (slider)

3. **Recommended Plan Logic**:
   - Engine suggests reducing Wants (within shift limit)
   - Keeps Needs fixed (short-term immutability)
   - Result: Lower expenses = Higher savings

4. **Real-Time Updates**:
   - As user adjusts sliders, savings recalculates instantly
   - Always maintains: Income = Needs + Wants + Savings

### Example from Your Image:

```
Current:  $8,680 = $X needs + $Y wants + $3,412 savings
Plan:     $8,680 = $X needs + ($Y-$468) wants + $3,880 savings

Reduction: Expenses down $468 → Savings up $468
```

The math is simple: **Less expenses = More savings** (when income is constant).

---

## Files Involved

1. **Page Component**: `app/onboarding/monthly-plan-design/page.tsx`
   - Calculates current and recommended values
   - Passes to design component

2. **Design Component**: `components/monthly-plan/MonthlyPlanDesign.tsx`
   - Handles user interactions
   - Calculates savings automatically
   - Displays current vs plan comparison

3. **Income Allocation Engine**: `lib/alloc/income.ts`
   - Calculates recommended plan using business logic
   - Applies shift limits and rules

4. **Plan Generator**: `lib/onboarding/plan.ts`
   - Orchestrates engine calls
   - Converts between per-paycheck and monthly values

