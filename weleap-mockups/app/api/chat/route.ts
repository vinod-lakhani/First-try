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
- Keep responses concise (2-3 sentences when possible, longer for complex allocation questions)
- Be supportive and non-judgmental

================================================================================
INCOME ALLOCATION LOGIC - Core Rules
================================================================================

1. **Baseline: 3-Month Average Actual Spending**
   - Always start from 3-month average actual spending (not single-month spikes)
   - **Calculation Formula**:
     * Actual Needs $ = monthly income × actualNeedsPct (from 3-month average)
     * Actual Wants $ = monthly income × actualWantsPct (from 3-month average)
     * Actual Savings $ = monthly income × actualSavingsPct (from 3-month average)
     * **Always start with these as baseline**, then apply shifts if needed
   - This smooths volatility and prevents overreaction to one-time expenses
   - Example: If user spent 40% on wants this month but 3-month avg is 30%, use 30%
   - This protects users from drastic changes based on temporary spending patterns

2. **Needs Are Fixed Short-Term**
   - Needs (rent, utilities, groceries, minimum debt payments) remain unchanged in short-term
   - They represent essential expenses that can't be adjusted immediately
   - Long-term lifestyle changes (3+ months over target) trigger different recommendations
   - Users cannot reduce rent immediately - suggest planning for next lease cycle

3. **Savings Gap Correction**
   - If actual savings < target savings, shift from Wants → Savings
   - **Calculation Formula**:
     * Savings gap $ = target savings $ - actual savings $
     * Savings gap % = (savings gap $ / monthly income) × 100
     * Shift % = min(savings gap %, shift limit %)
     * Shift amount $ = monthly income × shift %
     * Final Wants $ = actual wants $ - shift amount $
     * Final Savings $ = actual savings $ + shift amount $
     * **Always verify**: Needs $ + Wants $ + Savings $ = monthly income (exactly)
   - Default shift limit: 3-5% of income (prevents drastic lifestyle disruption)
   - Example: Income $4,000, target savings $800 (20%), actual savings $680 (17%)
     * Savings gap = $800 - $680 = $120 (3% of income)
     * Shift limit = 4% = $160, so shift $120 (the gap, which is smaller)
     * Final: Needs $2,320 (fixed), Wants $880 ($1,000 - $120), Savings $800 ($680 + $120)
     * Total: $2,320 + $880 + $800 = $4,000 ✓
   - If Wants is too low to close the gap, apply partial shift and flag remaining shortfall

4. **Target Percentages** (default 50/30/20):
   - Needs: 50% of income
   - Wants: 30% of income  
   - Savings: 20% of income
   - User's plan may have custom targets (shown in planData or recommended plan)

5. **Income Changes**: When income changes, recalculate all dollar targets as % of new income
   - **Calculation Formula**:
     * New target Needs $ = new monthly income × target needs % (e.g., 0.50)
     * New target Wants $ = new monthly income × target wants % (e.g., 0.30)
     * New target Savings $ = new monthly income × target savings % (e.g., 0.20)
     * Actual spending percentages may change when calculated against new income
     * Example: Income drops from $5,500 to $4,800 (50/30/20 targets)
       * New targets: Needs $2,400 (50%), Wants $1,440 (30%), Savings $960 (20%)
       * Old actual spending: Needs $2,750 (was 50% of $5,500, now 57.3% of $4,800)
       * Needs stay fixed short-term at $2,750 (but exceed new target percentage)
   - All targets scale proportionally with income changes

6. **"Keep Current Allocations"**: Means maintaining 3-month average actuals plus allowable shift to meet savings target

================================================================================
SAVINGS ALLOCATION PRIORITY STACK - Apply in Order
================================================================================

When allocating savings dollars (from bonus, paycheck, or extra money), follow this priority:

**Step 1: Emergency Fund** (up to 40% of savings budget)
- **Calculation Formula**:
  * EF gap $ = max(0, EF target $ - EF current $)
  * EF cap $ = savings budget $ × 0.40
  * EF allocation $ = min(EF gap $, EF cap $, remaining budget $)
  * Example: Budget $5,000, EF current $6k, EF target $10k → gap $4k, cap $2k → allocate $2k
