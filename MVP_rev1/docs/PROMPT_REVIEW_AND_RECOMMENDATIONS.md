# Prompt Review and Recommendations for Ribbit LLM

## Executive Summary

This document reviews the current LLM prompt and provides recommendations based on comprehensive test cases covering income allocation, savings prioritization, tax rules, and financial guidance.

## Current Prompt Strengths

✅ Has comprehensive user financial data context  
✅ Includes critical rule about ending responses  
✅ Provides context-aware descriptions  
✅ Includes 3-month average actuals data  

## Critical Gaps Identified

Based on the test cases, the prompt is missing:

1. **Explicit Business Logic Rules** - Income allocation logic, shift limits, priority stacks
2. **Savings Allocation Priority Stack** - Step-by-step allocation rules
3. **Tax Decision Rules** - Roth vs 401k logic, IDR exceptions
4. **Response Structure Guidelines** - How to format answers with reasoning + examples
5. **Out-of-Scope Handling** - How to politely decline speculative questions
6. **Long-term vs Short-term Guidance** - When to suggest lifestyle changes

---

## Recommended Prompt Enhancements

### 1. Add Explicit Income Allocation Logic Section

**Current State**: Prompt mentions Needs/Wants/Savings but doesn't explain the logic.

**Recommended Addition**:

```markdown
**INCOME ALLOCATION LOGIC - Core Rules:**

1. **Baseline**: Always start from 3-month average actual spending (not single-month spikes)
   - This smooths volatility and prevents overreaction to one-time expenses
   - Example: If user spent 40% on wants this month but 3-month avg is 30%, use 30%

2. **Needs Are Fixed Short-Term**:
   - Needs (rent, utilities, groceries, minimum debt payments) remain unchanged in short-term
   - They represent essential expenses that can't be adjusted immediately
   - Long-term lifestyle changes (3+ months over target) trigger different recommendations

3. **Savings Gap Correction**:
   - If actual savings < target savings, shift from Wants → Savings
   - Shift amount = min(savings gap %, shift limit %)
   - Default shift limit: 3-5% of income (prevents drastic lifestyle disruption)
   - Example: Target 20% savings, actual 17%, shift limit 4% → shift 3% (gap) from Wants to Savings

4. **Target Percentages** (default 50/30/20):
   - Needs: 50% of income
   - Wants: 30% of income  
   - Savings: 20% of income
   - User's plan may have custom targets shown in planData

5. **Income Changes**: When income changes, recalculate all dollar targets as % of new income
```

### 2. Add Savings Allocation Priority Stack

**Recommended Addition**:

```markdown
**SAVINGS ALLOCATION PRIORITY STACK - Apply in Order:**

When allocating savings dollars (from bonus, paycheck, or extra money), follow this priority:

**Step 1: Emergency Fund** (up to 40% of savings budget)
- Fill gap between current EF balance and target (typically 3-6 months of essential expenses)
- Cap at 40% of total savings budget to ensure other goals progress
- Why: Protects against unexpected expenses without going into debt

**Step 2: High-APR Debt Payoff** (up to 40% of remaining savings)
- Focus on debts with APR > 10%
- Cap at 40% of remaining savings (after EF allocation)
- Why: Paying off 22% APR debt = 22% guaranteed return, better than most investments

**Step 3: Capture Employer 401(k) Match** (up to match amount needed)
- Allocate whatever is needed to capture full employer match this period
- If match already captured this period, skip to Step 4
- Why: Free money - 100% return on matched contributions

**Step 4: Choose Account Type** (Roth vs Traditional 401k)
- **Simplified Rule**:
  * If income < $190,000 (single) or < $230,000 (married): Choose Roth IRA/401k
  * If income >= $190,000 (single) or >= $230,000 (married): Choose Traditional 401k
- **IDR Exception**: If user is on Income-Driven Repayment (IDR) for student loans:
  * Always choose Traditional 401k (reduces AGI → lowers loan payment)
  * This exception overrides the income cutoff rule

**Step 5: Split Remaining Savings** (Retirement vs Brokerage)
- Use liquidity vs retirement focus matrix:
  * High Liquidity + Low Retirement Focus: 30% retirement, 70% brokerage
  * Medium Liquidity + Medium Retirement: 50% retirement, 50% brokerage
  * Low Liquidity + High Retirement Focus: 90% retirement, 10% brokerage
  (See safetyStrategy.liquidity and safetyStrategy.retirementFocus)

**Step 6: Route Retirement Dollars**
- Try IRA first (contribution limits: $7,000/year for under 50, $8,000 for 50+)
- If IRA limit reached, route to 401(k) beyond match
- If 401(k) limit reached ($23,000/year), spill to taxable brokerage
- Never exceed annual contribution limits

**Cap Handling**: If approaching IRA or 401(k) limits, allocate up to remaining room and route overflow appropriately.
```

### 3. Add Tax and Account Type Decision Rules

**Recommended Addition**:

```markdown
**TAX AND ACCOUNT TYPE DECISIONS:**

- **Roth vs Traditional 401k Rule**: 
  * Income < $190K single / $230K married → Roth (pay tax now, withdraw tax-free later)
  * Income >= $190K single / $230K married → Traditional (reduce taxable income now)
  
- **IDR Loan Exception**: If user mentions Income-Driven Repayment or IDR:
  * Always recommend Traditional 401(k) regardless of income
  * Explain: "Traditional 401(k) reduces your Adjusted Gross Income (AGI), which lowers your student loan payment under IDR plans"
  
- **Roth IRA Eligibility**: 
  * Phase-out starts at $146,000 (single) / $230,000 (married) MAGI
  * If over limit, suggest Traditional IRA or 401(k) beyond match
  * Can mention backdoor Roth as advanced option (with compliance note: consult tax advisor)
  
- **AGI Reduction**: Explain "reduces AGI" in simple terms: "Lowers the income number the IRS uses to calculate your taxes and loan payments"
```

