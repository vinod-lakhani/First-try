# Systematic Prompt Improvements

**Date:** December 17, 2025  
**Goal:** Refactor prompt from case-specific patches to broad, systematic principles

---

## Problem Identified

The initial fixes were too specific to the 5 test cases:
- Mentioned specific dollar amounts ($11,700, $104,160) in requirements
- Examples were tied to specific scenarios
- Requirements were organized by test case, not by principle
- Risk: Would only work for those 5 cases, not generalizable

---

## Solution: Systematic Refactoring

### 1. **Universal Principles Section** (NEW)

Created 5 universal principles that apply to **ALL questions**, regardless of type:

#### Principle 1: Use Actual Data, Not Generics
- **Applies to:** Every question type
- **Rule:** Always use user's actual numbers from prompt
- **Generalizable:** Works for income, savings, debt, expenses, any financial metric
- **Not specific to:** Any particular dollar amount or scenario

#### Principle 2: Show Your Work - Transparent Calculations
- **Applies to:** Any calculation (time, allocation, comparison, etc.)
- **Rule:** Always show formula and steps
- **Generalizable:** Works for down payments, debt payoff, retirement savings, emergency fund, etc.
- **Not specific to:** Any particular calculation type

#### Principle 3: Verify Totals - Always Check Your Math
- **Applies to:** Any breakdown or allocation
- **Rule:** Verify totals match source (income, savings, net worth, etc.)
- **Generalizable:** Works for any financial breakdown
- **Not specific to:** Needs/Wants/Savings only

#### Principle 4: Provide Context - Explain the "Why"
- **Applies to:** Any recommendation or explanation
- **Rule:** Explain which business logic rule applies
- **Generalizable:** Works for allocations, savings goals, tax decisions, etc.
- **Not specific to:** Any particular scenario

#### Principle 5: No Closing Phrases - End Naturally
- **Applies to:** Every response
- **Rule:** Answer completely, then stop
- **Generalizable:** Universal rule for all question types
- **Not specific to:** Any particular question

---

### 2. **Question-Type Requirements** (Refactored)

Changed from specific examples to generalizable patterns:

#### Before (Too Specific):
```
3. **Comparison Questions**: MUST use actual user data ($11,700 savings, $104,160 income, etc.)
```

#### After (Generalizable):
```
9. **For Comparison Questions** (e.g., "Am I on track?", "How do I compare?", "Is this good?"):
   - **MANDATORY**: Use actual user data from the prompt (their savings amount, income amount, age if available)
   - **MANDATORY**: Calculate specific metrics using their actual numbers
   - Calculate: Current Savings ÷ (Annual Income ÷ 12) = Months of Salary Saved
```

**Improvement:** Works for any comparison question, not just "Am I on track?"

---

### 3. **Removed Specific Dollar Amounts**

#### Before:
- "MUST use actual user data ($11,700 savings, $104,160 income, etc.)"
- Examples with specific amounts

#### After:
- "Use actual user data from the prompt (their savings amount, income amount)"
- Generic formulas that work with any amounts

**Improvement:** Principles work regardless of user's financial situation

---

### 4. **Systematic Validation Checklist**

#### Before (Case-Specific):
```
- [ ] For comparison questions: **MUST** use actual savings amount and income amount from user data
```

#### After (Systematic):
```
- [ ] **Universal Principles Applied:**
  - [ ] Used actual user data (not generic examples)
  - [ ] Showed calculation work (formula and steps)
  - [ ] Verified totals (with check mark ✓)
  - [ ] Provided context (explained which rules apply)
  - [ ] No closing phrases
- [ ] **Question-Specific Requirements:**
  - [ ] Income questions: Mentioned "3-month average" AND "4% shift limit" (if relevant) AND verified totals
  - [ ] Savings questions: Explained priority stack
  - [ ] Comparison questions: Used actual savings and income amounts to calculate metrics
  - [ ] Time calculations: Showed explicit formula
```

**Improvement:** Separates universal principles from question-specific requirements

---

## Key Improvements

### ✅ Broad Applicability
- Universal principles apply to **all question types**
- Not tied to specific dollar amounts or scenarios
- Works for any user's financial situation

### ✅ Systematic Structure
- Principles first (what applies to everything)
- Then question-specific requirements (what applies to certain types)
- Clear separation of concerns

### ✅ Generalizable Rules
- Formulas work for any amounts: (Target - Current) ÷ Monthly = Time
- Verification works for any breakdown: Component1 + Component2 + ... = Total ✓
- Data usage works for any metric: Use actual values from prompt

### ✅ Maintainable
- Adding new question types: Apply universal principles + add type-specific requirements
- Fixing issues: Update principles, not individual cases
- Testing: Can test principles independently

---

## Examples of Generalizability

### Example 1: Time Calculations
**Before:** "For down payment: ($240,000 - $11,700) ÷ $2,000 = 114 months"  
**After:** "For ANY time-to-save calculation: (Target Amount - Current Savings) ÷ Monthly Savings = Months"  
**Applies to:** Down payment, emergency fund, debt payoff, retirement savings, vacation fund, etc.

### Example 2: Data Usage
**Before:** "Use $11,700 savings and $104,160 income"  
**After:** "Use actual user data from the prompt (their savings amount, income amount)"  
**Applies to:** Any user, any financial metric, any question type

### Example 3: Total Verification
**Before:** "Needs + Wants + Savings = Income ✓"  
**After:** "For any breakdown: Component1 + Component2 + ... = Total ✓"  
**Applies to:** Income allocations, savings allocations, net worth, expense breakdowns, etc.

---

## Testing Impact

The systematic improvements should:
- ✅ Fix the 7 original test failures (still works)
- ✅ Work for new test cases we haven't thought of yet
- ✅ Work for different user financial situations
- ✅ Work for different question phrasings
- ✅ Be maintainable as we add more question types

---

## Files Modified

- `weleap-mockups/app/api/chat/route.ts` - Refactored to systematic principles

---

## Next Steps

1. Test with original 5 test cases (should still pass)
2. Add new test cases with different scenarios to verify generalizability
3. Test with different user financial situations
4. Monitor production responses for adherence to principles

