/**
 * Chat API Route - Ribbit financial assistant
 * Uses screen-specific prompts with computed context.
 */

import { NextRequest, NextResponse } from "next/server";
import { buildSystemMessage } from "@/lib/ribbit";
import type { RibbitScreenContext } from "@/lib/ribbit/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, screenContext } = body as {
      messages: { text: string; isUser: boolean }[];
      screenContext: RibbitScreenContext;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 }
      );
    }

    if (!screenContext || !screenContext.screen) {
      return NextResponse.json(
        { error: "screenContext is required with screen, onboardingStage, etc." },
        { status: 400 }
      );
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

    const systemContent = buildSystemMessage(screenContext);

    const openAIMessages = [
      { role: "system" as const, content: systemContent },
      ...messages
        .filter((m) => m && m.text && typeof m.text === "string")
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
        max_tokens: 600,
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
    const content =
      data.choices?.[0]?.message?.content ?? "I couldn't generate a response.";

    return NextResponse.json({ response: content });
  } catch (e) {
    console.error("[chat] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Chat request failed" },
      { status: 500 }
    );
  }
}
