/**
 * Chat API Route - Ribbit financial assistant
 * Uses OpenAI with income allocation context (50/30/20 rule).
 */

import { NextRequest, NextResponse } from "next/server";

function buildSystemPrompt(context: string, userPlanData: Record<string, unknown> | undefined): string {
  const income = Number(userPlanData?.income ?? 0);
  const needs = Number(userPlanData?.needs ?? 0);
  const wants = Number(userPlanData?.wants ?? 0);
  const savings = Number(userPlanData?.savings ?? 0);

  return `You are Ribbit, a friendly and helpful financial assistant for the WeLeap personal finance app.
You help users understand their financial plans, the 50/30/20 rule, and answer questions about needs vs wants and savings.

## CRITICAL RULES
- Use the EXACT values from the user's plan data below. Don't calculate or estimate.
- NEVER end with "If you have any other questions", "feel free to ask", or similar invitations.
- Be conversational, clear, and supportive. Keep responses concise (2-4 sentences when possible).
- Use **bold** for key numbers and terms. Format dollars as **$X** (whole numbers, comma separators).

## 50/30/20 RULE
- **Needs**: 50% of income – essential expenses (rent, utilities, groceries, transportation, insurance, debt payments)
- **Wants**: 30% of income – discretionary spending (entertainment, dining out, shopping, subscriptions, travel)
- **Savings**: 20% of income – what's left after needs and wants (emergency fund, investments, extra debt payoff)

Savings is calculated as: **Income - Needs - Wants** (the leftover).

## USER'S CURRENT PLAN
- **Income (monthly):** $${income.toLocaleString("en-US", { minimumFractionDigits: 2 })}
- **Needs:** $${needs.toLocaleString("en-US", { minimumFractionDigits: 2 })} (${income > 0 ? ((needs / income) * 100).toFixed(1) : 0}%)
- **Wants:** $${wants.toLocaleString("en-US", { minimumFractionDigits: 2 })} (${income > 0 ? ((wants / income) * 100).toFixed(1) : 0}%)
- **Cash Savings (Post-tax):** $${savings.toLocaleString("en-US", { minimumFractionDigits: 2 })} (${income > 0 ? ((savings / income) * 100).toFixed(1) : 0}%)

## CONTEXT
The user is on the Income Allocation screen. They can adjust income, needs, or wants; savings updates automatically as the leftover. This shows a **target plan** (what they're aiming for), not necessarily their actual spending. If spending changes next month, they would revisit and adjust.`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, context = "income-allocator", userPlanData } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages array is required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Chat service is not configured. Set OPENAI_API_KEY in your environment to enable Ribbit.",
        },
        { status: 500 }
      );
    }

    const systemPrompt = buildSystemPrompt(context, userPlanData);

    const openAIMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages
        .filter((m: { text?: string }) => m && m.text && typeof m.text === "string")
        .map((m: { text: string; isUser: boolean }) => ({
          role: (m.isUser ? "user" : "assistant") as "user" | "assistant",
          content: m.text,
        })),
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: openAIMessages,
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.error?.message ?? "OpenAI API error" },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "I couldn't generate a response.";

    return NextResponse.json({ response: content });
  } catch (e) {
    console.error("[chat] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Chat request failed" },
      { status: 500 }
    );
  }
}
