# Comprehensive Expanded Test Suite

## Overview

This expanded test suite includes **all 45 questions** organized into 7 categories, covering:

1. **Income Allocation Questions** (10 questions)
2. **Savings Allocation Questions** (10 questions)  
3. **Goal-Based & Scenario Questions** (5 questions)
4. **Tax & Income Sensitivity Questions** (6 questions)
5. **Long-Term vs Short-Term Adjustment Questions** (4 questions)
6. **General Financial Literacy & Behavioral Questions** (6 questions)
7. **Out-of-Scope Questions** (4 questions)

Plus the original tests:
- Real user questions from production
- Net worth breakdown tests
- Growth-aware calculations
- Formatting quality checks

## Running the Tests

### Quick Test (Original - 7 tests)
```bash
node scripts/test-comprehensive.js
```

### Full Expanded Test (45+ questions - takes ~10-15 minutes)
```bash
node scripts/test-comprehensive-expanded.js
```

### Test Against Production
```bash
API_URL=https://weleap-mvp.vercel.app node scripts/test-comprehensive-expanded.js
```

## Test Categories

### 1. Income Allocation Questions
Tests understanding of Needs/Wants/Savings model:
- How to divide paycheck
- Current allocations meaning
- Savings rate adjustments
- Next paycheck allocation
- Fixed expense rules
- Shift logic
- 3-month average
- Shift limit protection
- Single-month spikes
- Income changes

### 2. Savings Allocation Questions
Tests savings priority stack understanding:
- Bonus allocation
- Emergency fund vs debt
- High-APR debt priority
- Employer match
- Roth vs 401(k)
- IDR plan considerations
- Retirement vs brokerage split
- IRA contribution limits
- Monthly budget examples
- Liquidity preferences

### 3. Goal-Based & Scenario Questions
Tests goal-to-allocation connections:
- Building emergency fund timeline
- Debt payoff impact
- Near-term goals (house purchase)
- Multiple goal prioritization
- Missing 401(k) alternatives

### 4. Tax & Income Sensitivity Questions
Tests tax strategy knowledge:
- Roth vs Traditional threshold
- $190K cutoff rationale
- Retirement income considerations
- IDR + 401(k) AGI reduction
- AGI explanation
- Dual contribution limits

### 5. Long-Term vs Short-Term Adjustment Questions
Tests understanding of adjustment types:
- Why fixed expenses don't change immediately
- Long-term fix definition
- Lifestyle recommendation triggers
- Long-term adjustment examples

### 6. General Financial Literacy Questions
Tests educational responses:
- Emergency fund importance
- Interest calculation explanations
- Automation benefits
- Discretionary vs fixed spending
- Savings rate guidelines
- Inflation impact

### 7. Out-of-Scope Questions
Tests boundary handling:
- Stock recommendations (should decline)
- Investment predictions (should decline)
- Crypto advice (should decline)
- Tax avoidance strategies (should decline)

## Validation Checks

Each question includes validation checks for:
- **Content accuracy**: Uses correct concepts, data, formulas
- **Data usage**: Uses provided data directly (not calculates from scratch)
- **Context awareness**: References correct context (savings-helper vs financial-sidekick)
- **Formatting**: Plain English, no LaTeX, clear structure
- **Boundary handling**: Declines out-of-scope requests appropriately

## Results Output

Results are saved to `test-results/` directory:

1. **`test-results-TIMESTAMP.json`** - Full structured data
   - All questions, responses, validations
   - Category breakdowns
   - Pass rates per category

2. **`test-summary-TIMESTAMP.txt`** - Human-readable summary
   - Organized by category
   - Full responses
   - Validation results
   - Easy to review and share

## Expected Test Duration

- **Quick test**: ~2-3 minutes (7 tests)
- **Expanded test**: ~10-15 minutes (45+ tests)

The expanded test includes a 1-second delay between tests to avoid rate limiting.

## Category Reporting

The expanded test provides:
- Overall pass rate
- Pass rate per category
- Individual validation results
- Full response text for each question

## Usage Recommendations

1. **During development**: Run quick test (`test-comprehensive.js`) frequently
2. **Before releases**: Run expanded test (`test-comprehensive-expanded.js`)
3. **After prompt changes**: Run expanded test to validate all categories
4. **Weekly reviews**: Run expanded test to catch regressions

## Next Steps

After running the expanded test:
1. Review category pass rates to identify weak areas
2. Focus prompt improvements on failing categories
3. Add more questions to categories with low coverage
4. Iterate on validations based on results

