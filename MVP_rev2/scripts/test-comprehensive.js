/**
 * Comprehensive LLM Test Suite
 * 
 * Tests based on:
 * 1. Real user questions from production logs
 * 2. New features (net worth breakdowns, asset-specific questions)
 * 3. Savings-helper context scenarios
 * 4. Formatting and calculation quality
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

// Mock user plan data with net worth projections and asset breakdowns
const mockUserPlanData = {
  monthlyIncome: 8680,
  actuals3m: {
    needsPct: 0.60,
    wantsPct: 0.255,
    savingsPct: 0.145,
  },
  currentPlan: {
    needsPct: 0.475,
    wantsPct: 0.36,
    savingsPct: 0.165,
  },
  recommendedPlan: {
    needsPct: 0.47,
    wantsPct: 0.33,
    savingsPct: 0.20,
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
          liabilities: 0,
          netWorth: 25000,
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

async function testChat(question, userPlanData, context, validations) {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📝 Question: "${question}"`);
    console.log(`📱 Context: ${context}`);
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
      console.log(`❌ Error (${response.status}): ${errorText}\n`);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    
    if (data.error) {
      console.log(`❌ API Error: ${data.error}\n`);
      return { success: false, error: data.error };
    }

    const answer = data.response || 'No response';
    
    console.log(`✅ Answer:\n${answer}\n`);
    
    // Run validations
    const results = {
      success: true,
      question,
      context,
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
    return { success: false, error: error.message };
  }
}

async function runComprehensiveTests() {
  console.log('🧪 Comprehensive LLM Test Suite\n');
  console.log(`Base URL: ${BASE_URL}\n`);
  console.log(`📁 Results will be saved to: ${OUTPUT_DIR}\n`);
  
  const allResults = [];
  
  // ============================================================================
  // TEST GROUP 1: Real User Questions from Production
  // ============================================================================
  console.log('\n' + '#'.repeat(80));
  console.log('# TEST GROUP 1: Real User Questions from Production');
  console.log('#'.repeat(80) + '\n');
  
  // Test 1.1: Savings-helper recommended plan explanation
  allResults.push(await testChat(
    'walk me through the numbers in the recommended plan',
    {
      ...mockUserPlanData,
    },
    'savings-helper',
    {
      'Mentions Recommended Plan values': (answer) => {
        const lower = answer.toLowerCase();
        return {
          pass: lower.includes('recommended') && (lower.includes('47%') || lower.includes('47.0%') || lower.includes('$4,080')),
          message: 'Should reference Recommended Plan bar graph values, not Current Plan',
        };
      },
      'Explains income allocation (Needs/Wants/Savings)': (answer) => {
        const lower = answer.toLowerCase();
        return {
          pass: (lower.includes('needs') && lower.includes('wants') && lower.includes('savings')) ||
                (lower.includes('income allocation')),
          message: 'Should explain Needs/Wants/Savings breakdown, not savings allocation',
        };
      },
      'Uses actual dollar amounts': (answer) => {
        return {
          pass: /\$[\d,]+/.test(answer),
          message: 'Should include specific dollar amounts',
        };
      },
    }
  ));
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 1.2: Walk through numbers (savings-helper)
  allResults.push(await testChat(
    'walk me through the numbers',
    {
      ...mockUserPlanData,
    },
    'savings-helper',
    {
      'Uses Recommended Plan values': (answer) => {
        const lower = answer.toLowerCase();
        return {
          pass: lower.includes('recommended') || lower.includes('47%'),
          message: 'Should reference Recommended Plan from savings-helper',
        };
      },
    }
  ));
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // ============================================================================
  // TEST GROUP 2: Net Worth and Asset Breakdown Questions
  // ============================================================================
  console.log('\n' + '#'.repeat(80));
  console.log('# TEST GROUP 2: Net Worth and Asset Breakdown Questions');
  console.log('#'.repeat(80) + '\n');
  
  // Test 2.1: Net worth breakdown in 10 years
  allResults.push(await testChat(
    'give me a breakdown of my net worth in 10 years',
    {
      ...mockUserPlanData,
    },
    'financial-sidekick',
    {
      'Uses asset breakdown data directly': (answer) => {
        // Should reference the exact values from assetBreakdown (not calculate)
        const hasCash = /\$\s*18[,0]?[0]?[0]?[0]?/i.test(answer) || answer.includes('18000');
        const hasBrokerage = /\$\s*95[,0]?[0]?[0]?[0]?/i.test(answer) || answer.includes('95000');
        const hasRetirement = /\$\s*213[,0]?[0]?[0]?[0]?/i.test(answer) || answer.includes('213977');
        return {
          pass: hasCash || hasBrokerage || hasRetirement,
          message: 'Should use exact values from assetBreakdown data, not calculate from scratch',
        };
      },
      'Breaks down by asset type': (answer) => {
        const lower = answer.toLowerCase();
        return {
          pass: (lower.includes('cash') || lower.includes('emergency fund')) &&
                (lower.includes('brokerage') || lower.includes('brokerage account')) &&
                (lower.includes('retirement') || lower.includes('401k') || lower.includes('ira')),
          message: 'Should break down by Cash, Brokerage, Retirement',
        };
      },
      'No linear math calculations': (answer) => {
        // Should not show calculations like "11700 + (500 * 60) = 41700"
        const hasLinearMath = /\+\s*\(\s*\$\s*\d+\s*\*\s*\d+\s*\)/.test(answer);
        return {
          pass: !hasLinearMath,
          message: 'Should use provided breakdown data, not linear calculations',
        };
      },
    }
  ));
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 2.2: Asset-specific question - Cash in 5 years
  allResults.push(await testChat(
    'how much cash will I have in 5 years',
    {
      ...mockUserPlanData,
    },
    'financial-sidekick',
    {
      'Uses exact value from breakdown': (answer) => {
        // Should use $15,000 from assetBreakdown directly
        return {
          pass: /\$\s*15[,0]?[0]?[0]?[0]?/.test(answer) || answer.includes('15000'),
          message: 'Should use $15,000 from 5-year asset breakdown directly',
        };
      },
      'No manual calculation': (answer) => {
        const lower = answer.toLowerCase();
        // Should not show calculation steps
        const hasCalculation = lower.includes('calculate') || 
                              (/\d+\s*\+\s*\(\s*\d+\s*\*\s*\d+\s*\)/.test(answer));
        return {
          pass: !hasCalculation,
          message: 'Should state the value directly from breakdown, not calculate',
        };
      },
    }
  ));
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 2.3: Net worth in 5 years
  allResults.push(await testChat(
    'what will my net worth be in 5 years',
    {
      ...mockUserPlanData,
    },
    'financial-sidekick',
    {
      'Uses projection value directly': (answer) => {
        return {
          pass: /\$\s*127[,0]?[0]?[0]?[0]?/.test(answer) || answer.includes('127985'),
          message: 'Should use $127,985 from 5-year projection directly',
        };
      },
      'Mentions growth is factored in': (answer) => {
        const lower = answer.toLowerCase();
        return {
          pass: lower.includes('growth') || lower.includes('compound') || 
                lower.includes('return') || lower.includes('projection'),
          message: 'Should mention that growth/returns are already factored in',
        };
      },
    }
  ));
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // ============================================================================
  // TEST GROUP 3: Growth-Aware Calculations
  // ============================================================================
  console.log('\n' + '#'.repeat(80));
  console.log('# TEST GROUP 3: Growth-Aware Calculations');
  console.log('#'.repeat(80) + '\n');
  
  // Test 3.1: Additional savings impact (with growth)
  allResults.push(await testChat(
    'what can I do to increase my net worth by an additional $100,000 in 5 years',
    {
      ...mockUserPlanData,
    },
    'financial-sidekick',
    {
      'Uses growth formulas (not linear)': (answer) => {
        const lower = answer.toLowerCase();
        // Should mention compound growth, not just "$100k / 60 months"
        const mentionsGrowth = lower.includes('growth') || 
                              lower.includes('compound') || 
                              lower.includes('return') ||
                              lower.includes('9%') || lower.includes('8.5%') || lower.includes('4%');
        const isLinear = /\$\s*100[,0]?[0]?[0]?[0]?\s*\/\s*\d+/.test(answer);
        return {
          pass: mentionsGrowth && !isLinear,
          message: 'Should factor in growth rates, not use simple division',
        };
      },
      'Shows growth-adjusted impact': (answer) => {
        // Should show that with growth, monthly savings needed is less than linear
        const mentionsImpact = /\$\s*\d+[,0]?[0]?[0]?[0]?\s*per\s*month/i.test(answer) || 
                              /\$\s*\d+[,0]?[0]?[0]?[0]?\s*monthly/i.test(answer);
        return {
          pass: mentionsImpact,
          message: 'Should show monthly savings needed with growth factored in',
        };
      },
    }
  ));
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // ============================================================================
  // TEST GROUP 4: Formatting Quality
  // ============================================================================
  console.log('\n' + '#'.repeat(80));
  console.log('# TEST GROUP 4: Formatting Quality');
  console.log('#'.repeat(80) + '\n');
  
  // Test 4.1: Response formatting
  allResults.push(await testChat(
    'walk me through your recommended plan',
    {
      ...mockUserPlanData,
    },
    'savings-helper',
    {
      'Uses plain English (not LaTeX)': (answer) => {
        const hasLatex = /\\\[|\\\(|\$\$|\\begin\{|\\end\{/.test(answer);
        return {
          pass: !hasLatex,
          message: 'Should use plain English, not LaTeX formulas',
        };
      },
      'Uses bold numbers or bullet points': (answer) => {
        const hasBold = /\*\*[^*]+\*\*/.test(answer) || /\[bold\]/i.test(answer);
        const hasBullets = /^[\s]*[-*•]\s/m.test(answer);
        return {
          pass: hasBold || hasBullets,
          message: 'Should use bold text or bullet points for clarity',
        };
      },
    }
  ));
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
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
  
  console.log(`📊 Tests Run: ${totalTests}`);
  console.log(`✅ Validations Passed: ${passedValidations}/${totalValidations}`);
  console.log(`📈 Pass Rate: ${passRate}%\n`);
  
  // Save detailed results to JSON
  const detailedResults = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    summary: {
      totalTests,
      passedValidations,
      totalValidations,
      passRate: `${passRate}%`,
    },
    results: allResults,
  };
  
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(detailedResults, null, 2));
  console.log(`💾 Detailed results saved to: ${RESULTS_FILE}\n`);
  
  // Save human-readable summary
  let summaryText = '='.repeat(80) + '\n';
  summaryText += 'COMPREHENSIVE LLM TEST RESULTS\n';
  summaryText += '='.repeat(80) + '\n';
  summaryText += `Timestamp: ${detailedResults.timestamp}\n`;
  summaryText += `Base URL: ${BASE_URL}\n`;
  summaryText += `\nSummary:\n`;
  summaryText += `  Tests Run: ${totalTests}\n`;
  summaryText += `  Validations Passed: ${passedValidations}/${totalValidations}\n`;
  summaryText += `  Pass Rate: ${passRate}%\n`;
  summaryText += '\n' + '='.repeat(80) + '\n\n';
  
  allResults.forEach((result, index) => {
    if (!result.success) {
      summaryText += `\n❌ TEST ${index + 1}: FAILED\n`;
      summaryText += `   Error: ${result.error || 'Unknown error'}\n`;
      return;
    }
    
    summaryText += `\n${'='.repeat(80)}\n`;
    summaryText += `TEST ${index + 1}: ${result.question || 'Unknown'}\n`;
    summaryText += `Context: ${result.context || 'N/A'}\n`;
    summaryText += `${'='.repeat(80)}\n\n`;
    
    if (result.answer) {
      summaryText += 'Question:\n';
      summaryText += `"${result.question || 'N/A'}"\n\n`;
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

