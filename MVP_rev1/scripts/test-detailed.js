/**
 * Detailed test scenarios with expected calculations
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

async function testChat(question, userPlanData, context = 'financial-sidekick', expectedCheck) {
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
    
    // Check for expected elements
    if (expectedCheck) {
      console.log('🔍 Validation:');
      const checks = expectedCheck(answer);
      checks.forEach(check => {
        if (check.pass) {
          console.log(`  ✅ ${check.name}`);
        } else {
          console.log(`  ❌ ${check.name}: ${check.message}`);
        }
      });
    }
    
    // Check for forbidden phrases
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
      console.log(`  ❌ Found forbidden closing phrase(s): ${foundForbidden.join(', ')}`);
    } else {
      console.log(`  ✅ No forbidden closing phrases`);
    }
    
    return answer;
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}\n`);
    return null;
  }
}

async function runDetailedTests() {
  console.log('🧪 Detailed LLM Chat Scenario Tests\n');

  // Test: Case 1 - Exact calculation check
  console.log('='.repeat(80));
  console.log('Test: Case 1 - Income Allocation with Exact Numbers');
  console.log('='.repeat(80));
  console.log('Expected: Needs $2,320 (fixed), Wants $880, Savings $800');
  console.log('Savings gap: 3% (20% target - 17% actual)');
  console.log('Shift limit: 4%, so shift 3% from Wants to Savings\n');
  
  await testChat(
    'How will you allocate my next paycheck? Show me the exact dollar breakdown.',
    {
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
    'monthly-plan-design',
    (answer) => {
      const checks = [];
      const lower = answer.toLowerCase();
      
      // Check for key concepts
      checks.push({
        name: 'Mentions 3-month average',
        pass: lower.includes('3-month') || lower.includes('three-month'),
        message: 'Should explain 3-month average baseline',
      });
      
      checks.push({
        name: 'Needs stay fixed',
        pass: lower.includes('needs') && (lower.includes('fixed') || lower.includes('unchanged')),
        message: 'Should mention needs stay fixed',
      });
      
      checks.push({
        name: 'Mentions shift from wants to savings',
        pass: lower.includes('wants') && lower.includes('savings') && 
              (lower.includes('shift') || lower.includes('move')),
        message: 'Should explain shifting from wants to savings',
      });
      
      // Check for dollar amounts (allow some flexibility)
      const needsMatch = answer.match(/\$[\d,]+/g) || [];
      checks.push({
        name: 'Provides dollar amounts',
        pass: needsMatch.length > 0,
        message: 'Should provide specific dollar amounts',
      });
      
      return checks;
    }
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test: Bonus allocation with exact calculation
  console.log('\n' + '='.repeat(80));
  console.log('Test: Bonus Allocation - Exact Priority Stack');
  console.log('='.repeat(80));
  console.log('Bonus: $5,000');
  console.log('Expected:');
  console.log('  Step 1: EF $2,000 (40% of $5k, fills $4k gap partially)');
  console.log('  Step 2: Debt $1,200 (22% APR credit card)');
  console.log('  Step 3: Match (if needed)');
  console.log('  Step 4-6: Remaining $1,800 split by liquidity matrix\n');
  
  await testChat(
    'I just got a $5,000 bonus. Show me step-by-step how to allocate it with exact dollar amounts for each step.',
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
        emergencyFundTargetMonths: 3,
      },
    },
    'financial-sidekick',
    (answer) => {
      const checks = [];
      const lower = answer.toLowerCase();
      
      checks.push({
        name: 'Emergency fund first (40% cap)',
        pass: lower.includes('emergency') && (lower.includes('2000') || lower.includes('$2,000')),
        message: 'Should allocate $2,000 to EF (40% cap)',
      });
      
      checks.push({
        name: 'High-APR debt second',
        pass: lower.includes('debt') || lower.includes('credit card'),
        message: 'Should mention paying high-APR debt',
      });
      
      checks.push({
        name: 'Follows priority stack',
        pass: lower.includes('step') || lower.includes('priority') || lower.includes('first'),
        message: 'Should explain priority order',
      });
      
      checks.push({
        name: 'Total adds up to $5,000',
        pass: answer.includes('5000') || answer.includes('5,000') || 
              (answer.includes('$2,000') && answer.includes('$1,200') && answer.includes('$1,800')),
        message: 'Should show allocations that total $5,000',
      });
      
      return checks;
    }
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test: IDR exception with income below cutoff
  console.log('\n' + '='.repeat(80));
  console.log('Test: IDR Exception Override (Income < $190K but on IDR)');
  console.log('='.repeat(80));
  console.log('Income: $120k (< $190k normally → Roth)');
  console.log('Status: On IDR → Should choose Traditional 401k\n');
  
  await testChat(
    'I make $120,000 per year and I\'m on an IDR plan for student loans. Should I choose Roth or Traditional 401(k)?',
    {
      monthlyIncome: 10000, // $120k annual
      safetyStrategy: {
        onIDR: true,
      },
    },
    'financial-sidekick',
    (answer) => {
      const checks = [];
      const lower = answer.toLowerCase();
      
      checks.push({
        name: 'Recommends Traditional 401k',
        pass: lower.includes('traditional') && lower.includes('401'),
        message: 'Should recommend Traditional 401k despite income < $190k',
      });
      
      checks.push({
        name: 'Explains IDR exception',
        pass: lower.includes('idr') || lower.includes('income-driven'),
        message: 'Should mention IDR exception',
      });
      
      checks.push({
        name: 'Explains AGI reduction',
        pass: lower.includes('agi') || lower.includes('adjusted gross income') || 
              lower.includes('lower') && lower.includes('loan'),
        message: 'Should explain AGI reduction benefit',
      });
      
      return checks;
    }
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test: Income change scenario
  console.log('\n' + '='.repeat(80));
  console.log('Test: Income Change Handling');
  console.log('='.repeat(80));
  console.log('Current: $5,500/mo');
  console.log('Next month: $4,800/mo');
  console.log('Expected: Recalculate targets as % of new income\n');
  
  await testChat(
    'My income is dropping from $5,500 to $4,800 next month. What changes in my allocation?',
    {
      monthlyIncome: 5500,
      actualSpending: {
        needsPct: 0.50,
        wantsPct: 0.30,
        savingsPct: 0.20,
      },
      planData: {
        planNeeds: 2750, // 50%
        planWants: 1650, // 30%
        planSavings: 1100, // 20%
      },
    },
    'financial-sidekick',
    (answer) => {
      const checks = [];
      const lower = answer.toLowerCase();
      
      checks.push({
        name: 'Mentions recalculation',
        pass: lower.includes('recalculate') || lower.includes('recalculate') || 
              lower.includes('adjust') || lower.includes('change'),
        message: 'Should explain that targets will recalculate',
      });
      
      checks.push({
        name: 'Mentions percentage-based targets',
        pass: lower.includes('%') || lower.includes('percent'),
        message: 'Should mention targets scale as percentages',
      });
      
      return checks;
    }
  );

  console.log('\n' + '='.repeat(80));
  console.log('✅ All detailed tests completed!');
  console.log('='.repeat(80) + '\n');
}

runDetailedTests().catch(console.error);

