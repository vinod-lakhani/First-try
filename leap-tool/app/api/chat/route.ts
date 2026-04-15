/**
 * WeLeap Leap Tool — Chat API Route
 *
 * Streams GPT-4o-mini responses for the Leap financial guide chat.
 * Supports context: leap-chat
 */

import { NextRequest } from 'next/server';

function getSystemPrompt(context: string, situationContext?: string): string {
  if (context === 'leap-chat') {
    const contextBlock = situationContext
      ? `Here is their situation: ${situationContext}`
      : 'No situation context provided.';

    return `You are Leap, a friendly AI financial guide. You've just shown the user their #1 money move.
${contextBlock}

Answer follow-up questions conversationally. Keep responses short (2-4 sentences).
Focus on practical next steps. Always tie back to their specific numbers.
Never recommend specific securities. End by mentioning WeLeap for a complete plan.
NEVER end with "feel free to ask" or "let me know if you have questions".`;
  }

  return `You are Leap, a friendly AI financial guide. Answer financial questions conversationally and concisely.`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, context = 'leap-chat', situationContext } = body as {
      messages: Array<{ text: string; isUser: boolean }>;
      context?: string;
      situationContext?: string;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response('Invalid messages', { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response('API key not configured', { status: 500 });
    }

    const systemPrompt = getSystemPrompt(context, situationContext);

    // Transform from page format {id, text, isUser, ...} → OpenAI format {role, content}
    const openAIMessages = messages
      .filter((m: { text?: string }) => m.text && m.text.trim().length > 0)
      .map((m: { text: string; isUser: boolean }) => ({
        role: m.isUser ? 'user' : 'assistant',
        content: m.text,
      }));

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }, ...openAIMessages],
        stream: true,
        max_tokens: 600,
        temperature: 0.2, // Low for consistent calculations and structured flow
      }),
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      console.error('OpenAI error:', openaiResponse.status, error);
      return new Response(JSON.stringify({ error: 'OpenAI request failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Re-stream as { text: "..." } chunks so the client parser works correctly.
    // OpenAI sends: data: {"choices":[{"delta":{"content":"..."}}]}
    // Client expects: data: {"text":"..."}
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = openaiResponse.body!.getReader();
        const decoder = new TextDecoder();
        let buf = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const parts = buf.split('\n\n');
            buf = parts.pop() ?? '';

            for (const part of parts) {
              const line = part.split('\n').find((l) => l.startsWith('data: '));
              if (!line) continue;
              const raw = line.slice(6).trim();
              if (raw === '[DONE]') continue;
              try {
                const obj = JSON.parse(raw);
                const content: string | undefined = obj.choices?.[0]?.delta?.content;
                if (typeof content === 'string' && content.length > 0) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ text: content })}\n\n`)
                  );
                }
              } catch {
                // malformed chunk — skip
              }
            }
          }
        } finally {
          reader.releaseLock();
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    console.error('Chat route error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
