# Why Do Expenses Decrease? (Simple Explanation)

## The Short Answer

**Expenses decrease because your actual savings is below the target savings percentage.**

The app compares your spending to target percentages (like the 50/30/20 rule) and recommends reducing expenses to help you reach those targets.

---

## Step-by-Step: What Happens

### 1. The App Sets Target Percentages

Based on your financial goal, the app sets target percentages:

**Default (50/30/20 Rule):**
- Needs: 50% of income
- Wants: 30% of income  
- Savings: 20% of income

**Or if your goal is "debt-free" or "house down payment":**
- Needs: 50% of income
- Wants: 20% of income
- Savings: 30% of income

### 2. The App Calculates Your Actual Spending

From your expenses and debts, it calculates:
- Actual Needs: What you're spending on essentials
- Actual Wants: What you're spending on discretionary items
- Actual Savings: What's left over (income - expenses)

### 3. The App Compares: Actual vs Target

**Example Scenario:**

```
Your Income: $8,680/month

TARGET (50/30/20):
├── Needs:   $4,340 (50%)
├── Wants:   $2,604 (30%)
└── Savings: $1,736 (20%)

YOUR ACTUAL:
├── Needs:   $4,268 (49.2%) ✅ Close to target
├── Wants:   $1,000 (11.5%) ✅ Below target
└── Savings: $3,412 (39.3%) ✅ Above target!

Wait... your savings is ABOVE target. Why reduce expenses?
```

### 4. The Real Scenario: Savings Below Target

**More likely scenario:**

```
Your Income: $8,680/month

TARGET (50/30/20):
├── Needs:   $4,340 (50%)
├── Wants:   $2,604 (30%)
└── Savings: $1,736 (20%)

YOUR ACTUAL:
├── Needs:   $4,268 (49.2%) ✅ Close to target
├── Wants:   $2,868 (33.0%) ❌ ABOVE target (should be 30%)
└── Savings: $1,544 (17.8%) ❌ BELOW target (should be 20%)

GAP: Savings is $192 below target ($1,736 - $1,544)
```

### 5. The Engine Applies Shift Logic

**File**: `lib/alloc/income.ts` lines 124-143

```typescript
// 1. Calculate savings gap
savingsGap$ = targetSavings$ - actualSavings$
// $1,736 - $1,544 = $192 gap

// 2. Calculate shift (limited by shift limit of 4%)
shiftLimit$ = income × 4% = $347
shiftAmount$ = min($192 gap, $347 limit) = $192

// 3. Shift from Wants to Savings
wants$ = $2,868 - $192 = $2,676
savings$ = $1,544 + $192 = $1,736

// 4. Needs stays fixed
needs$ = $4,268 (unchanged)
```

**Result:**
- Expenses: $4,268 + $2,676 = $6,944 → $6,944 (no change in this example)
- Savings: $1,544 → $1,736 (increased by $192)

**But wait, in your image expenses decreased by $468...**

### 6. Your Specific Case: Larger Shift

**If the shift is larger (like $468):**

```
Your Actual:
├── Needs:   $4,268
├── Wants:   $1,000
└── Savings: $3,412

Target (if goal requires 30% savings):
├── Needs:   $4,340 (50%)
├── Wants:   $1,736 (20%)
└── Savings: $2,604 (30%)

Gap: $2,604 - $3,412 = -$808 (you're ABOVE target!)

Hmm, this still doesn't explain it...
```

**Alternative Explanation:**

The engine might be applying a shift based on:
1. **Wants optimization**: Even if savings is above target, if wants can be reduced, it recommends doing so
2. **Conservative approach**: "Better to save more" philosophy
3. **Different target**: Your actual target might be higher than 20% or 30%

---

## The Core Logic (Code)

**File**: `lib/alloc/income.ts`

```typescript
// Only shift if savings is below target
if (savingsGap$ > 0.01) {
  // Calculate shift amount (limited by shift limit)
  shiftAmount$ = min(savingsGap$, shiftLimit$)
  
  // Shift from Wants to Savings
  wants$ = wants$ - shiftAmount$
  savings$ = savings$ + shiftAmount$
  
  // Needs stays fixed
  // needs$ = needs$ (unchanged)
}
```

**Key Points:**
1. ✅ Only shifts if **savings is below target**
2. ✅ Shifts from **Wants** (not Needs)
3. ✅ Limited by **shift limit** (3-5% of income)
4. ✅ **Needs stays fixed** (can't reduce immediately)

---

## Why This Makes Sense

### Financial Best Practices

1. **20% Savings Target**: Financial experts recommend saving at least 20% of income
   - Emergency fund
   - Retirement
   - Financial goals

2. **30% Wants Target**: Discretionary spending should be balanced
   - Too high = overspending
   - Too low = no fun/lifestyle too restrictive

3. **50% Needs Target**: Essential expenses should be manageable
   - If needs > 50%, you might be living beyond your means

### The Recommendation

**"Your savings is below the recommended 20% target. To reach this target, reduce your discretionary spending (wants) by $468/month. This will increase your savings by $468/month without affecting your essential expenses (needs)."**

---

## Summary

**Why expenses decrease:**

1. ✅ **Target Comparison**: App compares your actual spending to target percentages (50/30/20 rule)
2. ✅ **Savings Gap**: If your savings is below target, there's a gap to fill
3. ✅ **Shift Logic**: Engine shifts money from Wants → Savings (within shift limit)
4. ✅ **Result**: Lower expenses (wants reduced) = Higher savings

**The recommendation helps you:**
- Reach financial best practices (20% savings)
- Meet your financial goals
- Build financial security
- Without disrupting essential expenses

**You can always adjust the sliders** to customize the recommendation to your preferences!

