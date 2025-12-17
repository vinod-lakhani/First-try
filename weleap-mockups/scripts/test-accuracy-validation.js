/**
 * Accuracy Validation Test Suite
 * 
 * Tests specifically designed to catch the accuracy issues identified in the review:
 * 1. Calculation errors (especially the $1,500 - $11,700 = $228,300 type)
 * 2. Closing phrases violations ("Let me know if...")
 * 3. Missing 3-month average references in income allocation
 * 4. Missing savings priority stack integration
 * 5. Generic responses without user data
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const fs = require('fs');
const path = require('path');

// Output directory for test results
const OUTPUT_DIR = path.join(process.cwd(), 'test-results');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const RESULTS_FILE = path.join(OUTPUT_DIR, `accuracy-validation-${TIMESTAMP}.json`);
const SUMMARY_FILE = path.join(OUTPUT_DIR, `accuracy-validation-summary-${TIMESTAMP}.txt`);

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Mock user plan data matching the production scenario
const mockUserPlanData = {
  monthlyIncome: 8680,
  annualIncome: 104160,
  actuals3m: {
    needsPct: 0.33,
    wantsPct: 0.276,
    savingsPct: 0.393,
    monthlyNeeds: 2868,
    monthlyWants: 2400,
    monthlySavings: 3412,
  },
  currentPlan: {
    needsPct: 0.33,
    wantsPct: 0.276,
    savingsPct: 0.393,
    monthlyNeeds: 2868,
    monthlyWants: 2400,
    monthlySavings: 3412,
  },
  targets: {
    needsPct: 0.50,
    wantsPct: 0.30,
    savingsPct: 0.20,
  },
  shiftLimitPct: 4.0,
  emergencyFund: {
    current: 11700,
    target: 12000,
    monthsTarget: 3,
    gap: 300,
  },
  debtBreakdown: [],
  debtTotal: 0,
  monthlyDebtPayments: 0,
  savingsAllocation: {
    total: 3412,
    emergencyFund: { amount: 300, percent: 8.8 },
    debtPayoff: { amount: 0, percent: 0 },
    match401k: { amount: 0, percent: 0 },
    retirementTaxAdv: { amount: 0, percent: 0 },
  },
  safetyStrategy: {
    liquidity: 'Medium',
    retirementFocus: 'High',
    onIDR: false,
  },
};

// Test cases based on actual production questions with accuracy issues
const testCases = [
  {
    id: 'calc-error-down-payment',
    name: 'Calculation Error - Down Payment Savings',
    question: "I don't think I can afford to save 3.4k a month for my down payment because this is my entire saving and investing category. Give me something a little more reasonable with what I can reduce from my \"wants\" spending",
    context: 'financial-sidekick',
    validations: [
      {
        type: 'no_calculation_error',
        description: 'Should not have calculation error like "$1,500 - $11,700 = $228,300"',
        check: (response) => {
          // Check for the specific error pattern
          const errorPattern = /\$\d+[\s,]*-\s*\$\d+[\s,]*=\s*\$\d{5,}/;
          if (errorPattern.test(response)) {
            return {
              pass: false,
              message: 'Found calculation error pattern (subtracting current savings from monthly target)',
            };
          }
          return { pass: true };
        },
      },
      {
        type: 'correct_time_calculation',
        description: 'Time to save calculation should be: (Target - Current) / Monthly = Months',
        check: (response) => {
          // Should show correct formula: ($240,000 - $11,700) / monthly = months
          const hasCorrectFormula = /\(\$240,000\s*-\s*\$11,700\)|240,000.*11,700.*÷|240,000.*11,700.*\/|228,300.*÷|228,300.*\//.test(response);
          if (!hasCorrectFormula && response.includes('240,000') && response.includes('11,700')) {
            return {
              pass: false,
              message: 'Missing correct time calculation formula: (Target - Current) / Monthly',
            };
          }
          return { pass: true };
        },
      },
      {
        type: 'mentions_shift_limit',
        description: 'Should mention 4% shift limit when suggesting wants reduction',
        check: (response) => {
          const hasShiftLimit = /4%|four percent|shift limit/i.test(response);
          if (!hasShiftLimit && (response.includes('wants') || response.includes('reduce'))) {
            return {
              pass: false,
              message: 'Should mention 4% shift limit when suggesting wants reduction',
            };
          }
          return { pass: true };
        },
      },
      {
        type: 'uses_3month_average',
        description: 'Should reference 3-month average when discussing income allocation',
        check: (response) => {
          const has3Month = /3-month|three-month|3 month|three month|actuals3m/i.test(response);
          if (!has3Month && (response.includes('wants') || response.includes('needs') || response.includes('allocation'))) {
            return {
              pass: false,
              message: 'Should reference 3-month average when discussing income allocation',
            };
          }
          return { pass: true };
        },
      },
      {
        type: 'verifies_totals',
        description: 'Should verify that Needs + Wants + Savings = Income',
        check: (response) => {
          const hasVerification = /Total.*=.*\$|Needs.*Wants.*Savings.*=.*\$|✓|check/i.test(response);
          if (!hasVerification && (response.includes('$2,868') || response.includes('$2,400') || response.includes('$3,412'))) {
            return {
              pass: false,
              message: 'Should verify totals: Needs + Wants + Savings = Income',
            };
          }
          return { pass: true };
        },
      },
      {
        type: 'no_closing_phrase',
        description: 'Should not end with closing phrases like "Let me know if..."',
        check: (response) => {
          const closingPhrases = [
            /let me know if/i,
            /if you need/i,
            /if you'd like/i,
            /feel free to/i,
            /i'm here to/i,
            /if you have/i,
            /further assistance/i,
            /further details/i,
            /other questions/i,
          ];
          const lastSentence = response.trim().split(/[.!?]\s+/).pop() || '';
          for (const phrase of closingPhrases) {
            if (phrase.test(lastSentence)) {
              return {
                pass: false,
                message: `Found closing phrase: "${lastSentence}"`,
              };
            }
          }
          return { pass: true };
        },
      },
    ],
  },
  {
    id: 'down-payment-priority-stack',
    name: 'Down Payment - Savings Priority Stack Integration',
    question: "I'm living in the Bay Area, when would I be able to to buy a house or apartment? Nothing fancy, just an average starter home. I also don't know how much I should be saving every month so that I have enough to pay for the down payment",
    context: 'financial-sidekick',
    validations: [
      {
        type: 'mentions_priority_stack',
        description: 'Should explain how down payment fits into savings allocation priority stack',
        check: (response) => {
          const hasPriorityStack = /priority|EF.*Debt.*Match|Emergency Fund.*Debt|allocation.*priority|brokerage/i.test(response);
          if (!hasPriorityStack && (response.includes('down payment') || response.includes('saving'))) {
            return {
              pass: false,
              message: 'Should explain how down payment fits into savings allocation priority stack',
            };
          }
          return { pass: true };
        },
      },
      {
        type: 'shows_allocation_breakdown',
        description: 'Should show full savings allocation breakdown when relevant',
        check: (response) => {
          // Should show how $3,412 monthly savings is allocated
          const hasBreakdown = /\$3,412|EF.*Debt.*Retirement|allocation.*breakdown/i.test(response);
          if (response.includes('$3,412') && !hasBreakdown) {
            return {
              pass: false,
              message: 'Should show full savings allocation breakdown when discussing monthly savings',
            };
          }
          return { pass: true };
        },
      },
      {
        type: 'no_closing_phrase',
        description: 'Should not end with closing phrases',
        check: (response) => {
          const closingPhrases = [
            /let me know if/i,
            /if you need/i,
            /further assistance/i,
          ];
          const lastSentence = response.trim().split(/[.!?]\s+/).pop() || '';
          for (const phrase of closingPhrases) {
            if (phrase.test(lastSentence)) {
              return {
                pass: false,
                message: `Found closing phrase: "${lastSentence}"`,
              };
            }
          }
          return { pass: true };
        },
      },
    ],
  },
  {
    id: 'comparison-user-data',
    name: 'Comparison Question - Use Actual User Data',
    question: 'Am I on track compared to other people my age?',
    context: 'financial-sidekick',
    validations: [
      {
        type: 'uses_actual_data',
        description: 'Should use actual user data (savings, income) to calculate metrics',
        check: (response) => {
          // Should mention actual dollar amounts or calculate months of salary
          const hasActualData = /\$11,700|\$104,160|\$8,680|months of salary|months.*income/i.test(response);
          if (!hasActualData) {
            return {
              pass: false,
              message: 'Should use actual user data (savings $11,700, income) to calculate metrics',
            };
          }
          return { pass: true };
        },
      },
      {
        type: 'calculates_metrics',
        description: 'Should calculate specific metrics like "months of salary saved"',
        check: (response) => {
          const hasMetrics = /months.*salary|months.*income|salary.*saved|benchmark/i.test(response);
          if (!hasMetrics && response.includes('on track')) {
            return {
              pass: false,
              message: 'Should calculate specific metrics like months of salary saved',
            };
          }
          return { pass: true };
        },
      },
      {
        type: 'no_closing_phrase',
        description: 'Should not end with closing phrases',
        check: (response) => {
          const closingPhrases = [
            /let me know if/i,
            /if you need/i,
            /further assistance/i,
          ];
          const lastSentence = response.trim().split(/[.!?]\s+/).pop() || '';
          for (const phrase of closingPhrases) {
            if (phrase.test(lastSentence)) {
              return {
                pass: false,
                message: `Found closing phrase: "${lastSentence}"`,
              };
            }
          }
          return { pass: true };
        },
      },
    ],
  },
  {
    id: 'add-down-payment-plan',
    name: 'Add Down Payment Plan - Priority Stack',
    question: 'Can you add this down payment savings plan to my financial plan?',
    context: 'financial-sidekick',
    validations: [
      {
        type: 'mentions_priority_stack',
        description: 'Should explain how down payment fits into savings allocation',
        check: (response) => {
          const hasPriorityStack = /priority|allocation|EF.*Debt|brokerage/i.test(response);
          if (!hasPriorityStack && response.includes('down payment')) {
            return {
              pass: false,
              message: 'Should explain how down payment fits into savings allocation priority stack',
            };
          }
          return { pass: true };
        },
      },
      {
        type: 'no_closing_phrase',
        description: 'Should not end with closing phrases',
        check: (response) => {
          const closingPhrases = [
            /let me know if/i,
            /if you need/i,
            /further details/i,
          ];
          const lastSentence = response.trim().split(/[.!?]\s+/).pop() || '';
          for (const phrase of closingPhrases) {
            if (phrase.test(lastSentence)) {
              return {
                pass: false,
                message: `Found closing phrase: "${lastSentence}"`,
              };
            }
          }
          return { pass: true };
        },
      },
    ],
  },
  {
    id: 'down-payment-timeline',
    name: 'Down Payment Timeline - Correct Calculation',
    question: "If I'm saving 2k per month for my down payment, then when can I buy a house? Also where should this money exist while I'm saving it, in a bank account, in the stock market, high yield savings account, ETF, etc?",
    context: 'financial-sidekick',
    validations: [
      {
        type: 'correct_calculation',
        description: 'Time calculation should be correct: ($240,000 - $11,700) / $2,000 = 114 months',
        check: (response) => {
          // Should show 114 months or 9.5 years
          const hasCorrectTime = /114.*months|9\.5.*years|9.*years.*6.*months/i.test(response);
          const hasCalculation = /228,300.*÷|228,300.*\/|240,000.*11,700/i.test(response);
          if (!hasCorrectTime && !hasCalculation && response.includes('$2,000')) {
            return {
              pass: false,
              message: 'Should show correct calculation: ($240,000 - $11,700) / $2,000 = 114 months (9.5 years)',
            };
          }
          return { pass: true };
        },
      },
      {
        type: 'no_closing_phrase',
        description: 'Should not end with closing phrases',
        check: (response) => {
          const closingPhrases = [
            /let me know if/i,
            /if you need/i,
            /further details/i,
          ];
          const lastSentence = response.trim().split(/[.!?]\s+/).pop() || '';
          for (const phrase of closingPhrases) {
            if (phrase.test(lastSentence)) {
              return {
                pass: false,
                message: `Found closing phrase: "${lastSentence}"`,
              };
            }
          }
          return { pass: true };
        },
      },
    ],
  },
];

// Run a single test case
async function runTest(testCase) {
  console.log(`\n🧪 Testing: ${testCase.name}`);
  console.log(`   Question: ${testCase.question.substring(0, 80)}...`);

  try {
    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            text: testCase.question,
            isUser: true,
          },
        ],
        context: testCase.context,
        userPlanData: mockUserPlanData,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const responseText = data.response || '';

    // Run all validations
    const validationResults = testCase.validations.map((validation) => {
      const result = validation.check(responseText);
      return {
        type: validation.type,
        description: validation.description,
        pass: result.pass,
        message: result.message || null,
      };
    });

    const passed = validationResults.filter((v) => v.pass).length;
    const total = validationResults.length;

    return {
      id: testCase.id,
      name: testCase.name,
      question: testCase.question,
      response: responseText,
      validations: validationResults,
      passed,
      total,
      allPassed: passed === total,
    };
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return {
      id: testCase.id,
      name: testCase.name,
      question: testCase.question,
      error: error.message,
      validations: [],
      passed: 0,
      total: testCase.validations.length,
      allPassed: false,
    };
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Accuracy Validation Tests');
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Test cases: ${testCases.length}`);

  const results = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    totalTests: testCases.length,
    testResults: [],
  };

  for (const testCase of testCases) {
    const result = await runTest(testCase);
    results.testResults.push(result);

    // Print immediate feedback
    if (result.allPassed) {
      console.log(`   ✅ PASSED: ${result.passed}/${result.total} validations`);
    } else {
      console.log(`   ❌ FAILED: ${result.passed}/${result.total} validations`);
      result.validations
        .filter((v) => !v.pass)
        .forEach((v) => {
          console.log(`      - ${v.type}: ${v.message || v.description}`);
        });
    }

    // Small delay between tests
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Calculate summary
  const passedTests = results.testResults.filter((r) => r.allPassed).length;
  const totalValidations = results.testResults.reduce((sum, r) => sum + r.total, 0);
  const passedValidations = results.testResults.reduce((sum, r) => sum + r.passed, 0);

  results.summary = {
    passedTests,
    totalTests: testCases.length,
    passedValidations,
    totalValidations,
    passRate: ((passedValidations / totalValidations) * 100).toFixed(1) + '%',
  };

  // Save results
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  console.log(`\n📊 Results saved to: ${RESULTS_FILE}`);

  // Generate summary
  let summary = `Accuracy Validation Test Results\n`;
  summary += `=====================================\n\n`;
  summary += `Timestamp: ${results.timestamp}\n`;
  summary += `Base URL: ${results.baseUrl}\n\n`;
  summary += `Summary:\n`;
  summary += `  Tests Passed: ${passedTests}/${testCases.length}\n`;
  summary += `  Validations Passed: ${passedValidations}/${totalValidations} (${results.summary.passRate})\n\n`;

  summary += `Test Results:\n`;
  summary += `${'='.repeat(80)}\n\n`;

  results.testResults.forEach((result) => {
    summary += `${result.allPassed ? '✅' : '❌'} ${result.name}\n`;
    summary += `   Question: ${result.question.substring(0, 100)}...\n`;
    if (result.error) {
      summary += `   Error: ${result.error}\n`;
    } else {
      summary += `   Validations: ${result.passed}/${result.total}\n`;
      result.validations
        .filter((v) => !v.pass)
        .forEach((v) => {
          summary += `      ❌ ${v.type}: ${v.message || v.description}\n`;
        });
    }
    summary += `\n`;
  });

  fs.writeFileSync(SUMMARY_FILE, summary);
  console.log(`📄 Summary saved to: ${SUMMARY_FILE}`);

  // Print final summary
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Final Summary:`);
  console.log(`  Tests Passed: ${passedTests}/${testCases.length}`);
  console.log(`  Validations Passed: ${passedValidations}/${totalValidations} (${results.summary.passRate})`);
  console.log(`${'='.repeat(80)}\n`);

  return results;
}

// Run if executed directly
if (require.main === module) {
  runAllTests()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runAllTests, testCases };

