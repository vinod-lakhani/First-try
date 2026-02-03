# LLM Test Plan Improvements

## Date: November 29, 2025

## Summary

We've significantly improved the LLM test plan based on:
1. **Real user questions** from production logs (17 questions extracted)
2. **New features** added since last test update (asset breakdowns, net worth projections)
3. **Known issues** from prompt iterations (formatting, calculation quality, context awareness)

## What Changed

### 1. New Comprehensive Test Suite (`test-comprehensive.js`)

**Before:** Tests were based on hypothetical scenarios  
**After:** Tests use **real questions from production logs**

Real questions tested:
- "walk me through the numbers in the recommended plan"
- "give me a breakdown of my net worth in 10 years"
- "how much cash will I have in 5 years"
- "what will my net worth be in 5 years"
- "what can I do to increase my net worth by an additional $100,000 in 5 years"

### 2. New Test Categories

#### Group 1: Real User Questions ✅
- Tests actual questions users are asking in production
- Validates context awareness (savings-helper vs financial-sidekick)
- Checks for proper use of Recommended Plan values

#### Group 2: Net Worth & Asset Breakdowns ✅ (NEW)
- **Asset-specific questions**: "how much cash in 5 years"
- **Net worth breakdowns**: Validates use of `assetBreakdown` data
- **Data usage**: Ensures LLM uses provided breakdowns directly, not calculates from scratch

#### Group 3: Growth-Aware Calculations ✅ (NEW)
- Tests that growth rates are factored in (4%, 8.5%, 9%)
- Validates not using simple linear math
- Checks for compound growth awareness

#### Group 4: Formatting Quality ✅ (ENHANCED)
- No LaTeX formulas (should use plain English)
- Bold numbers or bullet points for clarity
- Clear, structured responses

### 3. Enhanced Validations

**Before:** Basic keyword checks  
**After:** Sophisticated validation rules

New validations:
- ✅ Uses `assetBreakdown` data directly (not calculates)
- ✅ No linear math for growth scenarios
- ✅ References correct context values (Recommended Plan in savings-helper)
- ✅ No LaTeX formatting
- ✅ Proper asset type breakdowns (Cash, Brokerage, Retirement)

### 4. Mock Data Improvements

**Before:** Basic mock data  
**After:** Comprehensive mock data including:

```javascript
{
  netWorth: {
    projections: [
      {
        label: '5 Years',
        months: 60,
        value: 127985,
        assetBreakdown: {
          cash: 15000,
          brokerage: 35000,
          retirement: 77985,
          // ...
        },
      },
      // ...
    ],
  },
  savingsHelperBarGraphs: {
    actuals3m: { ... },
    currentPlan: { ... },
    recommendedPlan: { ... },
  },
}
```

## Test Coverage Comparison

### Before
- ✅ Basic income allocation
- ✅ Bonus allocation
- ✅ IDR exceptions
- ✅ Edge cases
- ❌ Net worth questions
- ❌ Asset breakdowns
- ❌ Real user questions
- ❌ Growth-aware calculations
- ❌ Savings-helper context

### After
- ✅ Basic income allocation
- ✅ Bonus allocation
- ✅ IDR exceptions
- ✅ Edge cases
- ✅ **Net worth questions** (NEW)
- ✅ **Asset breakdowns** (NEW)
- ✅ **Real user questions** (NEW)
- ✅ **Growth-aware calculations** (NEW)
- ✅ **Savings-helper context** (NEW)

## Key Improvements

### 1. Tests Based on Real Usage
- Questions are extracted from actual production logs
- Tests reflect what users actually ask
- Validates real-world scenarios

### 2. Asset Breakdown Validation
- Ensures LLM uses provided `assetBreakdown` data
- Prevents manual calculations that ignore growth
- Validates correct asset type references

### 3. Context Awareness
- Tests savings-helper context specifically
- Validates Recommended Plan vs Current Plan distinction
- Checks for proper bar graph value usage

### 4. Formatting Quality
- No LaTeX formulas (should be plain English)
- Clear structure with bold/bullets
- Professional, readable responses

## How to Use

### Run Comprehensive Tests

```bash
# Start dev server
npm run dev

# Run comprehensive test suite
node scripts/test-comprehensive.js
```

### Expected Output

```
🧪 Comprehensive LLM Test Suite

# TEST GROUP 1: Real User Questions from Production
✅ walk me through the numbers in the recommended plan
  ✅ Mentions Recommended Plan values
  ✅ Explains income allocation
  ✅ Uses actual dollar amounts

# TEST GROUP 2: Net Worth & Asset Breakdown Questions
✅ give me a breakdown of my net worth in 10 years
  ✅ Uses asset breakdown data directly
  ✅ Breaks down by asset type
  ✅ No linear math calculations

# TEST SUMMARY
📊 Tests Run: 6
✅ Validations Passed: 18/20
📈 Pass Rate: 90.0%
```

## Next Steps

1. **Run the tests** to see current status
2. **Review failures** to identify prompt improvements
3. **Iterate on prompts** based on test results
4. **Re-run tests** to validate improvements

## Files Changed

- ✅ Created: `scripts/test-comprehensive.js` (new comprehensive test suite)
- ✅ Created: `scripts/README-TEST-PLAN.md` (test documentation)
- ✅ Created: `docs/TEST_PLAN_IMPROVEMENTS.md` (this file)
- 📝 Existing tests remain unchanged for backward compatibility

## Testing Against Production

You can test against production logs by:

1. **Extract questions** from CSV:
   ```bash
   node scripts/extract-questions.js --input scripts/logs_result.csv --format csv --output questions.csv
   ```

2. **Add real questions** to test suite

3. **Run tests**:
   ```bash
   API_URL=https://weleap-mvp.vercel.app node scripts/test-comprehensive.js
   ```

## Continuous Improvement

- **Weekly**: Extract new questions from production logs
- **Monthly**: Update test suite with new scenarios
- **After each prompt change**: Re-run comprehensive tests

---

**Status**: ✅ Ready to run and iterate

