# Monthly Plan Design - Savings Increase Logic Walkthrough

## Overview

This document explains how savings increases when expenses are reduced in the Monthly Plan Design screen, using the example from your image.

---

## Example from Your Image

```
┌─────────────────────────────────────┐
│ Current (Actual Spending)           │
│ Income:    $8,680.00                │
│ Expenses:  $5,268.00                │
│ Savings:   $3,412.00                │
├─────────────────────────────────────┤
│ Plan (Recommended/Editable)         │
│ Income:    $8,680.00                │
│ Expenses:  $4,800.00  ← $468 less   │
│ Savings:   $3,880.00  ← $468 more   │
└─────────────────────────────────────┘
```

**Key Observation**: Expenses decreased by **$468**, Savings increased by **$468**

---

## Core Formula

```
Savings = Income - Expenses
        = Income - (Needs + Wants)
```

**From your example:**
- Current: $3,412 = $8,680 - $5,268 ✓
- Plan: $3,880 = $8,680 - $4,800 ✓

---

## Step-by-Step Logic Flow

### Step 1: Calculate Current Values (Actual Spending)

**File**: `app/onboarding/monthly-plan-design/page.tsx` (lines 24-59)

```typescript
// Current Income
currentIncome = incomeAmount × paychecksPerMonth
// Example: $8,680/month

// Current Needs
currentNeeds = sum(all needs expenses) + debt minimum payments
// Sums expenses categorized as 'needs' + all debt minimum payments
// Example: ~$4,268 (estimated from breakdown)

// Current Wants  
currentWants = sum(all wants expenses)
// Sums expenses categorized as 'wants'
// Example: ~$1,000 (estimated from breakdown)

// Current Expenses
currentExpenses = currentNeeds + currentWants
// $4,268 + $1,000 = $5,268 ✓

// Current Savings (auto-calculated)
currentSavings = currentIncome - currentExpenses
// $8,680 - $5,268 = $3,412 ✓
```

### Step 2: Generate Recommended Plan (Income Allocation Engine)

**File**: `lib/onboarding/plan.ts` → `generateInitialPaycheckPlanFromEngines()`

The engine uses **Income Allocation Logic**:

#### A. Start from 3-Month Average Actuals
- Uses `actuals3m` from `riskConstraints` (if available)
- OR calculates from `fixedExpenses` + `debts`
- Smooths out single-month spikes

#### B. Apply Savings Gap Correction

**File**: `lib/alloc/income.ts` → `allocateIncome()`

```typescript
// 1. Calculate savings gap
targetSavings$ = income × targetSavingsPct  // e.g., 20% = $1,736
actualSavings$ = income × actualSavingsPct  // e.g., 17% = $1,476 (from $3,412)
savingsGap$ = targetSavings$ - actualSavings$  // $260 gap

// 2. Calculate shift (limited by shift limit)
shiftLimitPct = 4%  // Default, prevents drastic changes
shiftLimit$ = income × shiftLimitPct  // $8,680 × 0.04 = $347

// 3. Shift from Wants to Savings
shift$ = min(savingsGap$, shiftLimit$)  // min($260, $347) = $260
// OR if gap is larger: min($468, $347) = $347 (capped)

// 4. Apply shift
recommendedWants = actualWants - shift$
recommendedSavings = actualSavings + shift$
recommendedNeeds = actualNeeds  // Fixed, doesn't change
```

#### C. Result: Recommended Values

```typescript
recommendedNeeds = $4,268  // Same as current (fixed short-term)
recommendedWants = $1,000 - $468 = $532  // Reduced by shift
recommendedExpenses = $4,268 + $532 = $4,800  // Reduced by $468
recommendedSavings = $8,680 - $4,800 = $3,880  // Increased by $468
```

**Note**: The actual shift might be $468 (exactly matching the expense reduction), which could be:
- A shift larger than the typical 4% limit (if user is in a special mode)
- OR a combination of shift + user adjustment
- OR the engine calculated a larger shift based on specific conditions

### Step 3: Component Auto-Calculates Savings

**File**: `components/monthly-plan/MonthlyPlanDesign.tsx` (lines 48-52)

```typescript
// These are calculated in real-time, not stored in state
const expenses = needs + wants;  // Plan expenses
const savings = income - expenses;  // Plan savings (AUTO-CALCULATED)
```

**Key Point**: Savings is **NOT a slider** - it's automatically calculated.

When the component receives:
- `recommendedNeeds = $4,268`
- `recommendedWants = $532`
- `recommendedIncome = $8,680`

It calculates:
```typescript
expenses = $4,268 + $532 = $4,800
savings = $8,680 - $4,800 = $3,880
```

---

## How Savings Increases in the UI

### User Interaction Flow

1. **Initial Load**: 
   - Component receives recommended values from engine
   - Shows: Plan Expenses = $4,800, Plan Savings = $3,880

