# LLM Test Plan - Updated & Improved

## Overview

This comprehensive test suite validates the LLM chat responses based on:
1. **Real user questions** from production logs
2. **New features** (net worth breakdowns, asset-specific questions, savings-helper context)
3. **Formatting quality** (no LaTeX, plain English, clear structure)
4. **Data usage** (uses provided breakdowns directly, not manual calculations)

## Test Files

### `test-comprehensive.js` (NEW - Recommended)
- Tests real user questions from production
- Tests net worth and asset breakdown scenarios
- Tests growth-aware calculations
- Tests formatting quality
- **Use this for comprehensive validation**

### `test-chat.js` (Legacy)
- Basic scenarios
- Simple income allocation tests
- Good for quick smoke tests

### `test-detailed.js` (Legacy)
- Detailed calculation validation
- Precision checks
- Good for verifying calculation accuracy

### `test-edge-cases.js` (Legacy)
- Edge case scenarios
- Boundary conditions
- Good for stress testing

## Running Tests

### Comprehensive Test Suite (Recommended)

```bash
# Start your dev server first
npm run dev

# In another terminal, run tests
cd weleap-mockups
node scripts/test-comprehensive.js

# Or test against production
API_URL=https://weleap-mvp.vercel.app node scripts/test-comprehensive.js
```

### Individual Test Files

```bash
# Basic tests
node scripts/test-chat.js

# Detailed tests
node scripts/test-detailed.js

# Edge cases
node scripts/test-edge-cases.js
```

## What's New in the Comprehensive Test

### 1. Real User Questions
Tests actual questions from production logs:
- "walk me through the numbers in the recommended plan"
- "give me a breakdown of my net worth in 10 years"
- "how much cash will I have in 5 years"
- "what will my net worth be in 5 years"

### 2. Asset Breakdown Validation
- Verifies LLM uses `assetBreakdown` data directly
- Checks that it doesn't calculate from scratch
- Validates proper use of Cash, Brokerage, Retirement values

### 3. Growth-Aware Calculations
- Tests that additional savings calculations factor in growth
- Verifies not using simple linear math
- Checks for growth rate mentions (4%, 8.5%, 9%)

### 4. Savings-Helper Context
- Tests that Recommended Plan references income allocation (Needs/Wants/Savings)
- Verifies it doesn't confuse with savings allocation breakdown
- Checks for proper bar graph value references

### 5. Formatting Quality
- No LaTeX formulas (should use plain English)
- Bold numbers or bullet points for clarity
- No forbidden closing phrases
- Clear, readable structure

## Test Scenarios Covered

### Group 1: Real User Questions
- ✅ Recommended plan explanation (savings-helper context)
- ✅ Walk through numbers

### Group 2: Net Worth & Asset Breakdowns
- ✅ Net worth breakdown in 10 years
- ✅ Asset-specific question (cash in 5 years)
- ✅ Net worth projection in 5 years

### Group 3: Growth-Aware Calculations
- ✅ Additional savings impact with growth factored in

### Group 4: Formatting Quality
- ✅ Plain English (no LaTeX)
- ✅ Clear structure (bold/bullets)

## Validation Checks

Each test includes validation checks for:

1. **Content Accuracy**
   - Uses correct data from provided breakdowns
   - References correct values (Recommended Plan vs Current Plan)
   - Mentions expected concepts (growth, compound, etc.)

2. **Data Usage**
   - Uses `assetBreakdown` values directly (not calculates)
   - Doesn't use linear math for growth scenarios
   - References proper context (savings-helper bar graphs)

3. **Formatting**
   - No LaTeX formulas
   - Uses bold text or bullet points
   - Clear, readable structure

4. **Phrase Checks**
   - No forbidden closing phrases
   - Professional tone
   - Actionable advice

## Expected Results

### ✅ Good Response Should:
- Use exact values from `assetBreakdown` when available
- Reference Recommended Plan values in savings-helper context
- Mention growth rates for net worth questions
- Use plain English formatting (no LaTeX)
- Provide clear, structured answers

### ❌ Bad Response Indicators:
- Calculates from scratch instead of using provided data
- Shows LaTeX formulas like `\[ \text{Total} = ... \]`
- Uses linear math for growth scenarios
- Confuses Recommended Plan (income allocation) with savings allocation
- Contains forbidden closing phrases

## Updating Tests

When adding new test scenarios:

1. **Add real user questions** from production logs (`questions.csv`)
2. **Include validation checks** for expected behavior
3. **Test both contexts** (financial-sidekick, savings-helper)
4. **Validate formatting** (no LaTeX, clear structure)

Example:
```javascript
allResults.push(await testChat(
  'your new question here',
  mockUserPlanData,
  'financial-sidekick',
  {
    'Validation name': (answer) => {
      return {
        pass: /* check condition */,
        message: 'What should be true',
      };
    },
  }
));
```

## Continuous Improvement

After running tests:

1. **Review failed validations** - identify patterns
2. **Update prompts** - address common issues
3. **Add missing test cases** - cover new scenarios
4. **Refine validations** - improve accuracy

## Integration with CI/CD

```yaml
# Example GitHub Actions
- name: Test LLM Responses
  run: |
    npm run dev &
    sleep 5
    node scripts/test-comprehensive.js
    # Fail if validation pass rate < 80%
```

