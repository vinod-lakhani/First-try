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
    let requestBody: any;
    try {
      requestBody = await request.json();
    } catch (parseError) {
      console.error('Failed to parse request body as JSON:', parseError);
      return NextResponse.json(
        { error: 'Invalid request format. Expected JSON.' },
        { status: 400 }
      );
    }
    
    const { messages, context, userPlanData } = requestBody;

    // Validate request
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: messages array is required' },
        { status: 400 }
      );
    }

    // Get API key from environment variable
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('OPENAI_API_KEY is not set in environment variables');
      return NextResponse.json(
        { error: 'Chat service is not configured. The OpenAI API key is missing. Please contact support or check your environment configuration.' },
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
    let systemPrompt: string;
    try {
      systemPrompt = buildSystemPrompt(context, userPlanData);
    } catch (promptError) {
      console.error('Error building system prompt:', promptError);
      return NextResponse.json(
        { error: 'Failed to prepare chat context. Please try again.' },
        { status: 500 }
      );
    }
    
    // Transform messages to OpenAI format, filtering out invalid messages
    const openAIMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
        .filter((msg: any) => msg && msg.text && typeof msg.text === 'string')
        .map((msg: any) => ({
          role: msg.isUser ? 'user' : 'assistant',
          content: msg.text,
        })),
    ];

    if (openAIMessages.length <= 1) {
      return NextResponse.json(
        { error: 'Invalid request: no valid messages provided' },
        { status: 400 }
      );
    }
    
    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // or 'gpt-3.5-turbo' for lower cost
          messages: openAIMessages,
          temperature: 0.7,
          max_tokens: 500,
        }),
      });
    } catch (fetchError) {
      console.error('Failed to fetch from OpenAI API:', fetchError);
      throw new Error('Unable to connect to the AI service. Please check your network connection and try again.');
    }

    if (!response.ok) {
      let errorData: any = { error: 'Unknown error' };
      try {
        errorData = await response.json();
      } catch (parseError) {
        // Response is not JSON, try to get text
        try {
          const text = await response.text();
          console.error('OpenAI API non-JSON error response:', {
            status: response.status,
            statusText: response.statusText,
            body: text.substring(0, 200),
          });
          errorData = { error: `API error: ${response.statusText}` };
        } catch (textError) {
          console.error('OpenAI API error - unable to read response body:', {
            status: response.status,
            statusText: response.statusText,
          });
        }
      }
      
      console.error('OpenAI API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      
      // Provide user-friendly error messages
      let userErrorMessage = 'Failed to get response from the AI service';
      if (response.status === 401) {
        userErrorMessage = 'Authentication failed. The chat service may not be properly configured.';
      } else if (response.status === 429) {
        userErrorMessage = 'The chat service is temporarily rate-limited. Please try again in a moment.';
      } else if (response.status >= 500) {
        userErrorMessage = 'The AI service is temporarily unavailable. Please try again later.';
      } else if (errorData.error?.message) {
        userErrorMessage = errorData.error.message;
      } else if (errorData.error) {
        userErrorMessage = String(errorData.error);
      }
      
      return NextResponse.json(
        { error: userErrorMessage },
        { status: response.status }
      );
    }

    // Parse successful response
    let data: any;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('Failed to parse OpenAI API response as JSON:', parseError);
      const responseText = await response.text().catch(() => 'Unable to read response');
      console.error('Response body:', responseText.substring(0, 500));
      return NextResponse.json(
        { error: 'Received invalid response from the AI service. Please try again.' },
        { status: 500 }
      );
    }

    // Check if OpenAI returned an error in the response
    if (data.error) {
      console.error('OpenAI API error in response:', data.error);
      return NextResponse.json(
        { error: data.error.message || 'An error occurred with the AI service' },
        { status: 500 }
      );
    }

    const aiResponse = data.choices?.[0]?.message?.content || 'I apologize, I could not generate a response.';

    return NextResponse.json({ response: aiResponse });
  } catch (error) {
    console.error('Chat API error:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Internal server error';
    if (error instanceof Error) {
      errorMessage = error.message;
      // Log the full error for debugging
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    } else {
      console.error('Non-Error object caught:', error);
      errorMessage = String(error);
    }
    
    // Don't expose internal error details in production - provide user-friendly message
    const userMessage = errorMessage.includes('API key') 
      ? 'Chat service is not properly configured. Please contact support.'
      : 'An error occurred while processing your request. Please try again.';
    
    return NextResponse.json(
      { error: userMessage },
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

CRITICAL RULE - ENDING RESPONSES:
- NEVER end your response with phrases like:
  * "If you have any other questions"
  * "feel free to ask"
  * "just let me know"
  * "I'm here to help"
  * Any variation asking if they need more help
- Simply answer the question and STOP. Do not add any closing statement or invitation for more questions.
- End your response naturally after answering - no additional phrases needed.

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
      const actuals = userPlanData.actualSpending;
      prompt += `**Actual Spending (3-month average):**\n`;
      if (typeof actuals.needsPct === 'number') {
        prompt += `- Needs: ${actuals.needsPct.toFixed(1)}% of income`;
        if (typeof actuals.monthlyNeeds === 'number') {
          prompt += ` ($${Math.round(actuals.monthlyNeeds).toLocaleString()}/month)`;
        }
        prompt += `\n`;
      }
      if (typeof actuals.wantsPct === 'number') {
        prompt += `- Wants: ${actuals.wantsPct.toFixed(1)}% of income`;
        if (typeof actuals.monthlyWants === 'number') {
          prompt += ` ($${Math.round(actuals.monthlyWants).toLocaleString()}/month)`;
        }
        prompt += `\n`;
      }
      if (typeof actuals.savingsPct === 'number') {
        prompt += `- Savings: ${actuals.savingsPct.toFixed(1)}% of income`;
        if (typeof actuals.monthlySavings === 'number') {
          prompt += ` ($${Math.round(actuals.monthlySavings).toLocaleString()}/month)`;
        }
        prompt += `\n`;
      }
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
        const goalName = goal.name || 'Goal';
        const goalCurrent = typeof goal.current === 'number' ? goal.current : 0;
        const goalTarget = typeof goal.target === 'number' ? goal.target : undefined;
        
        prompt += `- ${goalName}: $${Math.round(goalCurrent).toLocaleString()}`;
        if (goalTarget !== undefined && goalTarget > 0) {
          prompt += ` / $${Math.round(goalTarget).toLocaleString()} target`;
        }
        if (goal.deadline) {
          prompt += ` (deadline: ${goal.deadline})`;
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

  prompt += `Answer the user's question based on the context and their financial situation.
Remember: Answer the question directly and STOP. Do NOT add any closing phrases, invitations for more questions, or statements like "just let me know" or "if you have other questions".`;

  return prompt;
}

