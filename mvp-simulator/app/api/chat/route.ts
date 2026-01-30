/**
 * Chat API for MVP Simulator – mvp-simulator context only, calls OpenAI.
 */
import { NextRequest, NextResponse } from 'next/server';

function buildSystemPrompt(userPlanData: Record<string, unknown> | undefined): string {
  let prompt = `You are Ribbit, a friendly financial assistant for the WeLeap MVP Simulator.

**Main rule:** Explain clearly what the data shows. Use only the exact numbers from USER INPUTS and OUTPUTS below. Do not recalculate, infer, or substitute. Your answer must match what the user sees in the simulator.

**How to respond:**
- "What is X?" / "How much is Y?": State the value from OUTPUTS (or USER INPUTS) and briefly what it means in plain language.
- "What did I enter for X?": Use USER INPUTS only; state the exact value.
- "How was X calculated?": Say what the simulator shows (from OUTPUTS), then optionally reference CALCULATION LOGIC. Never give a number that differs from OUTPUTS.
- Net worth: Use OUTPUTS.netWorth (start, 1Y, 5Y, 10Y, 20Y, 40Y, KPIs). Same data as the Net Worth graph.

Keep answers short and coherent. Do not end with "feel free to ask" or similar.
`;
  if (userPlanData?.inputs && userPlanData?.outputs) {
    prompt += `\n**USER INPUTS (what the user entered):**\n`;
    const summary = userPlanData.userInputSummary as Record<string, string | number> | undefined;
    if (summary && typeof summary === 'object') {
      Object.entries(summary).forEach(([k, v]) => {
        prompt += `${k}: ${v}\n`;
      });
    } else {
      prompt += JSON.stringify(userPlanData.inputs, null, 2) + '\n';
    }

    prompt += `\n**INPUTS (full):**\n${JSON.stringify(userPlanData.inputs, null, 2)}\n\n`;
    prompt += `**OUTPUTS:**\n${JSON.stringify(userPlanData.outputs, null, 2)}\n\n`;
    if (userPlanData.monthlyIncome != null) {
      prompt += `Monthly income: $${Number(userPlanData.monthlyIncome).toLocaleString()}\n\n`;
    }

    const steps = userPlanData.calculationSteps as { income?: string[]; savings?: string[]; netWorth?: string[] } | undefined;
    if (steps && typeof steps === 'object') {
      prompt += `**CALCULATION LOGIC (reference only; always align your explanation with OUTPUTS):**\n`;
      if (steps.income?.length) {
        prompt += `\nIncome allocation:\n${steps.income.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}\n`;
      }
      if (steps.savings?.length) {
        prompt += `\nSavings allocation:\n${steps.savings.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}\n`;
      }
      if (steps.netWorth?.length) {
        prompt += `\nNet worth simulation:\n${steps.netWorth.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}\n`;
      }
    }
  } else {
    prompt += '\nNo simulation data yet. Ask the user to run a simulation first.\n';
  }
  return prompt;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, context, userPlanData } = body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages array required' }, { status: 400 });
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not set. Add it to .env.local.' },
        { status: 500 }
      );
    }
    const systemPrompt = buildSystemPrompt(userPlanData ?? undefined);
    const openAIMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages
        .filter((m: { text?: string; isUser?: boolean }) => m?.text)
        .map((m: { text: string; isUser: boolean }) => ({
          role: (m.isUser ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.text,
        })),
    ];
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: openAIMessages,
        temperature: 0.4,
        max_tokens: 1000,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: (err as { error?: { message?: string } }).error?.message || res.statusText },
        { status: res.status }
      );
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? 'I could not generate a response.';
    return NextResponse.json({ response: content });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}
