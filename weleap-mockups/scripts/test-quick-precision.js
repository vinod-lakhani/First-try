/**
 * Quick precision test focusing on calculation accuracy
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

async function testPrecision(question, userPlanData, context, expectedResult) {
  try {
    console.log(`\n📝 Question: "${question}"`);
    console.log(`Expected: ${expectedResult}\n`);
    
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
      console.log(`❌ Error (${response.status})\n`);
      return null;
    }

    const data = await response.json();
    
    if (data.error) {
      console.log(`❌ API Error: ${data.error}\n`);
      return null;
    }

    const answer = data.response || 'No response';
    
    // Check for verification (total sum)
    const hasVerification = answer.includes('=') && (answer.includes('$4,000') || answer.includes('$5,000'));
    const hasCorrectTotal = answer.includes('= $4,000') || answer.includes('= $5,000') || answer.includes('= $4,000 ✓') || answer.includes('= $5,000 ✓');
    
    // Extract numbers
    const numbers = answer.match(/\$[\d,]+/g) || [];
    
    console.log(`✅ Answer:\n${answer.substring(0, 800)}${answer.length > 800 ? '...' : ''}\n`);
    
    console.log(`🔍 Precision Check:`);
    console.log(`  ${hasVerification ? '✅' : '❌'} Shows calculation verification`);
    console.log(`  ${hasCorrectTotal ? '✅' : '❌'} Total sum is correct`);
    console.log(`  Found ${numbers.length} dollar amounts in response`);
    
    return { answer, hasVerification, hasCorrectTotal, numbers };
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}\n`);
    return null;
  }
}

async function runPrecisionTests() {
  console.log('🧪 Precision Test - Calculation Accuracy\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  // Test 1: Exact income allocation
  console.log('='.repeat(80));
  console.log('PRECISION TEST 1: Income Allocation - Exact Numbers');
  console.log('='.repeat(80));
  
  await testPrecision(
    'How will you allocate my next paycheck? Show me the exact dollar breakdown with the total verified.',
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
        monthlyNeeds: 2320,
        monthlyWants: 1000,
        monthlySavings: 680,
      },
      planData: {
        planNeeds: 2000,
        planWants: 1200,
        planSavings: 800,
      },
    },
    'monthly-plan-design',
    'Needs: $2,320, Wants: $880, Savings: $800, Total: $4,000'
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Bonus allocation with exact breakdown
  console.log('\n' + '='.repeat(80));
  console.log('PRECISION TEST 2: Bonus Allocation - Step-by-Step');
  console.log('='.repeat(80));
  
  await testPrecision(
    'I got a $5,000 bonus. Show me the exact allocation breakdown with totals verified.',
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
    'financial-sidekick',
    'EF: $2,000 + Debt: $1,200 + Retirement: $1,260 + Brokerage: $540 = $5,000'
  );

  console.log('\n' + '='.repeat(80));
  console.log('✅ Precision tests completed!');
  console.log('='.repeat(80) + '\n');
}

runPrecisionTests().catch(console.error);

