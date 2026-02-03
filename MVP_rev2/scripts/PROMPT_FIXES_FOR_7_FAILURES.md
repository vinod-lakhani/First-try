# Prompt Fixes for 7 Test Failures

**Date:** December 17, 2025  
**Goal:** Fix all 7 validation failures identified in accuracy testing

---

## Failures Fixed

### 1. ✅ Missing 4% Shift Limit Mention
**Failure:** Response didn't mention 4% shift limit when suggesting wants reduction

**Fix Applied:**
- Changed from "ALWAYS mention" to "MANDATORY: You MUST explicitly state"
- Added specific required text: "The maximum shift from Wants to Savings is 4% of your income, which is $X"
- Added to critical requirements section at top
- Added negative example showing what NOT to do

**Location:** Lines 1689-1694, 1678-1680

---

### 2. ✅ Missing 3-Month Average Reference
**Failure:** Response used target percentages instead of 3-month actuals

**Fix Applied:**
- Changed from "ALWAYS start from" to "MANDATORY: You MUST start from"
- Added requirement: "You MUST explicitly state 'Based on your 3-month average actual spending' or 'Using your 3-month average'"
- Added to critical requirements section
- Added negative example: "Based on 50/30/20 targets" is WRONG

**Location:** Lines 1682-1684, 1678

---

### 3. ✅ Missing Total Verification
**Failure:** Response didn't verify Needs + Wants + Savings = Income

**Fix Applied:**
- Changed from "ALWAYS verify" to "MANDATORY: You MUST verify totals at the end"
- Added specific required format: "Total: Needs $X + Wants $Y + Savings $Z = Monthly Income $Total ✓"
- Added to validation checklist
- Added negative example showing missing verification

**Location:** Lines 1691, 1756, 1678

---

### 4. ✅ Missing Priority Stack Integration (2 failures)
**Failure:** Down payment questions didn't explain how it fits into priority stack

**Fix Applied:**
- Changed from "ALWAYS show" to "MANDATORY: You MUST explain"
- Added specific required text: "This fits into your Savings Allocation Priority Stack: Emergency Fund → High-APR Debt → Employer Match → Retirement → Brokerage (where down payment savings go)"
- Added requirement: "Down payment savings come from the Brokerage portion of your savings allocation"
- Added mandatory allocation breakdown format
- Added to critical requirements section
- Added negative example

**Location:** Lines 1696-1703, 1679

---

### 5. ✅ Not Using Actual User Data
**Failure:** Comparison question didn't use $11,700 and income

**Fix Applied:**
- Changed from "ALWAYS use" to "MANDATORY: You MUST use"
- Added requirement: "You MUST state their actual savings amount (e.g., '$11,700') and income amount in your response"
- Added specific calculation example with actual numbers
- Added fallback: "If you don't have age data, still calculate and state: 'You have saved $X, which is Y months of your monthly income of $Z'"
- Added to critical requirements section
- Added negative example

**Location:** Lines 1749-1757, 1680

---

### 6. ✅ Calculation Format Missing
**Failure:** Should show explicit calculation: ($240,000 - $11,700) / $2,000 = 114 months

**Fix Applied:**
- Added "MANDATORY: For time-to-save calculations, you MUST show the explicit formula: (Target Amount - Current Savings) ÷ Monthly Savings = Months"
- Added to critical requirements section
- Added negative example showing incomplete calculation

**Location:** Lines 1745, 1681

---

## Key Changes Summary

### Language Strengthening
- Changed "ALWAYS" to "MANDATORY: You MUST" for critical requirements
- Added specific required text that must appear in responses
- Added negative examples showing what NOT to do

### New Sections Added
1. **Critical Requirements Section** at top of answer instructions (Lines 1678-1681)
2. **Examples of What NOT to Do** with 7 specific wrong examples (Lines 1682-1689)

### Enhanced Validation Checklist
- Expanded from 7 to 9 items
- Made each item more specific with "MUST" language
- Added explicit verification requirements

---

## Expected Impact

After these changes are deployed, the test suite should show:
- ✅ 4% shift limit mentioned when relevant
- ✅ 3-month average referenced for income questions
- ✅ Totals verified with check mark
- ✅ Priority stack explained for savings questions
- ✅ Actual user data used for comparisons
- ✅ Explicit calculation formulas shown

**Target:** 16/16 validations passing (100%)

---

## Testing

To verify these fixes work:
1. Deploy the updated prompt to production
2. Run: `API_URL=https://weleap-mvp.vercel.app node test-accuracy-validation.js`
3. Check that all 7 failures are now passing

---

## Files Modified

- `weleap-mockups/app/api/chat/route.ts` - Enhanced prompt with mandatory requirements