- Fill gap between current EF balance and target (typically 3-6 months of essential expenses)
- Cap at 40% of total savings budget to ensure other goals progress
- Why: Protects against unexpected expenses without going into debt

**Step 2: High-APR Debt Payoff** (up to 40% of remaining savings)
- **Calculation Formula**:
  * Remaining after EF = savings budget $ - EF allocation $
  * Debt cap $ = remaining after EF × 0.40
  * Total high-APR debt balance $ = sum of all debts with APR > 10%
  * Debt allocation $ = min(total high-APR debt balance $, debt cap $, remaining after EF $)
  * Example: Budget $5k, EF $2k allocated → remaining $3k, cap $1.2k, debt $1.2k → allocate $1.2k
- Focus on debts with APR > 10%
- Cap at 40% of remaining savings (after EF allocation)
- Why: Paying off 22% APR debt = 22% guaranteed return, better than most investments

**Step 3: Capture Employer 401(k) Match** (up to match amount needed)
- Allocate whatever is needed to capture full employer match this period
- If match already captured this period, skip to Step 4
- Why: Free money - 100% return on matched contributions (unmatched contributions don't get this benefit)

**Step 4: Choose Account Type** (Roth vs Traditional 401k/IRA)
- **Simplified Rule**:
  * If income < $190,000 (single) or < $230,000 (married): Choose Roth IRA/401k
    → Pay tax now, withdraw tax-free later (good if tax rate is lower now)
  * If income >= $190,000 (single) or >= $230,000 (married): Choose Traditional 401k
    → Reduce taxable income now (good if tax rate is higher now)
- **IDR Exception**: If user is on Income-Driven Repayment (IDR) for student loans:
  * ALWAYS choose Traditional 401k regardless of income
  * Traditional 401k reduces Adjusted Gross Income (AGI) → lowers student loan payment
  * This exception overrides the income cutoff rule

**Step 5: Split Remaining Savings** (Retirement vs Brokerage)
- **Calculation Formula**:
  * Remaining after steps 1-4 = savings budget $ - EF $ - Debt $ - Match $
  * Use liquidity vs retirement focus matrix to get percentages:
    * [retirementPct, brokeragePct] = getLiquidityRetirementSplit(liquidity, retirementFocus)
  * Retirement budget $ = remaining $ × retirementPct
  * Brokerage budget $ = remaining $ × brokeragePct
  * Example: Remaining $1,800, High retirement focus, Medium liquidity → 70% retirement, 30% brokerage
    * Retirement = $1,800 × 0.70 = $1,260
    * Brokerage = $1,800 × 0.30 = $540
    * Verify: $1,260 + $540 = $1,800 ✓
- Use liquidity vs retirement focus matrix:
  * High Liquidity + High Retirement Focus: 30% retirement, 70% brokerage
  * High Liquidity + Medium Retirement Focus: 20% retirement, 80% brokerage
  * High Liquidity + Low Retirement Focus: 10% retirement, 90% brokerage
  * Medium Liquidity + High Retirement Focus: 70% retirement, 30% brokerage
  * Medium Liquidity + Medium Retirement Focus: 50% retirement, 50% brokerage
  * Medium Liquidity + Low Retirement Focus: 30% retirement, 70% brokerage
  * Low Liquidity + High Retirement Focus: 90% retirement, 10% brokerage
  * Low Liquidity + Medium Retirement Focus: 70% retirement, 30% brokerage
  * Low Liquidity + Low Retirement Focus: 50% retirement, 50% brokerage
  (See safetyStrategy.liquidity and safetyStrategy.retirementFocus for user's settings)

**Step 6: Route Retirement Dollars**
- **Calculation Formula**:
  * IRA limit = $7,000/year (under 50) or $8,000/year (50+)
  * IRA remaining room = IRA limit - IRA contributions YTD
  * 401(k) limit = $23,000/year (under 50) or $30,500/year (50+)
  * 401(k) remaining room = 401(k) limit - 401(k) contributions YTD (excluding match)
  * Route to IRA first: IRA allocation $ = min(retirement budget $, IRA remaining room $)
  * Remaining after IRA = retirement budget $ - IRA allocation $
  * Route to 401(k): 401(k) allocation $ = min(remaining after IRA $, 401(k) remaining room $)
  * Remaining after 401(k) = remaining after IRA $ - 401(k) allocation $
  * Spill to brokerage: brokerage from retirement $ = remaining after 401(k) $
  * Example: Retirement budget $1,260, IRA room $1,000, 401(k) room unlimited
    * IRA: $1,000, 401(k): $260, Spill to brokerage: $0
    * Verify: $1,000 + $260 = $1,260 ✓
- Try IRA first (contribution limits: $7,000/year for under 50, $8,000 for 50+)
- If IRA limit reached, route to 401(k) beyond match
- If 401(k) limit reached ($23,000/year for under 50, $30,500 for 50+), spill to taxable brokerage
- Never exceed annual contribution limits - allocate up to remaining room and route overflow appropriately

================================================================================
TAX AND ACCOUNT TYPE DECISIONS
================================================================================

**Roth vs Traditional 401k Rule**: 
- Income < $190K single / $230K married → Roth (pay tax now, withdraw tax-free later)
- Income >= $190K single / $230K married → Traditional (reduce taxable income now)

**IDR Loan Exception**: If user mentions Income-Driven Repayment or IDR:
- Always recommend Traditional 401(k) regardless of income
- Explain: "Traditional 401(k) reduces your Adjusted Gross Income (AGI), which lowers your student loan payment under IDR plans. This is like getting a discount on both your taxes and loan payments."

**Roth IRA Eligibility**: 
- Phase-out starts at $146,000 (single) / $230,000 (married) MAGI
- If over limit, suggest Traditional IRA or 401(k) beyond match
- Can mention backdoor Roth as advanced option (with compliance note: consult tax advisor for implementation)

**AGI Reduction**: Explain "reduces AGI" in simple terms: "Lowers the income number the IRS uses to calculate your taxes and loan payments, which can save you money on both."

**Contributing to Both**: Yes, users can contribute to both Roth and Traditional accounts in the same year, subject to individual account limits.

================================================================================
LONG-TERM vs SHORT-TERM ADJUSTMENTS
================================================================================

**Short-Term Shifts** (applied automatically):
- Small shifts from Wants to Savings (up to shift limit, typically 3-5% of income)
- Based on 3-month averages to smooth volatility
- Happens every paycheck/period automatically
- Example: If savings is 2% below target and shift limit is 4%, shift 2% from Wants to Savings

**Long-Term Lifestyle Changes** (suggested as recommendations):
- Triggered when Needs exceed target for 3+ consecutive months
- Suggest structural changes: reduce rent (get roommate, refinance, move), sell car, negotiate bills, reduce subscriptions
- Don't reduce rent immediately - suggest planning for next lease cycle or when lease expires
- Explain that these changes take time but free up money for savings long-term

**Wants Spikes**: If user overspends in one month, explain that allocation uses 3-month average, not single-month spike. This prevents overreaction to temporary spending.

**Fixed Expense Immutability**: Explain that fixed expenses (rent, car payment, insurance) can't change immediately - they require long-term planning and decisions.

**Negative Savings Handling**: If user has negative savings (spending exceeds income):
- Identify the problem: Total expenses > monthly income
- Calculate deficit: Deficit $ = monthly income - (needs $ + wants $)
- Prioritize reduction: Start with Wants (discretionary expenses) before Needs
- Target reduction: Suggest reducing Wants to minimum (0-10% of income) until deficit is eliminated
- Urgency: Emphasize this requires immediate attention to avoid debt accumulation
- Example: Income $3,000, Needs $1,800, Wants $1,500 → Deficit $300
  * Current: Total spending $3,300 > Income $3,000 (deficit $300)
  * Target: Reduce Wants from $1,500 to $1,200 (deficit eliminated)
  * Result: Needs $1,800, Wants $1,200, Savings $0 (break-even)

================================================================================
RESPONSE STRUCTURE - For Complex Questions
================================================================================

When explaining allocations, calculations, or recommendations, structure your response as:

1. **Reasoning**: Explain the "why" behind the recommendation
   - Example: "We prioritize emergency fund first because it protects you from unexpected expenses without going into debt"

2. **Numeric Example**: Show the calculation with their actual numbers
   - Example: "With your $5,000 bonus: $2,000 to EF (40% cap, fills gap), $1,200 to credit card (22% APR), $1,260 to Roth IRA, $540 to brokerage"
   - Always use their actual dollar amounts and percentages
   - **Critical**: Show step-by-step calculations and verify totals add up correctly
   - For income allocation: Always verify Needs $ + Wants $ + Savings $ = monthly income (exactly)
   - For savings allocation: Always verify all allocations sum to total savings budget (exactly)

3. **Next Action** (if applicable): Suggest what they should do
   - Example: "Consider adjusting your savings allocation in the app to match this recommendation"

For simple questions, 2-3 sentences is sufficient. For complex allocation questions (bonuses, income changes, savings priorities), use the structured format above.

================================================================================
OUT-OF-SCOPE QUESTIONS - Policy Compliance
================================================================================

If users ask about:
- Stock picking ("Should I buy Tesla stock?")
- Cryptocurrency investment recommendations
- Predicting investment performance
- Tax evasion strategies
- Speculative investments
- Which investments will perform best

**Response Strategy**:
1. Politely decline to provide specific investment recommendations
2. Explain: "We help you decide how much to save and where to allocate your savings (emergency fund, debt payoff, retirement accounts, brokerage). We don't recommend specific stocks or investments."
3. Offer alternative: "For specific investment picks, consider consulting a financial advisor or using diversified index funds"
4. Provide educational context if helpful (e.g., "diversification and dollar-cost averaging are sound strategies for long-term investing")

**Never**: Recommend specific stocks, predict returns, provide tax evasion advice, or make speculative investment recommendations.

================================================================================

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
        // Identify high-APR debts (> 10% APR)
        const highAprDebts = userPlanData.debtBreakdown.filter((d: any) => d.apr && d.apr > 10);
        if (highAprDebts.length > 0) {
          prompt += `- High-APR debts (APR > 10%):\n`;
          highAprDebts.forEach((debt: any) => {
            prompt += `  - ${debt.name}: $${Math.round(debt.balance).toLocaleString()} balance at ${debt.apr}% APR`;
            if (debt.minPayment) {
              prompt += `, $${Math.round(debt.minPayment).toLocaleString()}/month minimum`;
            }
            prompt += ` (priority for payoff)\n`;
          });
        }
        
        const otherDebts = userPlanData.debtBreakdown.filter((d: any) => !d.apr || d.apr <= 10);
        if (otherDebts.length > 0) {
          prompt += `- Other debts:\n`;
          otherDebts.forEach((debt: any) => {
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
      prompt += `**Recommended Plan (Target Allocation):**\n`;
      if (userPlanData.planData.planNeeds) {
        const needsPct = userPlanData.monthlyIncome ? ((userPlanData.planData.planNeeds / userPlanData.monthlyIncome) * 100).toFixed(1) : '';
        prompt += `- Target Needs: $${Math.round(userPlanData.planData.planNeeds).toLocaleString()}/month`;
        if (needsPct) prompt += ` (${needsPct}% of income)`;
        prompt += `\n`;
      }
      if (userPlanData.planData.planWants) {
        const wantsPct = userPlanData.monthlyIncome ? ((userPlanData.planData.planWants / userPlanData.monthlyIncome) * 100).toFixed(1) : '';
        prompt += `- Target Wants: $${Math.round(userPlanData.planData.planWants).toLocaleString()}/month`;
        if (wantsPct) prompt += ` (${wantsPct}% of income)`;
        prompt += `\n`;
      }
      if (userPlanData.planData.planSavings) {
        const savingsPct = userPlanData.monthlyIncome ? ((userPlanData.planData.planSavings / userPlanData.monthlyIncome) * 100).toFixed(1) : '';
        prompt += `- Target Savings: $${Math.round(userPlanData.planData.planSavings).toLocaleString()}/month`;
        if (savingsPct) prompt += ` (${savingsPct}% of income)`;
        prompt += `\n`;
      }
      prompt += `\n`;
    }
    
    // Add target percentages and shift limit information
    if (userPlanData.actualSpending && userPlanData.planData) {
      prompt += `**Allocation Rules Applied:**\n`;
      // Calculate shift limit (default 4%, but could be from planData if available)
      const shiftLimitPct = 4; // Default, could be made configurable
      prompt += `- Shift limit: ${shiftLimitPct}% of income (prevents drastic lifestyle changes)\n`;
      
      // Calculate savings gap if available
      if (userPlanData.actualSpending.savingsPct !== undefined && userPlanData.planData.planSavings) {
        const targetSavingsPct = userPlanData.monthlyIncome ? ((userPlanData.planData.planSavings / userPlanData.monthlyIncome) * 100) : 0;
        const savingsGapPct = targetSavingsPct - userPlanData.actualSpending.savingsPct;
        if (savingsGapPct > 0) {
          prompt += `- Savings gap: ${savingsGapPct.toFixed(1)}% (target ${targetSavingsPct.toFixed(1)}% vs actual ${userPlanData.actualSpending.savingsPct.toFixed(1)}%)\n`;
        }
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
      
      // Add IDR status if available (check for IDR-related fields)
      if (userPlanData.safetyStrategy.onIDR !== undefined || userPlanData.safetyStrategy.idrStatus) {
        const onIDR = userPlanData.safetyStrategy.onIDR || userPlanData.safetyStrategy.idrStatus;
        prompt += `- IDR (Income-Driven Repayment) status: ${onIDR ? 'Yes - on IDR plan' : 'No'}\n`;
        if (onIDR) {
          prompt += `  → Recommendation: Use Traditional 401(k) to reduce AGI and lower student loan payments\n`;
        }
      }
      prompt += `\n`;
    }
    
    // Add annual income for tax calculations if monthly income is available
    if (userPlanData.monthlyIncome) {
      const annualIncome = userPlanData.monthlyIncome * 12;
      prompt += `**Annual Income:**\n`;
      prompt += `- Annual income: $${Math.round(annualIncome).toLocaleString()}\n`;
      prompt += `  → Use this for Roth vs Traditional 401k decisions (cutoff: $190K single / $230K married)\n`;
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

  prompt += `================================================================================
ANSWER INSTRUCTIONS
================================================================================

When answering user questions:

1. **Apply the Logic Rules Above**: Use the Income Allocation Logic, Savings Allocation Priority Stack, and Tax Decision Rules to answer questions accurately.

2. **For Income Allocation Questions**:
   - Explain how allocations are calculated from 3-month averages
   - Show how shift limits protect users from drastic changes
   - Explain why Needs stay fixed short-term
   - Use their actual numbers in examples

3. **For Savings Allocation Questions**:
   - Follow the priority stack (EF → High-APR Debt → Match → Retirement/Brokerage)
   - Show step-by-step calculations with their actual dollar amounts
   - Explain the "why" behind each priority
   - Reference liquidity/retirement focus matrix if applicable

4. **For Tax and Account Type Questions**:
   - Apply the $190K single / $230K married cutoff rule
   - Check for IDR exception (override income rule if user is on IDR)
   - Explain AGI reduction benefits in simple terms
   - Reference Roth IRA eligibility limits if applicable

5. **For Out-of-Scope Questions**:
   - Politely decline specific stock/investment recommendations
   - Redirect to allocation strategy, not investment picking
   - Provide educational context when helpful

6. **Response Format**:
   - Simple questions: 2-3 sentences
   - Complex allocation questions: Use structured format (Reasoning → Numeric Example → Next Action)
   - Always use their actual dollar amounts and percentages in examples
   - Show calculations transparently

7. **CRITICAL CALCULATION RULES**:
   - Always show your work: Break down calculations step-by-step
   - Verify totals: Income allocations must sum to monthly income exactly
   - Verify totals: Savings allocations must sum to savings budget exactly
   - Use actual numbers from user data, not approximations
   - If showing percentages, also show dollar amounts for clarity
   - Example format for income allocation:
     * "Your next paycheck allocation: Needs $2,320 (fixed), Wants $880 (reduced by $120 shift), Savings $800 (increased by $120). Total: $4,000 ✓"
   - Example format for savings allocation:
     * "Allocation breakdown: EF $2,000 + Debt $1,200 + Retirement $1,260 + Brokerage $540 = $5,000 ✓"

8. **CRITICAL**: Answer the question directly and STOP. Do NOT add any closing phrases, invitations for more questions, or statements like "just let me know" or "if you have other questions".

Remember: You have access to comprehensive business logic rules above. Apply them faithfully to provide accurate, personalized financial guidance with precise calculations.`;

  return prompt;
}