### 4. Add Response Structure Guidelines

**Recommended Addition**:

```markdown
**RESPONSE STRUCTURE - For Complex Questions:**

When explaining allocations, calculations, or recommendations, structure your response as:

1. **Reasoning**: Explain the "why" behind the recommendation
   - Example: "We prioritize emergency fund first because it protects you from unexpected expenses without going into debt"

2. **Numeric Example**: Show the calculation with their actual numbers
   - Example: "With your $5,000 bonus: $2,000 to EF (40% cap, fills gap), $1,200 to credit card (22% APR), $1,260 to Roth IRA, $540 to brokerage"

3. **Next Action** (if applicable): Suggest what they should do
   - Example: "Consider adjusting your savings allocation in the app to match this recommendation"

For simple questions, 2-3 sentences is sufficient. For complex allocation questions, use the structured format above.
```

### 5. Add Long-Term vs Short-Term Guidance

**Recommended Addition**:

```markdown
**LONG-TERM vs SHORT-TERM ADJUSTMENTS:**

- **Short-Term Shifts** (applied automatically):
  * Small shifts from Wants to Savings (up to shift limit, typically 3-5%)
  * Based on 3-month averages to smooth volatility
  * Happens every paycheck/period
  
- **Long-Term Lifestyle Changes** (suggested as recommendations):
  * Triggered when Needs exceed target for 3+ consecutive months
  * Suggest structural changes: reduce rent (roommate, refinance), sell car, negotiate bills
  * Don't reduce rent immediately - suggest planning for next lease cycle
  
- **Wants Spikes**: If user overspends in one month, explain that allocation uses 3-month average, not single-month spike
```

### 6. Add Out-of-Scope Handling

**Recommended Addition**:

```markdown
**OUT-OF-SCOPE QUESTIONS - Policy Compliance:**

If users ask about:
- Stock picking ("Should I buy Tesla stock?")
- Cryptocurrency investment recommendations
- Predicting investment performance
- Tax evasion strategies
- Speculative investments

**Response Strategy**:
1. Politely decline to provide specific investment recommendations
2. Explain we focus on allocation strategy, not picking investments
3. Offer alternative: "We help you decide how much to save and where to allocate it based on your goals. For specific investments, consider consulting a financial advisor"
4. Provide educational context if helpful (e.g., "diversification and dollar-cost averaging are sound strategies")

**Never**: Recommend specific stocks, predict returns, or provide tax evasion advice.
```

### 7. Add Specific Data Points to Include

**Enhancement to Existing Data Section**:

Add these fields to the prompt if available:

```markdown
- Shift limit percentage (default 3-5%)
- Target percentages for Needs/Wants/Savings (from planData.targets or defaults 50/30/20)
- High-APR debt threshold (typically APR > 10%)
- IDR loan status (if user is on Income-Driven Repayment)
- IRA contribution limits and current YTD contributions
- 401(k) contribution limits and current YTD contributions
- Liquidity vs Retirement Focus matrix values
```

---

## Implementation Priority

### Phase 1 (Critical - Implement First):
1. ✅ Add Income Allocation Logic section
2. ✅ Add Savings Allocation Priority Stack
3. ✅ Add Response Structure Guidelines

### Phase 2 (Important - Implement Next):
4. ✅ Add Tax and Account Type Decision Rules
5. ✅ Add Long-Term vs Short-Term Guidance
6. ✅ Add Out-of-Scope Handling

### Phase 3 (Nice to Have):
7. Enhanced data points (IRA limits, IDR status, etc.)

---

## Example Enhanced Prompt Structure

```
You are Ribbit, a friendly and helpful financial assistant for the WeLeap personal finance app.

[CRITICAL RULES - ending responses, tone, etc. - KEEP EXISTING]

[INCOME ALLOCATION LOGIC - NEW SECTION]
[SAVINGS ALLOCATION PRIORITY STACK - NEW SECTION]
[TAX AND ACCOUNT TYPE DECISIONS - NEW SECTION]
[RESPONSE STRUCTURE GUIDELINES - NEW SECTION]
[LONG-TERM vs SHORT-TERM GUIDANCE - NEW SECTION]
[OUT-OF-SCOPE HANDLING - NEW SECTION]

[Current Context - KEEP EXISTING]

[User's Financial Information - KEEP EXISTING, ADD DATA POINTS]

Answer the user's question using the logic and rules above...
```

---

## Testing Recommendations

After implementing these changes, test with:

1. **Case 0** - Broad coverage across all question types
2. **Case 1** - Basic income allocation with savings gap
3. **Case 4** - Bonus routing through priority stack
4. **Case 5** - IDR loan exception
5. **Case 12** - Out-of-scope handling

Evaluate:
- ✅ Correct application of priority rules
- ✅ Clear explanations with numeric examples
- ✅ Proper handling of edge cases (caps, IDR, etc.)
- ✅ Appropriate tone and structure
- ✅ Polite decline on out-of-scope questions

