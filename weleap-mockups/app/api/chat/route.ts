/**
 * ChatGPT API Route
 * 
 * Handles chat requests to OpenAI GPT API.
 * This should be kept secure - API keys should be stored in environment variables.
 */

import { NextRequest, NextResponse } from 'next/server';

// You'll need to install OpenAI SDK: npm install openai
// import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const { messages, context, userPlanData } = await request.json();

    // Get API key from environment variable
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Option 1: Use OpenAI SDK (recommended)
    // Uncomment this after installing: npm install openai
    /*
    const openai = new OpenAI({
      apiKey: apiKey,
    });

    // Build system prompt with context about the financial app
    const systemPrompt = buildSystemPrompt(context, userPlanData);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // or 'gpt-3.5-turbo' for lower cost
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((msg: any) => ({
          role: msg.isUser ? 'user' : 'assistant',
          content: msg.text,
        })),
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const response = completion.choices[0]?.message?.content || 'I apologize, I could not generate a response.';
    */

    // Option 2: Direct fetch to OpenAI API (if you don't want to install the SDK)
    const systemPrompt = buildSystemPrompt(context, userPlanData);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // or 'gpt-3.5-turbo' for lower cost
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((msg: any) => ({
            role: msg.isUser ? 'user' : 'assistant',
            content: msg.text,
          })),
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI API error:', error);
      return NextResponse.json(
        { error: 'Failed to get response from ChatGPT' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || 'I apologize, I could not generate a response.';

    return NextResponse.json({ response: aiResponse });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Builds a system prompt with context about the user's financial situation
 */
function buildSystemPrompt(context?: string, userPlanData?: any): string {
  let prompt = `You are Ribbit, a friendly and helpful financial assistant for the WeLeap personal finance app. 
You help users understand their financial plans, make better decisions, and answer questions about their money.

Guidelines:
- Be conversational, friendly, and encouraging
- Use simple, clear language - avoid financial jargon when possible
- If you don't know something, be honest about it
- Focus on actionable advice
- Keep responses concise (2-3 sentences when possible)
- Be supportive and non-judgmental

`;

  if (context) {
    const contextDescriptions: Record<string, string> = {
      'monthly-plan': 'The user is on the monthly plan allocation screen where they allocate their income between Needs, Wants, and Savings.',
      'monthly-plan-design': 'The user is on the monthly plan design screen where they can adjust their income allocation with sliders for Needs, Wants, and Savings. This screen shows their current spending vs recommended plan.',
      'monthly-plan-current': 'The user is viewing their current income and expense profile based on actual spending.',
      'savings-plan': 'The user is on the savings plan screen where they allocate their savings budget across emergency fund, debt payoff, retirement, and other goals.',
      'plan-final': 'The user is reviewing their final financial plan summary.',
      'financial-sidekick': 'The user is in the main app using the financial sidekick chat. They have access to their complete financial profile including income, expenses, debts, assets, goals, and spending patterns. You can help with any financial questions, planning advice, or analysis of their situation.',
    };
    
    const contextDesc = contextDescriptions[context] || `The user is on the "${context}" screen.`;
    prompt += `Current context: ${contextDesc}\n`;
    
    // Add note about transaction data availability
    if (context === 'financial-sidekick') {
      prompt += `Note: Monthly expense data is provided below. Individual transaction details are available in the app but summarized here as monthly expense categories.\n`;
    }
    prompt += `\n`;
  }

  if (userPlanData) {
    prompt += `User's financial information:\n\n`;
    
    // Income
    if (userPlanData.monthlyIncome) {
      prompt += `**Income:**\n`;
      prompt += `- Monthly income: $${Math.round(userPlanData.monthlyIncome).toLocaleString()}\n\n`;
    }

    // Expenses Breakdown
    if (userPlanData.monthlyNeeds !== undefined || userPlanData.monthlyWants !== undefined) {
      prompt += `**Monthly Spending:**\n`;
      if (userPlanData.monthlyNeeds !== undefined) {
        prompt += `- Needs (essentials): $${Math.round(userPlanData.monthlyNeeds).toLocaleString()}`;
        if (userPlanData.monthlyIncome) {
          prompt += ` (${((userPlanData.monthlyNeeds / userPlanData.monthlyIncome) * 100).toFixed(1)}% of income)`;
        }
        prompt += `\n`;
      }
      if (userPlanData.monthlyWants !== undefined) {
        prompt += `- Wants (discretionary): $${Math.round(userPlanData.monthlyWants).toLocaleString()}`;
        if (userPlanData.monthlyIncome) {
          prompt += ` (${((userPlanData.monthlyWants / userPlanData.monthlyIncome) * 100).toFixed(1)}% of income)`;
        }
        prompt += `\n`;
      }
      if (userPlanData.monthlySavings !== undefined) {
        prompt += `- Savings: $${Math.round(userPlanData.monthlySavings).toLocaleString()}`;
        if (userPlanData.monthlyIncome) {
          prompt += ` (${((userPlanData.monthlySavings / userPlanData.monthlyIncome) * 100).toFixed(1)}% of income)`;
        }
        prompt += `\n`;
      }
      prompt += `\n`;
    }

    // Expense Breakdown
    if (userPlanData.expenseBreakdown && userPlanData.expenseBreakdown.length > 0) {
      prompt += `**Expenses:**\n`;
      userPlanData.expenseBreakdown.forEach((exp: any) => {
        prompt += `- ${exp.name}: $${Math.round(exp.amount).toLocaleString()}/month`;
        if (exp.category) {
          prompt += ` (${exp.category})`;
        }
        prompt += `\n`;
      });
      prompt += `\n`;
    }

    // Debt Information
    if (userPlanData.debtTotal && userPlanData.debtTotal > 0) {
      prompt += `**Debt:**\n`;
      prompt += `- Total debt balance: $${Math.round(userPlanData.debtTotal).toLocaleString()}\n`;
      if (userPlanData.monthlyDebtPayments) {
        prompt += `- Monthly minimum payments: $${Math.round(userPlanData.monthlyDebtPayments).toLocaleString()}\n`;
      }
      if (userPlanData.debtBreakdown && userPlanData.debtBreakdown.length > 0) {
        userPlanData.debtBreakdown.forEach((debt: any) => {
          prompt += `  - ${debt.name}: $${Math.round(debt.balance).toLocaleString()} balance`;
          if (debt.apr) {
            prompt += ` at ${debt.apr}% APR`;
          }
          if (debt.minPayment) {
            prompt += `, $${Math.round(debt.minPayment).toLocaleString()}/month minimum`;
          }
          prompt += `\n`;
        });
      }
      prompt += `\n`;
    }

    // Savings Rate
    if (userPlanData.savingsRate !== undefined) {
      prompt += `**Savings:**\n`;
      prompt += `- Savings rate: ${(userPlanData.savingsRate * 100).toFixed(1)}%\n`;
      if (userPlanData.monthlySavings) {
        prompt += `- Monthly savings: $${Math.round(userPlanData.monthlySavings).toLocaleString()}\n`;
      }
      prompt += `\n`;
    }

    // Actual Spending (3-month averages if available)
    if (userPlanData.actualSpending) {
      prompt += `**Actual Spending (3-month average):**\n`;
      prompt += `- Needs: ${userPlanData.actualSpending.needsPct.toFixed(1)}% of income ($${Math.round(userPlanData.actualSpending.monthlyNeeds).toLocaleString()}/month)\n`;
      prompt += `- Wants: ${userPlanData.actualSpending.wantsPct.toFixed(1)}% of income ($${Math.round(userPlanData.actualSpending.monthlyWants).toLocaleString()}/month)\n`;
      prompt += `- Savings: ${userPlanData.actualSpending.savingsPct.toFixed(1)}% of income ($${Math.round(userPlanData.actualSpending.monthlySavings).toLocaleString()}/month)\n`;
      prompt += `\n`;
    }

    // Plan Data (recommended values if available)
    if (userPlanData.planData) {
      prompt += `**Recommended Plan (if available):**\n`;
      if (userPlanData.planData.planNeeds) {
        prompt += `- Recommended Needs: $${Math.round(userPlanData.planData.planNeeds).toLocaleString()}/month\n`;
      }
      if (userPlanData.planData.planWants) {
        prompt += `- Recommended Wants: $${Math.round(userPlanData.planData.planWants).toLocaleString()}/month\n`;
      }
      if (userPlanData.planData.planSavings) {
        prompt += `- Recommended Savings: $${Math.round(userPlanData.planData.planSavings).toLocaleString()}/month\n`;
      }
      prompt += `\n`;
    }

    // Assets
    if (userPlanData.assetsBreakdown && userPlanData.assetsBreakdown.length > 0) {
      prompt += `**Assets:**\n`;
      userPlanData.assetsBreakdown.forEach((asset: any) => {
        prompt += `- ${asset.name}: $${Math.round(asset.value).toLocaleString()}`;
        if (asset.type) {
          prompt += ` (${asset.type})`;
        }
        prompt += `\n`;
      });
      prompt += `\n`;
    }

    // Goals
    if (userPlanData.goalsBreakdown && userPlanData.goalsBreakdown.length > 0) {
      prompt += `**Financial Goals:**\n`;
      userPlanData.goalsBreakdown.forEach((goal: any) => {
        prompt += `- ${goal.name}`;
        if (goal.target > 0) {
          prompt += `: Target $${Math.round(goal.target).toLocaleString()}`;
        }
        if (goal.deadline) {
          prompt += ` (target date: ${goal.deadline})`;
        }
        if (goal.type) {
          prompt += ` [${goal.type}]`;
        }
        prompt += `\n`;
      });
      prompt += `\n`;
    }

    // Emergency Fund
    if (userPlanData.emergencyFund) {
      prompt += `**Emergency Fund:**\n`;
      prompt += `- Current: $${Math.round(userPlanData.emergencyFund.current).toLocaleString()}\n`;
      prompt += `- Target: $${Math.round(userPlanData.emergencyFund.target).toLocaleString()} (${userPlanData.emergencyFund.monthsTarget} months)\n`;
      if (userPlanData.emergencyFund.monthsToTarget) {
        prompt += `- Months to target: ${userPlanData.emergencyFund.monthsToTarget}\n`;
      }
      prompt += `\n`;
    }

    // Safety Strategy
    if (userPlanData.safetyStrategy) {
      prompt += `**Financial Strategy:**\n`;
      if (userPlanData.safetyStrategy.emergencyFundTargetMonths) {
        prompt += `- Emergency fund target: ${userPlanData.safetyStrategy.emergencyFundTargetMonths} months\n`;
      }
      if (userPlanData.safetyStrategy.liquidity) {
        prompt += `- Liquidity need: ${userPlanData.safetyStrategy.liquidity}\n`;
      }
      if (userPlanData.safetyStrategy.retirementFocus) {
        prompt += `- Retirement focus: ${userPlanData.safetyStrategy.retirementFocus}\n`;
      }
      prompt += `\n`;
    }

    // Net Worth
    if (userPlanData.netWorth) {
      prompt += `**Net Worth:**\n`;
      prompt += `- Current net worth: $${Math.round(userPlanData.netWorth.current).toLocaleString()}\n`;
      if (userPlanData.netWorth.currentAssets !== undefined) {
        prompt += `- Current assets: $${Math.round(userPlanData.netWorth.currentAssets).toLocaleString()}\n`;
      }
      if (userPlanData.netWorth.currentLiabilities !== undefined) {
        prompt += `- Current liabilities: $${Math.round(userPlanData.netWorth.currentLiabilities).toLocaleString()}\n`;
      }
      if (userPlanData.netWorth.projections && userPlanData.netWorth.projections.length > 0) {
        prompt += `- Projections:\n`;
        userPlanData.netWorth.projections.forEach((proj: any) => {
          prompt += `  - ${proj.label} (${proj.months} months): $${Math.round(proj.value).toLocaleString()}\n`;
        });
      }
      prompt += `\n`;
    }

    // Savings Allocation Breakdown
    if (userPlanData.savingsAllocation) {
      prompt += `**Savings Allocation (Monthly):**\n`;
      prompt += `- Total monthly savings: $${Math.round(userPlanData.savingsAllocation.total).toLocaleString()}\n`;
      prompt += `- Breakdown:\n`;
      
      if (userPlanData.savingsAllocation.emergencyFund?.amount > 0) {
        prompt += `  - Emergency Fund: $${Math.round(userPlanData.savingsAllocation.emergencyFund.amount).toLocaleString()}/month (${userPlanData.savingsAllocation.emergencyFund.percent.toFixed(1)}% of savings)\n`;
      }
      if (userPlanData.savingsAllocation.debtPayoff?.amount > 0) {
        prompt += `  - Extra Debt Payoff: $${Math.round(userPlanData.savingsAllocation.debtPayoff.amount).toLocaleString()}/month (${userPlanData.savingsAllocation.debtPayoff.percent.toFixed(1)}% of savings)\n`;
      }
      if (userPlanData.savingsAllocation.match401k?.amount > 0) {
        prompt += `  - 401(k) Employer Match: $${Math.round(userPlanData.savingsAllocation.match401k.amount).toLocaleString()}/month (${userPlanData.savingsAllocation.match401k.percent.toFixed(1)}% of savings)\n`;
      }
      if (userPlanData.savingsAllocation.retirementTaxAdv?.amount > 0) {
        prompt += `  - Retirement Tax-Advantaged (IRA/401k): $${Math.round(userPlanData.savingsAllocation.retirementTaxAdv.amount).toLocaleString()}/month (${userPlanData.savingsAllocation.retirementTaxAdv.percent.toFixed(1)}% of savings)\n`;
      }
      if (userPlanData.savingsAllocation.brokerage?.amount > 0) {
        prompt += `  - Taxable Brokerage: $${Math.round(userPlanData.savingsAllocation.brokerage.amount).toLocaleString()}/month (${userPlanData.savingsAllocation.brokerage.percent.toFixed(1)}% of savings)\n`;
      }
      prompt += `\n`;
    }
  }

  prompt += `Answer the user's question based on the context and their financial situation.`;

  return prompt;
}

