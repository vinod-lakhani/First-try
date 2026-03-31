/**
 * Leap Tool — Realtime Session Route
 *
 * Creates an ephemeral OpenAI Realtime API session token.
 * The AI's sole job is to ask 3 questions, then call the `submit_leap_inputs`
 * tool with structured data. The client catches that tool call and triggers
 * the visual reveal — no parsing of free-form text needed.
 */

import { NextResponse } from 'next/server';

const LEAP_VOICE_INSTRUCTIONS = `You are the WeLeap financial guide. You're having a quick, friendly voice call with someone who wants to find their single biggest money move.

YOUR ONLY JOB: Ask 3 questions, collect the answers, call the submit_leap_inputs tool.

THE MOMENT THE SESSION STARTS, say this opening exactly:
"Hey! I'll find your biggest money move in about 60 seconds — just three quick questions. What's your annual salary?"

QUESTION ORDER (ask exactly in this order, one at a time):
1. Annual salary (ask in opening)
2. State — "And what state are you in?"
3. 401k setup — "Last one: does your employer offer a 401k match? And what percentage are you contributing right now?"

VOICE RULES:
- No markdown, no bullet points — spoken audio only
- Short responses: 1–2 sentences max between questions
- Warm and quick: "Got it", "Perfect", "Nice"
- After each answer, confirm what you heard in one short phrase then ask the next question
- If unclear, ask once to clarify — keep it brief

HANDLING ANSWERS:
- Salary: accept any spoken number. "Eighty five" = $85,000. "85k" = $85,000. "One twenty" = $120,000.
- State: accept full name or abbreviation. "California" = CA. "New York" = NY.
- Match: "Yes they match 5%" → hasMatch=true, matchCap=5, matchRate=100. "50 cents on the dollar up to 6" → matchRate=50, matchCap=6. "No match" or "I don't know" → hasMatch=false.
- Current %: "I put in 3 percent" → currentPct=3. "Nothing" or "zero" → currentPct=0. "The default" → currentPct=3 (assume 3%).
- If they say they don't know their current %, use 3 as default and note it.

AFTER ALL 3 QUESTIONS:
1. Call submit_leap_inputs immediately with the values you collected.
2. While the tool processes, say: "Perfect — calculating your Leap now..."
3. After the tool call completes, deliver the result narration you receive back in one short spoken paragraph. Keep it punchy — one big number, one clear action, one sentence about why it matters.
4. End with: "Your full breakdown is on screen. Check it out — and if you want WeLeap to build your complete plan, there's a sign-up at the bottom."
5. Stop. Do not ask follow-up questions.

IMPORTANT: Do NOT calculate anything yourself. Do NOT give financial advice beyond what the tool returns. Your job is only to collect inputs and narrate the result.`;

export async function POST() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    const res = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-realtime-preview',
        voice: 'alloy',
        instructions: LEAP_VOICE_INSTRUCTIONS,
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 600,
        },
        input_audio_transcription: { model: 'whisper-1' },
        tools: [
          {
            type: 'function',
            name: 'submit_leap_inputs',
            description: 'Submit all collected user inputs to calculate their Leap. Call this once you have salary, state, match details, and current contribution %.',
            parameters: {
              type: 'object',
              properties: {
                salary:      { type: 'number',  description: 'Annual gross salary in dollars, e.g. 85000' },
                state:       { type: 'string',  description: '2-letter US state code, e.g. CA, TX, NY' },
                hasMatch:    { type: 'boolean', description: 'Whether employer offers a 401k match' },
                matchCap:    { type: 'number',  description: 'Match cap as % of salary (e.g. 5 means up to 5%). Use 5 if unknown.' },
                matchRate:   { type: 'number',  description: 'Match rate as % (100 = dollar-for-dollar, 50 = 50 cents per dollar). Use 100 if unknown.' },
                currentPct:  { type: 'number',  description: 'Current 401k contribution as % of salary. Use 3 if unknown.' },
              },
              required: ['salary', 'state', 'hasMatch', 'currentPct'],
            },
          },
        ],
        tool_choice: 'auto',
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('OpenAI Realtime session error:', res.status, detail);
      return NextResponse.json({ error: `Session creation failed (${res.status})` }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('Realtime session route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