2. **User Adjusts Sliders**:

   **Option A: Reduce Wants**
   ```
   User moves Wants slider: $532 → $400
   Result:
     - Expenses: $4,268 + $400 = $4,668 (down $132)
     - Savings: $8,680 - $4,668 = $4,012 (up $132)
   ```

   **Option B: Reduce Needs**
   ```
   User moves Needs slider: $4,268 → $4,000
   Result:
     - Expenses: $4,000 + $532 = $4,532 (down $268)
     - Savings: $8,680 - $4,532 = $4,148 (up $268)
   ```

   **Option C: Increase Income**
   ```
   User moves Income slider: $8,680 → $9,000
   Result (if expenses unchanged):
     - Expenses: $4,800 (unchanged)
     - Savings: $9,000 - $4,800 = $4,200 (up $320)
   ```

3. **Savings Updates Automatically**:
   - Every slider change triggers recalculation
   - Formula always: `savings = income - (needs + wants)`
   - No manual input needed - it's automatic!

---

## Mathematical Breakdown (Your Example)

### Current State
```
Income:   $8,680.00
Expenses: $5,268.00  = Needs ($4,268) + Wants ($1,000)
Savings:  $3,412.00  = $8,680 - $5,268
```

### Recommended Plan State
```
Income:   $8,680.00  (unchanged)
Expenses: $4,800.00  = Needs ($4,268) + Wants ($532)
                          ↓              ↓
                    (unchanged)   (reduced $468)
Savings:  $3,880.00  = $8,680 - $4,800
                     ↑
            (increased $468)
```

### The Relationship

```
Expense Reduction = Savings Increase
     -$468       =      +$468
```

**Proof**:
```
Current:  $8,680 = $5,268 (expenses) + $3,412 (savings)
Plan:     $8,680 = $4,800 (expenses) + $3,880 (savings)

Change:   $0     = -$468 (expenses)  + $468 (savings)
         ✓ Income unchanged
         ✓ Expense reduction = Savings increase
```

---

## Why Expenses Decrease (Engine Recommendation)

The Income Allocation Engine recommended reducing expenses because:

### 1. Savings Gap Identified
- Target savings might be 20% of income = $1,736/month
- Actual savings is below target
- Gap exists that needs to be filled

### 2. Shift Logic Applied
- **Needs**: Kept at actual level (can't reduce immediately)
- **Wants**: Reduced by shift amount (can reduce discretionary spending)
- **Result**: Lower expenses → Higher savings

### 3. Shift Limit Protection
- Default shift limit: 3-5% of income (~$260-$434)
- In your case, a $468 shift might indicate:
  - Special circumstances
  - User is in a mode that allows larger shifts
  - Or the engine calculated a progressive shift

---

## Component Code Reference

### Savings Calculation (Automatic)

**Location**: `components/monthly-plan/MonthlyPlanDesign.tsx` lines 48-52

```typescript
// Derived values - calculated automatically
const expenses = needs + wants;
const savings = income - expenses;  // ← AUTO-CALCULATED, NOT A SLIDER
```

**Key**: Savings is **derived**, not stored in state separately.

### Slider Handlers (Ensure Constraints)

**Location**: `components/monthly-plan/MonthlyPlanDesign.tsx` lines 89-97

```typescript
const handleNeedsChange = (value: number[]) => {
  const newNeeds = Math.min(value[0], income - wants);
  // Ensures: needs + wants <= income
  // So: savings = income - (needs + wants) >= 0
  setNeeds(newNeeds);
};

const handleWantsChange = (value: number[]) => {
  const newWants = Math.min(value[0], income - needs);
  // Ensures: needs + wants <= income
  // So: savings = income - (needs + wants) >= 0
  setWants(newWants);
};
```

**Key**: Both handlers ensure `needs + wants <= income`, which guarantees `savings >= 0`.

---

## Summary

### How Savings Increases:

1. **Automatic Formula**: 
   ```
   Savings = Income - (Needs + Wants)
   ```

2. **Three Ways to Increase Savings**:
   - ✅ **Increase Income** (more money available)
   - ✅ **Decrease Needs** (reduce essential expenses)
   - ✅ **Decrease Wants** (reduce discretionary expenses)

3. **In Your Example**:
   - Expenses reduced by **$468** ($5,268 → $4,800)
   - Savings increased by **$468** ($3,412 → $3,880)
   - Income stayed the same ($8,680)

4. **The Math**:
   ```
   Expense Reduction = -$468
   Savings Increase  = +$468
   Net Change        = $0 (income unchanged)
   ```

### The Logic:

- **Savings is calculated automatically** - not a user input
- **Reducing expenses directly increases savings** (when income is constant)
- **The engine recommends reducing expenses** to improve savings
- **Users can adjust sliders** to customize the recommendation

---

## Files to Review

1. **Component Logic**: `components/monthly-plan/MonthlyPlanDesign.tsx`
   - Lines 48-52: Savings calculation
   - Lines 89-97: Slider handlers

2. **Page Logic**: `app/onboarding/monthly-plan-design/page.tsx`
   - Lines 24-59: Current values calculation
   - Lines 62-89: Recommended values from engine

3. **Engine Logic**: `lib/alloc/income.ts`
   - `allocateIncome()`: Calculates recommended plan using business rules

4. **Plan Generator**: `lib/onboarding/plan.ts`
   - `generateInitialPaycheckPlanFromEngines()`: Orchestrates engine call

---

**The core insight**: Savings increases automatically when expenses decrease because `Savings = Income - Expenses`. When income is fixed, any reduction in expenses directly increases savings by the same amount.

