/**
 * Simple Node.js test script for chat API
 * Run with: node scripts/test-chat.js
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

async function testChat(question, userPlanData, context = 'financial-sidekick') {
  try {
    console.log(`\n📝 Question: "${question}"\n`);
    
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
        context: context,
        userPlanData: userPlanData,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Error (${response.status}): ${errorText}\n`);
      return null;
    }

    const data = await response.json();
    
    if (data.error) {
      console.log(`❌ API Error: ${data.error}\n`);
      return null;
    }

    const answer = data.response || 'No response';
    console.log(`✅ Answer:\n${answer}\n`);
    
    return answer;
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}\n`);
    return null;
  }
}

async function runTests() {
  console.log('🧪 Testing LLM Chat Scenarios\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  // Test 1: Basic Income Allocation
  console.log('='.repeat(80));
  console.log('Test 1: Basic Income Allocation with Savings Gap');
  console.log('='.repeat(80));
  
  await testChat(
    'How will you allocate my next paycheck?',
    {
      monthlyIncome: 4000,
      monthlyNeeds: 2320,
      monthlyWants: 1000,
      monthlySavings: 680,
      savingsRate: 0.17,
      actualSpending: {
        needsPct: 0.58,
        wantsPct: 0.25,
        savingsPct: 0.17,
      },
      planData: {
        planNeeds: 2000,
        planWants: 1200,
        planSavings: 800,
      },
    },
    'monthly-plan-design'
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Bonus Allocation
  console.log('='.repeat(80));
  console.log('Test 2: Bonus Allocation ($5,000)');
  console.log('='.repeat(80));
  
  await testChat(
    'I just got a $5,000 bonus. How should we allocate it?',
    {
      monthlyIncome: 5000,
      monthlySavings: 1000,
      emergencyFund: {
        current: 6000,
        target: 10000,
        monthsTarget: 3,
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
      savingsAllocation: {
        total: 1000,
      },
      safetyStrategy: {
        liquidity: 'Medium',
        retirementFocus: 'High',
      },
    },
    'financial-sidekick'
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 3: IDR Exception
  console.log('='.repeat(80));
  console.log('Test 3: IDR Loan Exception (Traditional 401k)');
  console.log('='.repeat(80));
  
  await testChat(
    'Should I focus on Roth or 401(k) for retirement? I\'m on an IDR plan for student loans.',
    {
      monthlyIncome: 10000, // $120k annual
      monthlySavings: 2000,
      safetyStrategy: {
        onIDR: true, // KEY: User is on IDR
        liquidity: 'Medium',
        retirementFocus: 'Medium',
      },
    },
    'financial-sidekick'
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 4: Out-of-Scope
  console.log('='.repeat(80));
  console.log('Test 4: Out-of-Scope Question (Should Decline)');
  console.log('='.repeat(80));
  
  await testChat(
    'Which crypto will 10× next year?',
    {
      monthlyIncome: 5000,
      monthlySavings: 1000,
    },
    'financial-sidekick'
  );

  console.log('\n' + '='.repeat(80));
  console.log('✅ All tests completed!');
  console.log('='.repeat(80) + '\n');
}

// Check if fetch is available (Node 18+)
if (typeof fetch === 'undefined') {
  console.error('❌ Error: fetch is not available. Please use Node.js 18+ or install node-fetch');
  process.exit(1);
}

runTests().catch(console.error);

