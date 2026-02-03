/**
 * Test Script for LLM Chat Scenarios
 * 
 * Tests various scenarios from the test plan to validate prompt implementation
 */

interface TestScenario {
  name: string;
  description: string;
  userPlanData: any;
  questions: string[];
  context?: string;
  expectedKeywords?: string[];
}

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

async function testChatScenario(scenario: TestScenario) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: ${scenario.name}`);
  console.log(`Description: ${scenario.description}`);
  console.log(`${'='.repeat(80)}\n`);

  for (const question of scenario.questions) {
    console.log(`\n📝 Question: "${question}"\n`);
    
    try {
      const response = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              id: '1',
              text: question,
              isUser: true,
              timestamp: new Date().toISOString(),
            },
          ],
          context: scenario.context || 'financial-sidekick',
          userPlanData: scenario.userPlanData,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`❌ Error (${response.status}): ${errorText}\n`);
        continue;
      }

      const data = await response.json();
      
      if (data.error) {
        console.log(`❌ API Error: ${data.error}\n`);
        continue;
      }

      const answer = data.response || 'No response';
      console.log(`✅ Answer:\n${answer}\n`);

      // Check for expected keywords if provided
      if (scenario.expectedKeywords && scenario.expectedKeywords.length > 0) {
        const foundKeywords = scenario.expectedKeywords.filter(keyword =>
          answer.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (foundKeywords.length > 0) {
          console.log(`✓ Found keywords: ${foundKeywords.join(', ')}`);
        }
        
        const missingKeywords = scenario.expectedKeywords.filter(
          keyword => !answer.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (missingKeywords.length > 0) {
          console.log(`⚠ Missing keywords: ${missingKeywords.join(', ')}`);
        }
      }

      // Check for forbidden closing phrases
      const forbiddenPhrases = [
        'if you have any other questions',
        'feel free to ask',
        'just let me know',
        'i\'m here to help',
      ];
      
      const foundForbidden = forbiddenPhrases.filter(phrase =>
        answer.toLowerCase().includes(phrase)
      );
      
      if (foundForbidden.length > 0) {
        console.log(`❌ Found forbidden closing phrase(s): ${foundForbidden.join(', ')}`);
      } else {
        console.log(`✓ No forbidden closing phrases found`);
      }

    } catch (error) {
      console.log(`❌ Request failed: ${error}\n`);
    }
  }
}

// Test Scenarios from the test plan

const scenarios: TestScenario[] = [
  // Case 1: Basic Income Allocation (Savings gap fix)
  {
    name: 'Case 1: Basic Income Allocation with Savings Gap',
    description: 'Income $4,000/mo; Targets 50/30/20; Actuals: Needs 58%, Wants 25%, Savings 17%; Shift_Limit 4%',
    context: 'monthly-plan-design',
    userPlanData: {
      monthlyIncome: 4000,
      monthlyNeeds: 2320, // 58%
      monthlyWants: 1000, // 25%
      monthlySavings: 680, // 17%
      savingsRate: 0.17,
      actualSpending: {
        needsPct: 0.58,
        wantsPct: 0.25,
        savingsPct: 0.17,
        monthlyNeeds: 2320,
        monthlyWants: 1000,
        monthlySavings: 680,
      },
      planData: {
        planNeeds: 2000, // 50%
        planWants: 1200, // 30%
        planSavings: 800, // 20%
      },
    },
    questions: [
      'How will you allocate my next paycheck?',
      'What does it mean to keep current allocations?',
      'If my actual savings rate is lower than my target, what happens?',
    ],
    expectedKeywords: ['3-month', 'shift', 'wants', 'savings', 'needs'],
  },

  // Case 4: Bonus routing through Savings Priority Stack
  {
    name: 'Case 4: Bonus Allocation ($5,000 bonus)',
    description: 'Bonus $5,000; EF target $10k, current $6k; High-APR debt $1,200 @ 22%; Match already captured',
    context: 'financial-sidekick',
    userPlanData: {
      monthlyIncome: 5000,
      monthlySavings: 1000,
      savingsRate: 0.20,
      emergencyFund: {
        current: 6000,
        target: 10000,
        monthsTarget: 3,
        monthsToTarget: 4,
      },
      debtBreakdown: [
        {
          name: 'Credit Card',
          balance: 1200,
          apr: 22,
          minPayment: 50,
        },
      ],
      debtTotal: 1200,
      monthlyDebtPayments: 50,
      savingsAllocation: {
        total: 1000,
        emergencyFund: { amount: 400, percent: 40 },
        debtPayoff: { amount: 0, percent: 0 },
        match401k: { amount: 300, percent: 30 },
        retirementTaxAdv: { amount: 200, percent: 20 },
        brokerage: { amount: 100, percent: 10 },
      },
      safetyStrategy: {
        liquidity: 'Medium',
        retirementFocus: 'High',
        emergencyFundTargetMonths: 3,
      },
    },
    questions: [
      'I just got a $5,000 bonus. How should we allocate it?',
      'How much should I put in my emergency fund versus debt?',
      'Why do you prioritize high-interest debt after the emergency fund?',
    ],
    expectedKeywords: ['emergency fund', '40%', 'debt', 'apr', 'priority'],
  },

  // Case 5: IDR loan effect → Prefer Traditional 401(k)
  {
    name: 'Case 5: IDR Loan Exception (Traditional 401k)',
    description: 'Income $120k; On IDR; No EF gap; No high-APR debt; Match already captured',
    context: 'financial-sidekick',
    userPlanData: {
      monthlyIncome: 10000, // $120k annual
      monthlySavings: 2000,
      savingsRate: 0.20,
      emergencyFund: {
        current: 15000,
        target: 15000,
        monthsTarget: 3,
        monthsToTarget: 0,
      },
      debtBreakdown: [
        {
          name: 'Student Loan',
          balance: 25000,
          apr: 5.5,
          minPayment: 200,
        },
      ],
      debtTotal: 25000,
      monthlyDebtPayments: 200,
      savingsAllocation: {
        total: 2000,
        emergencyFund: { amount: 0, percent: 0 },
        debtPayoff: { amount: 0, percent: 0 },
        match401k: { amount: 500, percent: 25 },
        retirementTaxAdv: { amount: 1000, percent: 50 },
        brokerage: { amount: 500, percent: 25 },
      },
      safetyStrategy: {
        liquidity: 'Medium',
        retirementFocus: 'Medium',
        onIDR: true, // KEY: User is on IDR
      },
    },
    questions: [
      'Should I focus on Roth or 401(k) for retirement?',
      'If I\'m on an IDR loan plan, which account type should I prioritize?',
      'What does reducing AGI mean for my student loans?',
    ],
    expectedKeywords: ['traditional', '401k', 'agi', 'idr', 'lower'],
  },

  // Income Allocation Questions
  {
    name: 'Income Allocation Questions',
    description: 'General questions about income allocation logic',
    context: 'monthly-plan-design',
    userPlanData: {
      monthlyIncome: 4000,
      monthlyNeeds: 2200,
      monthlyWants: 1200,
      monthlySavings: 600,
      savingsRate: 0.15,
      actualSpending: {
        needsPct: 0.55,
        wantsPct: 0.30,
        savingsPct: 0.15,
      },
      planData: {
        planNeeds: 2000,
        planWants: 1200,
        planSavings: 800,
      },
    },
    questions: [
      'How should I divide my paycheck between needs, wants, and savings?',
      'Can you explain the logic behind the 3-month average actuals?',
      'What is the shift limit and how does it protect me from drastic changes?',
      'What happens if my income changes next month?',
    ],
    expectedKeywords: ['needs', 'wants', 'savings', '3-month', 'average'],
  },

  // Out-of-scope Question (Case 12)
  {
    name: 'Case 12: Out-of-Scope Question',
    description: 'Should decline politely for speculative investment questions',
    context: 'financial-sidekick',
    userPlanData: {
      monthlyIncome: 5000,
      monthlySavings: 1000,
      savingsRate: 0.20,
    },
    questions: [
      'Which crypto will 10× next year?',
      'Should I buy Tesla stock instead of contributing to my 401(k)?',
      'Can you predict which investment will perform best next year?',
    ],
    expectedKeywords: ['allocation', 'strategy'], // Should NOT recommend specific investments
  },

  // Savings Allocation - Emergency Fund vs Debt
  {
    name: 'Savings Allocation: EF vs Debt Priority',
    description: 'Testing priority stack understanding',
    context: 'savings-plan',
    userPlanData: {
      monthlyIncome: 4000,
      monthlySavings: 800,
      savingsRate: 0.20,
      emergencyFund: {
        current: 5000,
        target: 12000,
        monthsTarget: 3,
        monthsToTarget: 9,
      },
      debtBreakdown: [
        {
          name: 'Credit Card',
          balance: 3000,
          apr: 24,
          minPayment: 150,
        },
      ],
      debtTotal: 3000,
      monthlyDebtPayments: 150,
      savingsAllocation: {
        total: 800,
        emergencyFund: { amount: 320, percent: 40 },
        debtPayoff: { amount: 280, percent: 35 },
        match401k: { amount: 120, percent: 15 },
        retirementTaxAdv: { amount: 60, percent: 7.5 },
        brokerage: { amount: 20, percent: 2.5 },
      },
    },
    questions: [
      'How much should I put in my emergency fund versus debt?',
      'What does it mean to capture the full employer match?',
      'How do you split my remaining savings between retirement and brokerage?',
    ],
    expectedKeywords: ['emergency fund', 'priority', 'debt', 'match'],
  },
];

async function runAllTests() {
  console.log('🧪 Starting LLM Chat Scenario Tests\n');
  console.log(`Testing against: ${BASE_URL}\n`);

  for (const scenario of scenarios) {
    await testChatScenario(scenario);
    
    // Small delay between scenarios to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('✅ All tests completed!');
  console.log(`${'='.repeat(80)}\n`);
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

export { runAllTests, testChatScenario, scenarios };

