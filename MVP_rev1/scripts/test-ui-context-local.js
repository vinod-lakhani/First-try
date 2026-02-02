/**
 * Test UI Context - Local API Route Test
 * 
 * Tests the full implementation through the Next.js API route
 * to verify context descriptions are being passed correctly
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

// Note: This script should use environment variables for API keys

// Mock user plan data for testing
const mockUserPlanData = {
  monthlyIncome: 8680,
  monthlyNeeds: 4268,
  monthlyWants: 1000,
  monthlySavings: 3412,
  savingsRate: 0.393,
};

// Test scenarios - focused on screen-specific guidance
const testScenarios = [
  {
    name: 'Monthly Plan Design - Slider guidance',
    context: 'monthly-plan-design',
    question: 'How do I adjust the sliders to increase my savings?',
    expectedKeywords: ['Income slider', 'Needs slider', 'Wants slider', 'Savings auto-calculated'],
  },
  {
    name: 'Savings Plan - Emergency fund',
    context: 'savings-plan',
    question: 'What does the emergency fund slider do?',
    expectedKeywords: ['Emergency Fund', 'slider', '40%', 'target months'],
  },
  {
    name: 'Savings Allocator - Debt controls',
    context: 'savings-allocator',
    question: 'Can I see details about my debt payoff?',
    expectedKeywords: ['debt details', 'expandable', 'payoff timeline', 'High-APR Debt'],
  },
  {
    name: 'Net Worth Viewer - Chart explanation',
    context: 'net-worth-viewer',
    question: 'What do the different lines on the chart mean?',
    expectedKeywords: ['Assets', 'Liabilities', 'Net Worth', '40-year'],
  },
  {
    name: 'Plan Final - Understanding milestones',
    context: 'plan-final',
    question: 'What are the milestone cards showing?',
    expectedKeywords: ['milestones', '6 months', '12 months', '24 months'],
  },
];

async function testScenario(scenario) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 Testing: ${scenario.name}`);
  console.log(`📱 Context: ${scenario.context}`);
  console.log(`❓ Question: "${scenario.question}"`);
  console.log(`${'='.repeat(80)}\n`);

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
            text: scenario.question,
            isUser: true,
            timestamp: new Date().toISOString(),
          },
        ],
        context: scenario.context,
        userPlanData: mockUserPlanData,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error (${response.status}): ${errorText}\n`);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    
    if (data.error) {
      console.error(`❌ API Error: ${data.error}\n`);
      return { success: false, error: data.error };
    }

    const aiResponse = data.response || 'No response';
    
    console.log(`\n📝 AI Response:\n${aiResponse}\n`);
    
    // Check if response mentions expected context keywords
    const responseLower = aiResponse.toLowerCase();
    const foundKeywords = scenario.expectedKeywords.filter(keyword =>
      responseLower.includes(keyword.toLowerCase())
    );
    
    const keywordScore = (foundKeywords.length / scenario.expectedKeywords.length) * 100;
    
    console.log(`✅ Context Relevance: ${keywordScore.toFixed(0)}% (found ${foundKeywords.length}/${scenario.expectedKeywords.length} keywords)`);
    if (foundKeywords.length > 0) {
      console.log(`   Found: ${foundKeywords.join(', ')}`);
    }
    if (foundKeywords.length < scenario.expectedKeywords.length) {
      const missing = scenario.expectedKeywords.filter(k => 
        !responseLower.includes(k.toLowerCase())
      );
      console.log(`   Missing: ${missing.join(', ')}`);
    }
    
    // Check for forbidden closing phrases
    const forbiddenPhrases = [
      'if you have any other questions',
      'feel free to ask',
      'just let me know',
      'i\'m here to help',
    ];
    
    const hasForbidden = forbiddenPhrases.some(phrase =>
      responseLower.includes(phrase)
    );
    
    if (hasForbidden) {
      console.log(`⚠️  WARNING: Response contains forbidden closing phrase`);
    }
    
    if (keywordScore >= 50 && !hasForbidden) {
      console.log(`✅ PASS - Response shows understanding of screen context`);
      return { success: true, keywordScore, response: aiResponse, hasForbidden };
    } else {
      console.log(`⚠️  WARNING - Response may not fully demonstrate screen context understanding`);
      return { success: true, keywordScore, response: aiResponse, warning: true, hasForbidden };
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
      console.error('   💡 Make sure the Next.js server is running: npm run dev');
    }
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('\n🚀 Starting UI Context Tests (Local API Route)\n');
  console.log(`Testing ${testScenarios.length} scenarios...`);
  console.log(`API URL: ${BASE_URL}\n`);
  
  // Check if server is reachable
  try {
    const healthCheck = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ id: '1', text: 'test', isUser: true, timestamp: new Date().toISOString() }],
        context: 'test',
      }),
    });
    
    if (!healthCheck.ok && healthCheck.status !== 400) {
      throw new Error(`Server returned ${healthCheck.status}`);
    }
  } catch (error) {
    console.error(`❌ Cannot reach server at ${BASE_URL}`);
    console.error(`   Error: ${error.message}`);
    console.error(`   💡 Make sure the Next.js server is running: npm run dev`);
    process.exit(1);
  }
  
  const results = [];
  
  for (const scenario of testScenarios) {
    const result = await testScenario(scenario);
    results.push({
      name: scenario.name,
      context: scenario.context,
      ...result,
    });
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 TEST SUMMARY`);
  console.log(`${'='.repeat(80)}\n`);
  
  const passed = results.filter(r => r.success && (!r.warning || r.keywordScore >= 50) && !r.hasForbidden);
  const warnings = results.filter(r => r.success && (r.warning || r.hasForbidden) && r.keywordScore >= 50);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Passed: ${passed.length}/${results.length}`);
  console.log(`⚠️  Warnings: ${warnings.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}\n`);
  
  if (warnings.length > 0) {
    console.log(`\n⚠️  Scenarios with warnings:`);
    warnings.forEach(r => {
      const issues = [];
      if (r.hasForbidden) issues.push('forbidden phrase');
      if (r.keywordScore < 50) issues.push(`low context (${r.keywordScore.toFixed(0)}%)`);
      console.log(`   - ${r.name}: ${issues.join(', ')}`);
    });
  }
  
  if (failed.length > 0) {
    console.log(`\n❌ Failed scenarios:`);
    failed.forEach(r => {
      console.log(`   - ${r.name}: ${r.error}`);
    });
  }
  
  const avgKeywordScore = results
    .filter(r => r.success)
    .reduce((sum, r) => sum + (r.keywordScore || 0), 0) / (results.length - failed.length);
  
  console.log(`\n📈 Average Context Relevance: ${avgKeywordScore.toFixed(0)}%\n`);
  
  if (avgKeywordScore >= 70 && passed.length === results.length) {
    console.log(`🎉 All tests passed! UI context is working correctly.`);
  }
  
  return results;
}

// Run tests
runTests()
  .then(results => {
    const allPassed = results.every(r => 
      r.success && (!r.warning || r.keywordScore >= 50) && !r.hasForbidden
    );
    process.exit(allPassed ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });

