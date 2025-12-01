/**
 * Comprehensive LLM Test Suite - Expanded
 * 
 * Tests based on:
 * 1. Real user questions from production logs
 * 2. Comprehensive question set covering all scenarios
 * 3. New features (net worth breakdowns, asset-specific questions)
 * 4. Savings-helper context scenarios
 * 5. Formatting and calculation quality
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const fs = require('fs');
const path = require('path');

// Output directory for test results
const OUTPUT_DIR = path.join(process.cwd(), 'test-results');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const RESULTS_FILE = path.join(OUTPUT_DIR, `test-results-${TIMESTAMP}.json`);
const SUMMARY_FILE = path.join(OUTPUT_DIR, `test-summary-${TIMESTAMP}.txt`);

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Mock user plan data with comprehensive financial information
const mockUserPlanData = {
  monthlyIncome: 8680,
  annualIncome: 104160,
  actuals3m: {
    needsPct: 0.60,
    wantsPct: 0.255,
    savingsPct: 0.145,
    monthlyNeeds: 5208,
    monthlyWants: 2213,
    monthlySavings: 1259,
  },
  currentPlan: {
    needsPct: 0.475,
    wantsPct: 0.36,
    savingsPct: 0.165,
    monthlyNeeds: 4123,
    monthlyWants: 3125,
    monthlySavings: 1432,
  },
  recommendedPlan: {
    needsPct: 0.47,
    wantsPct: 0.33,
    savingsPct: 0.20,
    monthlyNeeds: 4080,
    monthlyWants: 2864,
    monthlySavings: 1736,
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
  debtBreakdown: [
    {
      name: 'Chase Credit Card',
      balance: 3500,
      apr: 22.99,
      minPayment: 80,
    },
    {
      name: 'Amex Credit Card',
      balance: 1200,
      apr: 18.5,
      minPayment: 50,
    },
  ],
  debtTotal: 4700,
  monthlyDebtPayments: 130,
  savingsAllocation: {
    total: 1432,
    emergencyFund: { amount: 300, percent: 20.9 },
    debtPayoff: { amount: 383, percent: 26.7 },
    match401k: { amount: 575, percent: 40.1 },
    retirementTaxAdv: { amount: 174, percent: 12.2 },
  },
  safetyStrategy: {
    liquidity: 'Medium',
    retirementFocus: 'High',
    onIDR: false,
  },
  retirementAccounts: {
    has401k: true,
    employerMatch: { percent: 6, max: 575 },
    iraLimit: 6500,
    iraContributed: 0,
  },
  netWorth: {
    projections: [
      {
        label: 'Today',
        months: 0,
        value: 25000,
        assetBreakdown: {
          cash: 11700,
          brokerage: 5000,
          retirement: 8300,
          totalAssets: 25000,
          liabilities: 4700,
          netWorth: 20300,
        },
      },
      {
        label: '5 Years',
        months: 60,
        value: 127985,
        assetBreakdown: {
          cash: 15000,
          brokerage: 35000,
          retirement: 77985,
          totalAssets: 127985,
          liabilities: 0,
          netWorth: 127985,
        },
      },
      {
        label: '10 Years',
        months: 120,
        value: 326977,
        assetBreakdown: {
          cash: 18000,
          brokerage: 95000,
          retirement: 213977,
          totalAssets: 326977,
          liabilities: 0,
          netWorth: 326977,
        },
      },
    ],
  },
  savingsHelperBarGraphs: {
    actuals3m: { needsPct: 0.60, wantsPct: 0.255, savingsPct: 0.145 },
    currentPlan: { needsPct: 0.475, wantsPct: 0.36, savingsPct: 0.165 },
    recommendedPlan: { needsPct: 0.47, wantsPct: 0.33, savingsPct: 0.20 },
  },
};

async function testChat(question, userPlanData, context, validations, category) {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📝 Question: "${question}"`);
    console.log(`📱 Context: ${context}`);
    if (category) console.log(`🏷️  Category: ${category}`);
    console.log(`${'='.repeat(80)}\n`);
    
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
      console.log(`❌ Error (${response.status}): ${errorText.substring(0, 200)}\n`);
      return { success: false, question, context, category, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    
    if (data.error) {
      console.log(`❌ API Error: ${data.error}\n`);
      return { success: false, question, context, category, error: data.error };
    }

    const answer = data.response || 'No response';
    
    // Truncate for console display if very long
    const displayAnswer = answer.length > 800 
      ? answer.substring(0, 800) + '...\n[Response truncated - see full response in saved files]'
      : answer;
    
    console.log(`✅ Answer:\n${displayAnswer}\n`);
    
    // Run validations
    const results = {
      success: true,
      question,
      context,
      category,
      answer,
      validations: {},
    };
    
    if (validations) {
      console.log('🔍 Validation Results:');
      for (const [name, check] of Object.entries(validations)) {
        const result = check(answer);
        results.validations[name] = result;
        
        if (result.pass) {
          console.log(`  ✅ ${name}`);
        } else {
          console.log(`  ❌ ${name}: ${result.message}`);
        }
      }
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
      console.log(`  ❌ Forbidden phrase(s) found: ${foundForbidden.join(', ')}`);
      results.validations['No Forbidden Phrases'] = {
        pass: false,
        message: `Found: ${foundForbidden.join(', ')}`,
      };
    } else {
      console.log(`  ✅ No forbidden phrases`);
      results.validations['No Forbidden Phrases'] = { pass: true };
    }
    
    // Check for LaTeX formatting (should NOT be present)
    const hasLatex = /\\\[|\\\(|\$\$|\\begin\{|\\end\{/.test(answer);
    if (hasLatex) {
      console.log(`  ❌ LaTeX formulas detected (should use plain English)`);
      results.validations['No LaTeX Formatting'] = {
        pass: false,
        message: 'LaTeX formulas found in response',
      };
    } else {
      console.log(`  ✅ No LaTeX formatting (good)`);
      results.validations['No LaTeX Formatting'] = { pass: true };
    }
    
    return results;
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}\n`);
    return { success: false, question, context, category, error: error.message };
  }
}

async function runComprehensiveTests() {
  console.log('🧪 Comprehensive LLM Test Suite - Expanded\n');
  console.log(`Base URL: ${BASE_URL}\n`);
  console.log(`📁 Results will be saved to: ${OUTPUT_DIR}\n`);
  
  const allResults = [];
  
  // ============================================================================
  // CATEGORY 1: Income Allocation Questions
  // ============================================================================
  console.log('\n' + '#'.repeat(80));
  console.log('# CATEGORY 1: Income Allocation Questions');
  console.log('#'.repeat(80) + '\n');
  
  const incomeAllocationQuestions = [
    {
      question: 'How should I divide my paycheck between needs, wants, and savings?',
      context: 'financial-sidekick',
      validations: {
        'Mentions Needs/Wants/Savings split': (a) => ({
          pass: /needs|wants|savings/i.test(a) && a.match(/%/g)?.length >= 2,
          message: 'Should explain 50/30/20 or similar allocation',
        }),
      },
    },
    {
      question: 'What does it mean to "keep current allocations"?',
      context: 'financial-sidekick',
      validations: {
        'Explains current allocations': (a) => ({
          pass: /current|existing|keep/i.test(a) && /allocation|distribution/i.test(a),
          message: 'Should explain what keeping current allocations means',
        }),
      },
    },
    {
      question: 'If my actual savings rate is lower than my target, what happens?',
      context: 'financial-sidekick',
      validations: {
        'Explains adjustment process': (a) => ({
          pass: /shift|adjust|increase|decrease/i.test(a) && /savings|target/i.test(a),
          message: 'Should explain how system adjusts when savings is below target',
        }),
      },
    },
    {
      question: 'Can you show me how my next paycheck will be allocated?',
      context: 'financial-sidekick',
      validations: {
        'Shows specific dollar amounts': (a) => ({
          pass: /\$[\d,]+/.test(a) && (/\$[\d,]+/.test(a) || /needs|wants|savings/i.test(a)),
          message: 'Should show specific dollar allocations',
        }),
      },
    },
    {
      question: 'Why is my fixed expense allocation not changing even though it\'s high?',
      context: 'financial-sidekick',
      validations: {
        'Explains fixed expenses rule': (a) => ({
          pass: /fixed|needs|essential|unchanged|stable/i.test(a),
          message: 'Should explain why fixed expenses don\'t change immediately',
        }),
      },
    },
    {
      question: 'How does the system decide how much to shift from wants to savings?',
      context: 'financial-sidekick',
      validations: {
        'Explains shift logic': (a) => ({
          pass: /shift|limit|4%/i.test(a) || /target|gap/i.test(a),
          message: 'Should explain shift limit and gap calculation',
        }),
      },
    },
    {
      question: 'Can you explain the logic behind the 3-month average actuals?',
      context: 'financial-sidekick',
      validations: {
        'Explains 3-month average': (a) => ({
          pass: /3.?month|three.?month|average|baseline/i.test(a),
          message: 'Should explain why 3-month average is used',
        }),
      },
    },
    {
      question: 'What is the shift limit and how does it protect me from drastic changes?',
      context: 'financial-sidekick',
      validations: {
        'Explains shift limit protection': (a) => {
          const lower = a.toLowerCase();
          return {
            pass: (lower.includes('shift') || lower.includes('limit')) && 
                  (lower.includes('4%') || lower.includes('four percent')) &&
                  (lower.includes('protect') || lower.includes('gradual') || lower.includes('manageable')),
            message: 'Should explain 4% shift limit and its protective purpose',
          };
        },
      },
    },
    {
      question: 'What happens if I spend more than planned on entertainment this month?',
      context: 'financial-sidekick',
      validations: {
        'Explains single-month vs average': (a) => ({
          pass: /average|baseline|3.?month/i.test(a) || /adjust|next|future/i.test(a),
          message: 'Should explain how single-month spikes are handled',
        }),
      },
    },
    {
      question: 'What happens if my income changes next month?',
      context: 'financial-sidekick',
      validations: {
        'Explains income change handling': (a) => ({
          pass: /recalculate|adjust|percent|%/i.test(a) && /income/i.test(a),
          message: 'Should explain how allocations recalculate with income changes',
        }),
      },
    },
  ];
  
  for (const test of incomeAllocationQuestions) {
    allResults.push(await testChat(
      test.question,
      mockUserPlanData,
      test.context,
      test.validations,
      'Income Allocation'
    ));
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // ============================================================================
  // CATEGORY 2: Savings Allocation Questions
  // ============================================================================
  console.log('\n' + '#'.repeat(80));
  console.log('# CATEGORY 2: Savings Allocation Questions');
  console.log('#'.repeat(80) + '\n');
  
  const savingsAllocationQuestions = [
    {
      question: 'I just got a bonus—how will you allocate it across my goals?',
      context: 'financial-sidekick',
      validations: {
        'Mentions priority stack': (a) => ({
          pass: /emergency|debt|401k|retirement|priority|step/i.test(a),
          message: 'Should explain priority order (EF → Debt → 401k → Retirement)',
        }),
      },
    },
    {
      question: 'How much should I put in my emergency fund versus debt?',
      context: 'financial-sidekick',
      validations: {
        'Explains EF vs debt priority': (a) => ({
          pass: /emergency|fund/i.test(a) && /debt/i.test(a) && 
                (/first|priority|before|then/i.test(a) || /gap|target/i.test(a)),
          message: 'Should explain emergency fund comes before debt',
        }),
      },
    },
    {
      question: 'Why do you prioritize high-interest debt after the emergency fund?',
      context: 'financial-sidekick',
      validations: {
        'Explains debt prioritization logic': (a) => ({
          pass: /apr|interest|rate|high/i.test(a) && /debt/i.test(a),
          message: 'Should explain high-APR debt prioritization',
        }),
      },
    },
    {
      question: 'What does it mean to "capture the full employer match"?',
      context: 'financial-sidekick',
      validations: {
        'Explains employer match': (a) => ({
          pass: /employer|match|401k|free.?money/i.test(a),
          message: 'Should explain employer match concept',
        }),
      },
    },
    {
      question: 'Should I focus on Roth or 401(k) for retirement?',
      context: 'financial-sidekick',
      validations: {
        'Provides retirement account recommendation': (a) => ({
          pass: /roth|traditional|401k/i.test(a) && 
                (/income|tax|agi/i.test(a) || /recommend|should/i.test(a)),
          message: 'Should recommend based on income/tax situation',
        }),
      },
    },
    {
      question: 'If I\'m on an IDR loan plan, which account type should I prioritize?',
      context: 'financial-sidekick',
      validations: {
        'Recommends Traditional for IDR': (a) => {
          const lower = a.toLowerCase();
          return {
            pass: /idr|income.?driven/i.test(lower) && 
                  (/traditional|401k/i.test(lower) || /agi|reduce/i.test(lower)),
            message: 'Should recommend Traditional 401k for IDR users',
          };
        },
      },
    },
    {
      question: 'How do you split my remaining savings between retirement and brokerage?',
      context: 'financial-sidekick',
      validations: {
        'Explains retirement vs brokerage split': (a) => ({
          pass: /retirement|brokerage/i.test(a) && 
                (/liquidity|tax|time|horizon/i.test(a) || /percent|split/i.test(a)),
          message: 'Should explain factors in retirement vs brokerage allocation',
        }),
      },
    },
    {
      question: 'What happens if I already reached my IRA contribution limit?',
      context: 'financial-sidekick',
      validations: {
        'Explains IRA limit handling': (a) => ({
          pass: /ira|limit|6500/i.test(a) && 
                (/401k|brokerage|next/i.test(a) || /overflow/i.test(a)),
          message: 'Should explain what happens after IRA limit is reached',
        }),
      },
    },
    {
      question: 'Can you show me an example allocation for my $1,500 monthly savings budget?',
      context: 'financial-sidekick',
      validations: {
        'Shows specific allocation breakdown': (a) => ({
          pass: /\$[\d,]+/.test(a) && 
                (/emergency|debt|401k|retirement|brokerage/i.test(a) || /\d+%/.test(a)),
          message: 'Should show dollar or percentage breakdown of $1,500',
        }),
      },
    },
    {
      question: 'What if I want to increase my liquidity—how will the allocation change?',
      context: 'financial-sidekick',
      validations: {
        'Explains liquidity impact': (a) => {
          const lower = a.toLowerCase();
          return {
            pass: /liquidity|cash|accessible/i.test(lower) && 
                  (/brokerage|emergency/i.test(lower) || /change|adjust/i.test(lower)),
            message: 'Should explain how liquidity preference affects allocation',
          };
        },
      },
    },
    {
      question: 'Help me figure out how much I can save',
      context: 'financial-sidekick',
      validations: {
        'Explains current savings capacity': (a) => {
          const lower = a.toLowerCase();
          return {
            pass: /\$[\d,]+/.test(a) && /month|monthly|save/i.test(lower),
            message: 'Should explain current savings amount and capacity',
          };
        },
        'Shows allocation breakdown': (a) => {
          const lower = a.toLowerCase();
          return {
            pass: /needs|wants|savings/i.test(lower) && (/%/i.test(a) || /\$/i.test(a)),
            message: 'Should show current allocation breakdown',
          };
        },
      },
    },
  ];
  
  for (const test of savingsAllocationQuestions) {
    allResults.push(await testChat(
      test.question,
      mockUserPlanData,
      test.context,
      test.validations,
      'Savings Allocation'
    ));
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // ============================================================================
  // CATEGORY 3: Goal-Based & Scenario Questions
  // ============================================================================
  console.log('\n' + '#'.repeat(80));
  console.log('# CATEGORY 3: Goal-Based & Scenario Questions');
  console.log('#'.repeat(80) + '\n');
  
  const goalBasedQuestions = [
    {
      question: 'I want to build a 3-month emergency fund in 6 months—how much should I save each month?',
      context: 'financial-sidekick',
      validations: {
        'Calculates monthly savings needed': (a) => ({
          pass: /\$[\d,]+/.test(a) && /month|monthly/i.test(a) && 
                (/emergency|fund/i.test(a) || /\d+ months/i.test(a)),
          message: 'Should calculate monthly savings needed for EF goal',
        }),
      },
    },
    {
      question: 'How would paying off my credit card faster affect my investment plan?',
      context: 'financial-sidekick',
      validations: {
        'Explains debt payoff impact': (a) => ({
          pass: /debt|credit.?card/i.test(a) && 
                (/investment|retirement|brokerage/i.test(a) || /free.?up|available/i.test(a)),
          message: 'Should explain how debt payoff frees up money for investments',
        }),
      },
    },
    {
      question: 'I want to buy a house in two years—how should my savings priorities change?',
      context: 'financial-sidekick',
      validations: {
        'Discusses near-term goal adjustments': (a) => ({
          pass: /house|down.?payment/i.test(a) && 
                (/liquidity|cash|brokerage/i.test(a) || /priority|change/i.test(a)),
          message: 'Should discuss liquidity needs for near-term house purchase',
        }),
      },
    },
    {
      question: 'If I have multiple goals, how do you decide which one gets funded first?',
      context: 'financial-sidekick',
      validations: {
        'Explains priority ordering': (a) => ({
          pass: /priority|order|first|then|step/i.test(a) && 
                (/goal/i.test(a) || /emergency|debt|retirement/i.test(a)),
          message: 'Should explain how multiple goals are prioritized',
        }),
      },
    },
    {
      question: 'What if my employer doesn\'t offer a 401(k)? What\'s my next best option?',
      context: 'financial-sidekick',
      validations: {
        'Recommends IRA alternative': (a) => ({
          pass: /ira|roth|retirement/i.test(a) && 
                (/401k|employer/i.test(a) || /alternative|next/i.test(a)),
          message: 'Should recommend IRA or other retirement options',
        }),
      },
    },
    {
      question: 'I want to save 2000 in the next 2 month',
      context: 'financial-sidekick',
      validations: {
        'Calculates monthly savings needed': (a) => ({
          pass: /\$[\d,]+/.test(a) && /month|monthly/i.test(a) && 
                (/2000|\$2,000|two thousand/i.test(a) || /\$1,000|\$1000/i.test(a)),
          message: 'Should calculate monthly savings needed ($1,000/month for $2,000 in 2 months)',
        }),
        'Discusses plan adjustments': (a) => ({
          pass: /current|plan|allocation|adjust|need|wants/i.test(a),
          message: 'Should discuss how to adjust current plan to meet savings goal',
        }),
      },
    },
  ];
  
  for (const test of goalBasedQuestions) {
    allResults.push(await testChat(
      test.question,
      mockUserPlanData,
      test.context,
      test.validations,
      'Goal-Based & Scenario'
    ));
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // ============================================================================
  // CATEGORY 4: Tax & Income Sensitivity Questions
  // ============================================================================
  console.log('\n' + '#'.repeat(80));
  console.log('# CATEGORY 4: Tax & Income Sensitivity Questions');
  console.log('#'.repeat(80) + '\n');
  
  const taxQuestions = [
    {
      question: 'At what income should I switch from Roth to 401(k)?',
      context: 'financial-sidekick',
      validations: {
        'Mentions income threshold': (a) => ({
          pass: /\$[\d,]+|190/i.test(a) || /threshold|cutoff/i.test(a),
          message: 'Should mention $190k threshold or similar',
        }),
      },
    },
    {
      question: 'Why does the system use $190K as the cutoff for Roth IRA?',
      context: 'financial-sidekick',
      validations: {
        'Explains Roth cutoff rationale': (a) => ({
          pass: /190|roth|cutoff|limit/i.test(a) && 
                (/tax|bracket|phase.?out/i.test(a) || /benefit/i.test(a)),
          message: 'Should explain tax reasoning for $190k cutoff',
        }),
      },
    },
    {
      question: 'What if I expect to make less money in retirement?',
      context: 'financial-sidekick',
      validations: {
        'Discusses tax strategy for lower retirement income': (a) => ({
          pass: /retirement|income/i.test(a) && 
                (/roth|traditional|tax/i.test(a) || /benefit/i.test(a)),
          message: 'Should discuss tax implications for retirement income',
        }),
      },
    },
    {
      question: 'Can you explain why 401(k) helps with student loans under IDR?',
      context: 'financial-sidekick',
      validations: {
        'Explains AGI reduction for IDR': (a) => {
          const lower = a.toLowerCase();
          return {
            pass: /agi|adjusted.?gross|idr|income.?driven/i.test(lower) && 
                  (/401k|traditional|reduce|lower/i.test(lower) || /payment|loan/i.test(lower)),
            message: 'Should explain how 401k reduces AGI and IDR payments',
          };
        },
      },
    },
    {
      question: 'What does "reduces AGI" mean in simple terms?',
      context: 'financial-sidekick',
      validations: {
        'Explains AGI in simple terms': (a) => ({
          pass: /agi|adjusted.?gross|income/i.test(a) && 
                (/tax|report|reduces|lower/i.test(a) || /simple/i.test(a)),
          message: 'Should explain AGI in accessible language',
        }),
      },
    },
    {
      question: 'Can I contribute to both Roth and 401(k) in the same year?',
      context: 'financial-sidekick',
      validations: {
        'Explains contribution limits': (a) => ({
          pass: /roth|401k/i.test(a) && 
                (/yes|can|both/i.test(a) || /limit|contribution/i.test(a)),
          message: 'Should explain that both can be contributed to (with limits)',
        }),
      },
    },
  ];
  
  for (const test of taxQuestions) {
    allResults.push(await testChat(
      test.question,
      mockUserPlanData,
      test.context,
      test.validations,
      'Tax & Income Sensitivity'
    ));
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // ============================================================================
  // CATEGORY 5: Long-Term vs Short-Term Adjustment Questions
  // ============================================================================
  console.log('\n' + '#'.repeat(80));
  console.log('# CATEGORY 5: Long-Term vs Short-Term Adjustment Questions');
  console.log('#'.repeat(80) + '\n');
  
  const adjustmentQuestions = [
    {
      question: 'Why can\'t I just reduce my rent to free up more money right now?',
      context: 'financial-sidekick',
      validations: {
        'Explains long-term vs short-term fixes': (a) => ({
          pass: /rent|fixed|needs/i.test(a) && 
                (/long.?term|short.?term|contract|lease/i.test(a) || /lifestyle/i.test(a)),
          message: 'Should explain why fixed expenses require long-term changes',
        }),
      },
    },
    {
      question: 'What does a long-term fix mean in this context?',
      context: 'financial-sidekick',
      validations: {
        'Defines long-term adjustments': (a) => ({
          pass: /long.?term/i.test(a) && 
                (/lifestyle|contract|lease|move/i.test(a) || /change|adjust/i.test(a)),
          message: 'Should explain what long-term fixes are',
        }),
      },
    },
    {
      question: 'How many months over target do I need to trigger a lifestyle recommendation?',
      context: 'financial-sidekick',
      validations: {
        'Mentions threshold for lifestyle recommendations': (a) => ({
          pass: /month|3|4/i.test(a) || /consecutive|trigger|threshold/i.test(a),
          message: 'Should mention months threshold (typically 3-4 months)',
        }),
      },
    },
    {
      question: 'What kind of actions count as long-term adjustments?',
      context: 'financial-sidekick',
      validations: {
        'Lists long-term adjustment examples': (a) => ({
          pass: /long.?term/i.test(a) && 
                (/move|rent|relocate|downsize/i.test(a) || /lifestyle/i.test(a)),
          message: 'Should give examples of long-term adjustments',
        }),
      },
    },
  ];
  
  for (const test of adjustmentQuestions) {
    allResults.push(await testChat(
      test.question,
      mockUserPlanData,
      test.context,
      test.validations,
      'Long-Term vs Short-Term Adjustment'
    ));
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // ============================================================================
  // CATEGORY 6: General Financial Literacy & Behavioral Questions
  // ============================================================================
  console.log('\n' + '#'.repeat(80));
  console.log('# CATEGORY 6: General Financial Literacy & Behavioral Questions');
  console.log('#'.repeat(80) + '\n');
  
  const literacyQuestions = [
    {
      question: 'Why is having an emergency fund so important?',
      context: 'financial-sidekick',
      validations: {
        'Explains emergency fund importance': (a) => ({
          pass: /emergency|fund/i.test(a) && 
                (/important|protect|security|unexpected/i.test(a) || /unexpected/i.test(a)),
          message: 'Should explain benefits of emergency fund',
        }),
      },
    },
    {
      question: 'How much interest am I really paying on a 20% APR credit card?',
      context: 'financial-sidekick',
      validations: {
        'Explains interest calculation': (a) => ({
          pass: /20|apr|interest/i.test(a) && 
                (/percent|compound/i.test(a) || /\$[\d,]+/.test(a)),
          message: 'Should explain interest impact on credit card debt',
        }),
      },
    },
    {
      question: 'What\'s the benefit of automating savings?',
      context: 'financial-sidekick',
      validations: {
        'Explains automation benefits': (a) => ({
          pass: /automate|automatic/i.test(a) && 
                (/consistent|habit|easy|forget/i.test(a) || /benefit/i.test(a)),
          message: 'Should explain benefits of automating savings',
        }),
      },
    },
    {
      question: 'What is the difference between discretionary and fixed spending?',
      context: 'financial-sidekick',
      validations: {
        'Explains discretionary vs fixed': (a) => ({
          pass: /discretionary|fixed/i.test(a) && 
                (/needs|wants/i.test(a) || /essential|optional/i.test(a)),
          message: 'Should explain difference between fixed and discretionary spending',
        }),
      },
    },
    {
      question: 'What\'s a good rule of thumb for monthly saving?',
      context: 'financial-sidekick',
      validations: {
        'Mentions savings rate target': (a) => ({
          pass: /20|percent|%|savings/i.test(a) || /rule|thumb|target/i.test(a),
          message: 'Should mention 20% savings rate or similar guideline',
        }),
      },
    },
    {
      question: 'How does inflation affect my savings plan?',
      context: 'financial-sidekick',
      validations: {
        'Discusses inflation impact': (a) => ({
          pass: /inflation/i.test(a) && 
                (/purchasing|power|value|growth/i.test(a) || /invest/i.test(a)),
          message: 'Should discuss how inflation affects savings',
        }),
      },
    },
  ];
  
  for (const test of literacyQuestions) {
    allResults.push(await testChat(
      test.question,
      mockUserPlanData,
      test.context,
      test.validations,
      'General Financial Literacy'
    ));
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // ============================================================================
  // CATEGORY 7: Out-of-Scope Questions (Should Decline Politely)
  // ============================================================================
  console.log('\n' + '#'.repeat(80));
  console.log('# CATEGORY 7: Out-of-Scope Questions (Should Decline Politely)');
  console.log('#'.repeat(80) + '\n');
  
  const outOfScopeQuestions = [
    {
      question: 'Should I buy Tesla stock instead of contributing to my 401(k)?',
      context: 'financial-sidekick',
      validations: {
        'Declines investment advice politely': (a) => {
          const lower = a.toLowerCase();
          return {
            pass: /can\'t|cannot|don\'t|unable|outside|scope/i.test(lower) || 
                  /focus|help|assist|budget|allocation/i.test(lower),
            message: 'Should decline specific stock recommendations politely',
          };
        },
      },
    },
    {
      question: 'Can you predict which investment will perform best next year?',
      context: 'financial-sidekick',
      validations: {
        'Declines prediction requests': (a) => {
          const lower = a.toLowerCase();
          return {
            pass: /can\'t|predict|forecast|unable/i.test(lower) || 
                  /focus|help|plan|allocation/i.test(lower),
            message: 'Should decline prediction requests',
          };
        },
      },
    },
    {
      question: 'What\'s the best crypto to invest in right now?',
      context: 'financial-sidekick',
      validations: {
        'Declines crypto recommendations': (a) => {
          const lower = a.toLowerCase();
          return {
            pass: /crypto|cryptocurrency/i.test(lower) && 
                  (/can\'t|focus|outside|scope/i.test(lower) || /budget|allocation/i.test(lower)),
            message: 'Should decline crypto investment recommendations',
          };
        },
      },
    },
    {
      question: 'Can I avoid taxes by opening an offshore account?',
      context: 'financial-sidekick',
      validations: {
        'Declines tax avoidance advice': (a) => {
          const lower = a.toLowerCase();
          return {
            pass: /tax|account/i.test(lower) && 
                  (/can\'t|unable|focus|legitimate|legal/i.test(lower) || /consult|advisor/i.test(lower)),
            message: 'Should decline tax avoidance strategies',
          };
        },
      },
    },
  ];
  
  for (const test of outOfScopeQuestions) {
    allResults.push(await testChat(
      test.question,
      mockUserPlanData,
      test.context,
      test.validations,
      'Out-of-Scope'
    ));
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\n' + '#'.repeat(80));
  console.log('# TEST SUMMARY');
  console.log('#'.repeat(80) + '\n');
  
  const totalTests = allResults.filter(r => r.success).length;
  const passedValidations = allResults
    .filter(r => r.success && r.validations)
    .flatMap(r => Object.values(r.validations))
    .filter(v => v.pass).length;
  const totalValidations = allResults
    .filter(r => r.success && r.validations)
    .flatMap(r => Object.values(r.validations)).length;
  
  const passRate = totalValidations > 0 ? ((passedValidations / totalValidations) * 100).toFixed(1) : 0;
  
  // Category breakdown
  const categoryStats = {};
  allResults.forEach(result => {
    if (result.category && result.success) {
      if (!categoryStats[result.category]) {
        categoryStats[result.category] = { total: 0, passed: 0, validations: 0 };
      }
      categoryStats[result.category].total++;
      if (result.validations) {
        const catValidations = Object.values(result.validations);
        categoryStats[result.category].validations += catValidations.length;
        categoryStats[result.category].passed += catValidations.filter(v => v.pass).length;
      }
    }
  });
  
  console.log(`📊 Tests Run: ${totalTests}`);
  console.log(`✅ Validations Passed: ${passedValidations}/${totalValidations}`);
  console.log(`📈 Pass Rate: ${passRate}%\n`);
  
  console.log('\n📋 Category Breakdown:');
  Object.entries(categoryStats).forEach(([category, stats]) => {
    const catPassRate = stats.validations > 0 
      ? ((stats.passed / stats.validations) * 100).toFixed(1) 
      : 0;
    console.log(`  ${category}: ${stats.passed}/${stats.validations} (${catPassRate}%) - ${stats.total} tests`);
  });
  
  // Save detailed results to JSON
  const detailedResults = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    summary: {
      totalTests,
      passedValidations,
      totalValidations,
      passRate: `${passRate}%`,
      categoryStats: Object.fromEntries(
        Object.entries(categoryStats).map(([cat, stats]) => [
          cat,
          {
            ...stats,
            passRate: `${stats.validations > 0 ? ((stats.passed / stats.validations) * 100).toFixed(1) : 0}%`,
          },
        ])
      ),
    },
    results: allResults,
  };
  
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(detailedResults, null, 2));
  console.log(`\n💾 Detailed results saved to: ${RESULTS_FILE}\n`);
  
  // Save human-readable summary
  let summaryText = '='.repeat(80) + '\n';
  summaryText += 'COMPREHENSIVE LLM TEST RESULTS - EXPANDED\n';
  summaryText += '='.repeat(80) + '\n';
  summaryText += `Timestamp: ${detailedResults.timestamp}\n`;
  summaryText += `Base URL: ${BASE_URL}\n`;
  summaryText += `\nSummary:\n`;
  summaryText += `  Tests Run: ${totalTests}\n`;
  summaryText += `  Validations Passed: ${passedValidations}/${totalValidations}\n`;
  summaryText += `  Pass Rate: ${passRate}%\n`;
  summaryText += '\nCategory Breakdown:\n';
  Object.entries(categoryStats).forEach(([category, stats]) => {
    const catPassRate = stats.validations > 0 
      ? ((stats.passed / stats.validations) * 100).toFixed(1) 
      : 0;
    summaryText += `  ${category}: ${stats.passed}/${stats.validations} (${catPassRate}%) - ${stats.total} tests\n`;
  });
  summaryText += '\n' + '='.repeat(80) + '\n\n';
  
  // Group by category
  const byCategory = {};
  allResults.forEach((result, index) => {
    const cat = result.category || 'Uncategorized';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push({ ...result, testNumber: index + 1 });
  });
  
  Object.entries(byCategory).forEach(([category, results]) => {
    summaryText += `\n${'='.repeat(80)}\n`;
    summaryText += `CATEGORY: ${category}\n`;
    summaryText += `${'='.repeat(80)}\n\n`;
    
    results.forEach(result => {
      if (!result.success) {
        summaryText += `\n❌ TEST ${result.testNumber}: FAILED\n`;
        summaryText += `   Question: "${result.question}"\n`;
        summaryText += `   Error: ${result.error || 'Unknown error'}\n`;
        return;
      }
      
      summaryText += `\n${'-'.repeat(80)}\n`;
      summaryText += `TEST ${result.testNumber}: ${result.question}\n`;
      summaryText += `Context: ${result.context || 'N/A'}\n`;
      summaryText += `${'-'.repeat(80)}\n\n`;
      
      if (result.answer) {
        summaryText += 'Response:\n';
        summaryText += result.answer + '\n\n';
      }
      
      if (result.validations && Object.keys(result.validations).length > 0) {
        summaryText += 'Validation Results:\n';
        Object.entries(result.validations).forEach(([name, validation]) => {
          const status = validation.pass ? '✅' : '❌';
          summaryText += `  ${status} ${name}`;
          if (!validation.pass && validation.message) {
            summaryText += `: ${validation.message}`;
          }
          summaryText += '\n';
        });
        summaryText += '\n';
      }
    });
  });
  
  summaryText += '\n' + '='.repeat(80) + '\n';
  summaryText += 'END OF TEST RESULTS\n';
  summaryText += '='.repeat(80) + '\n';
  
  fs.writeFileSync(SUMMARY_FILE, summaryText);
  console.log(`📄 Human-readable summary saved to: ${SUMMARY_FILE}\n`);
  
  console.log('='.repeat(80));
  console.log('✅ All tests completed!');
  console.log('='.repeat(80) + '\n');
  console.log(`📁 View results:`);
  console.log(`   - JSON (detailed): ${RESULTS_FILE}`);
  console.log(`   - TXT (summary): ${SUMMARY_FILE}`);
  console.log('');
}

// Check if fetch is available (Node 18+)
if (typeof fetch === 'undefined') {
  console.error('❌ Error: fetch is not available. Please use Node.js 18+ or install node-fetch');
  process.exit(1);
}

runComprehensiveTests().catch(console.error);

