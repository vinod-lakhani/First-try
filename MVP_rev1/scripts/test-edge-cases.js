/**
 * Edge Case Tests for LLM Chat Scenarios
 * Based on test cases from PROMPT_REVIEW_AND_RECOMMENDATIONS.md
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

async function testChat(question, userPlanData, context = 'financial-sidekick', description) {
  try {
    console.log(`\n📝 Question: "${question}"`);
    if (description) {
      console.log(`   Context: ${description}\n`);
    } else {
      console.log();
    }
    
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
    
    const hasForbidden = foundForbidden.length > 0;
    
    // Truncate long answers for readability
    const displayAnswer = answer.length > 500 
      ? answer.substring(0, 500) + '...' 
      : answer;
    
    console.log(`✅ Answer (${hasForbidden ? '⚠️ HAS FORBIDDEN PHRASE' : '✓ CLEAN'}):`);
    console.log(`${displayAnswer}\n`);
    
    if (hasForbidden) {
      console.log(`❌ Found forbidden phrase(s): ${foundForbidden.join(', ')}\n`);
    }
    
    return { answer, hasForbidden };
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}\n`);
    return null;
  }
}

async function runEdgeCaseTests() {
  console.log('🧪 Edge Case Tests for LLM Chat Scenarios\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  // Case 2: Wants too low to close gap
  console.log('='.repeat(80));
  console.log('EDGE CASE 1: Wants Too Low to Close Savings Gap');
  console.log('='.repeat(80));
  console.log('Scenario: Savings already at target, or wants too low to shift more');
  
  await testChat(
    'Can you hit my 25% savings target this month?',
    {
      monthlyIncome: 3000,
      monthlyNeeds: 1860, // 62%
      monthlyWants: 540, // 18%
      monthlySavings: 600, // 20% (already at target)
      savingsRate: 0.20,
      actualSpending: {
        needsPct: 0.62,
        wantsPct: 0.18,
        savingsPct: 0.20,
      },
      planData: {
        planNeeds: 1500, // 50%
        planWants: 900, // 30%
        planSavings: 600, // 20%
      },
    },
    'monthly-plan-design',
    'Income $3,000; Actuals: Needs 62%, Wants 18%, Savings 20% (at target); Trying to reach 25%'
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Case 3: Income change mid-month
  console.log('='.repeat(80));
  console.log('EDGE CASE 2: Income Change Mid-Month');
  console.log('='.repeat(80));
  console.log('Scenario: Income drops from $5,500 to $4,800');
  
  await testChat(
    'My income is dropping from $5,500 to $4,800 next month. What changes in my allocations?',
    {
      monthlyIncome: 4800, // New income
      monthlyNeeds: 2750, // Old needs from $5,500
      monthlyWants: 1650, // Old wants from $5,500
      monthlySavings: 1100, // Old savings from $5,500
      actualSpending: {
        needsPct: 0.50,
        wantsPct: 0.30,
        savingsPct: 0.20,
      },
      planData: {
        planNeeds: 2400, // 50% of $4,800
        planWants: 1440, // 30% of $4,800
        planSavings: 960, // 20% of $4,800
      },
    },
    'financial-sidekick',
    'Income changes require recalculation of all dollar targets as % of new income'
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Case 6: Roth eligibility phase-out
  console.log('='.repeat(80));
  console.log('EDGE CASE 3: Roth IRA Eligibility Phase-Out');
  console.log('='.repeat(80));
  console.log('Scenario: Income $230k single (over Roth limit)');
  
  await testChat(
    'Can I contribute to a Roth IRA? My income is $230,000 per year.',
    {
      monthlyIncome: 19167, // $230k annual
      monthlySavings: 2000,
      safetyStrategy: {
        liquidity: 'Low',
        retirementFocus: 'High',
        onIDR: false,
      },
    },
    'financial-sidekick',
    'Income over Roth IRA phase-out limit ($146k single)'
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Case 7: Wants spike this month
  console.log('='.repeat(80));
  console.log('EDGE CASE 4: Single Month Wants Spike');
  console.log('='.repeat(80));
  console.log('Scenario: User overspent on travel this month, but 3-month avg is normal');
  
  await testChat(
    'I overspent on travel this month and spent 40% on wants. How do we adjust?',
    {
      monthlyIncome: 3500,
      monthlyNeeds: 1750, // 50%
      monthlyWants: 1400, // 40% this month spike
      monthlySavings: 350, // 10%
      actualSpending: {
        needsPct: 0.50,
        wantsPct: 0.32, // 3-month average (not 40% spike)
        savingsPct: 0.18,
        monthlyNeeds: 1750,
        monthlyWants: 1120, // 3-month average
        monthlySavings: 630,
      },
      planData: {
        planNeeds: 1750, // 50%
        planWants: 1050, // 30%
        planSavings: 700, // 20%
      },
    },
    'monthly-plan-design',
    'Single month spike should use 3-month average, not current month'
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Case 8: EF first with small budget
  console.log('='.repeat(80));
  console.log('EDGE CASE 5: Small Savings Budget with Large EF Gap');
  console.log('='.repeat(80));
  console.log('Scenario: Only $300/month savings but $5,000 EF gap and $2,000 high-APR debt');
  
  await testChat(
    'I only have $300 per month to save. Where should it go?',
    {
      monthlyIncome: 3000,
      monthlySavings: 300,
      savingsRate: 0.10,
      emergencyFund: {
        current: 1000,
        target: 6000, // $5k gap
        monthsTarget: 3,
        monthsToTarget: 17,
      },
      debtBreakdown: [
        {
          name: 'Credit Card',
          balance: 2000,
          apr: 24,
          minPayment: 80,
        },
      ],
      debtTotal: 2000,
      monthlyDebtPayments: 80,
      savingsAllocation: {
        total: 300,
        emergencyFund: { amount: 120, percent: 40 },
        debtPayoff: { amount: 72, percent: 24 },
        match401k: { amount: 0, percent: 0 },
        retirementTaxAdv: { amount: 54, percent: 18 },
        brokerage: { amount: 54, percent: 18 },
      },
      safetyStrategy: {
        liquidity: 'Medium',
        retirementFocus: 'Medium',
      },
    },
    'savings-plan',
    'Small budget must be split across priorities (EF, debt, retirement)'
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Case 9: Liquidity priority (near-term purchase)
  console.log('='.repeat(80));
  console.log('EDGE CASE 6: High Liquidity Need (Near-Term Purchase)');
  console.log('='.repeat(80));
  console.log('Scenario: User wants cash for car in 9 months, high liquidity need');
  
  await testChat(
    'I want to save cash for a car purchase in 9 months. How should I adjust my savings allocation?',
    {
      monthlyIncome: 8000, // $95k annual
      monthlySavings: 1600,
      savingsRate: 0.20,
      emergencyFund: {
        current: 12000,
        target: 12000, // No gap
        monthsTarget: 3,
        monthsToTarget: 0,
      },
      debtBreakdown: [],
      debtTotal: 0,
      savingsAllocation: {
        total: 1600,
      },
      safetyStrategy: {
        liquidity: 'High', // KEY: High liquidity need
        retirementFocus: 'Medium',
      },
    },
    'savings-plan',
    'High liquidity should favor brokerage over retirement'
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Case 10: Annual cap nearing
  console.log('='.repeat(80));
  console.log('EDGE CASE 7: Approaching IRA Contribution Limit');
  console.log('='.repeat(80));
  console.log('Scenario: $5,500 contributed, $6,500 limit, $1,000 more to allocate');
  
  await testChat(
    'I\'ve already contributed $5,500 to my IRA this year. The limit is $6,500. I have $1,000 more to allocate this month. What should I do?',
    {
      monthlyIncome: 6000,
      monthlySavings: 1500,
      savingsRate: 0.25,
      emergencyFund: {
        current: 15000,
        target: 15000,
        monthsTarget: 3,
        monthsToTarget: 0,
      },
      safetyStrategy: {
        liquidity: 'Low',
        retirementFocus: 'High',
      },
      // Note: Would need IRA room data in real implementation
    },
    'financial-sidekick',
    'Should allocate $1,000 to IRA (within limit) and route overflow to 401k'
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Case 11: Long-term needs over target
  console.log('='.repeat(80));
  console.log('EDGE CASE 8: Long-Term Needs Over Target (Lifestyle Nudge)');
  console.log('='.repeat(80));
  console.log('Scenario: Needs 56-60% for 4 consecutive months');
  
  await testChat(
    'Why do you keep telling me to cut rent? My needs are 58% of my income.',
    {
      monthlyIncome: 4000,
      monthlyNeeds: 2320, // 58%
      monthlyWants: 1000, // 25%
      monthlySavings: 680, // 17%
      actualSpending: {
        needsPct: 0.58,
        wantsPct: 0.25,
        savingsPct: 0.17,
      },
      planData: {
        planNeeds: 2000, // 50% target
        planWants: 1200,
        planSavings: 800,
      },
    },
    'monthly-plan-design',
    'Needs over target for 3+ months should trigger lifestyle change suggestions'
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Additional edge case: No employer match available
  console.log('='.repeat(80));
  console.log('EDGE CASE 9: No Employer 401(k) Match Available');
  console.log('='.repeat(80));
  console.log('Scenario: Employer doesn\'t offer 401k match');
  
  await testChat(
    'My employer doesn\'t offer a 401(k) match. What\'s my next best option for retirement savings?',
    {
      monthlyIncome: 5000,
      monthlySavings: 1000,
      emergencyFund: {
        current: 10000,
        target: 10000,
        monthsTarget: 3,
      },
      debtBreakdown: [],
      debtTotal: 0,
      savingsAllocation: {
        total: 1000,
        match401k: { amount: 0, percent: 0 }, // No match
      },
      safetyStrategy: {
        liquidity: 'Medium',
        retirementFocus: 'High',
        onIDR: false,
      },
    },
    'savings-plan',
    'Should recommend IRA or 401k beyond match as next priority'
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Additional edge case: Multiple high-APR debts
  console.log('='.repeat(80));
  console.log('EDGE CASE 10: Multiple High-APR Debts');
  console.log('='.repeat(80));
  console.log('Scenario: Multiple credit cards with different APRs, need to prioritize');
  
  await testChat(
    'I have three credit cards: $2,000 at 24% APR, $1,500 at 20% APR, and $1,000 at 18% APR. How should I prioritize paying them off?',
    {
      monthlyIncome: 4000,
      monthlySavings: 500,
      debtBreakdown: [
        {
          name: 'Credit Card A',
          balance: 2000,
          apr: 24,
          minPayment: 100,
        },
        {
          name: 'Credit Card B',
          balance: 1500,
          apr: 20,
          minPayment: 75,
        },
        {
          name: 'Credit Card C',
          balance: 1000,
          apr: 18,
          minPayment: 50,
        },
      ],
      debtTotal: 4500,
      monthlyDebtPayments: 225,
      savingsAllocation: {
        total: 500,
        debtPayoff: { amount: 200, percent: 40 },
      },
    },
    'savings-plan',
    'Should prioritize highest APR first (avalanche method)'
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Additional edge case: Income exactly at Roth cutoff
  console.log('='.repeat(80));
  console.log('EDGE CASE 11: Income Exactly at Roth Cutoff ($190k)');
  console.log('='.repeat(80));
  console.log('Scenario: Income exactly $190,000 (threshold for Roth vs Traditional)');
  
  await testChat(
    'I make exactly $190,000 per year. Should I choose Roth or Traditional 401(k)?',
    {
      monthlyIncome: 15833, // $190k annual
      safetyStrategy: {
        onIDR: false,
      },
    },
    'financial-sidekick',
    'At exactly $190k, should recommend Traditional (>= threshold)'
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Additional edge case: Zero savings
  console.log('='.repeat(80));
  console.log('EDGE CASE 12: Zero or Negative Savings');
  console.log('='.repeat(80));
  console.log('Scenario: Spending exceeds income, negative savings');
  
  await testChat(
    'I\'m spending more than I make. My savings is negative. What should I do?',
    {
      monthlyIncome: 3000,
      monthlyNeeds: 1800,
      monthlyWants: 1500,
      monthlySavings: -300, // Negative
      savingsRate: -0.10,
      actualSpending: {
        needsPct: 0.60,
        wantsPct: 0.50,
        savingsPct: -0.10,
      },
      planData: {
        planNeeds: 1500,
        planWants: 900,
        planSavings: 600,
      },
    },
    'monthly-plan-current',
    'Should suggest reducing expenses, starting with wants, and explain urgency'
  );

  console.log('\n' + '='.repeat(80));
  console.log('✅ All edge case tests completed!');
  console.log('='.repeat(80) + '\n');
  
  console.log('📊 Summary:');
  console.log('- Tested 12 edge case scenarios');
  console.log('- Covered: income changes, eligibility limits, small budgets,');
  console.log('  multiple debts, boundary conditions, and error cases');
  console.log('- Check responses above for forbidden phrases and accuracy\n');
}

runEdgeCaseTests().catch(console.error);

