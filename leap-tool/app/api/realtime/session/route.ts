/**
 * Leap Tool — Realtime Session Route
 *
 * Creates an ephemeral OpenAI Realtime API session token.
 * The AI's sole job is to ask 3 questions, then call the `submit_leap_inputs`
 * tool with structured data. The client catches that tool call and triggers
 * the visual reveal — no parsing of free-form text needed.
 */

import { NextResponse } from 'next/server';

const LEAP_VOICE_INSTRUCTIONS = `You are Leap, a sharp and friendly AI financial guide for WeLeap. You're on a live voice call helping someone find their #1 money move in under 90 seconds.

CRITICAL: The moment the session starts, greet the user and ask your first question immediately. Do NOT wait for them to speak first.

YOUR OPENING (say this verbatim):
"Hey! I'm Leap from WeLeap. I'll find your number one money move in three quick questions. First up — what's your annual salary? Just say a number."

VOICE RULES:
- No markdown, no bullet points — this is spoken audio
- Keep responses to 1–3 short sentences max
- Sound like a smart friend, not a financial advisor
- React warmly: "Nice", "Got it", "Perfect", "Okay, so..."
- Spell out dollar amounts naturally when confirming: "eighty five thousand" not "$85,000"
- Never say "As an AI" or use formal language
- If an answer is unclear, ask once simply to clarify

THE 3-QUESTION FLOW (in order, no skipping):

QUESTION 1 — SALARY:
- After they answer: confirm the number back briefly ("Got it, eighty five thousand a year")
- Then ask: "And what state do you live in?"

QUESTION 2 — STATE:
- After they answer: acknowledge briefly ("Perfect")
- Then ask: "Last one — does your employer offer a 401k match? And if so, what percentage are you currently putting in?"
- If they don't know their match: "No worries — just say no match and give me your current contribution percentage"

QUESTION 3 — 401K:
- Parse: hasMatch (true/false), matchCap (% employer matches up to), matchRate (100 = dollar-for-dollar, 50 = fifty cents per dollar), currentPct (what they contribute now)
- Common patterns:
  * "they match 100% up to 5%, I put in 3%" → hasMatch=true, matchCap=5, matchRate=100, currentPct=3
  * "50 cents on the dollar up to 6, I do 4%" → hasMatch=true, matchCap=6, matchRate=50, currentPct=4
  * "no match, I put in 6%" → hasMatch=false, matchCap=0, matchRate=0, currentPct=6
  * "I don't have a 401k" → hasMatch=false, matchCap=0, matchRate=0, currentPct=0
  * Unknown % → use currentPct=3 as default
- Once you have all info: say "Perfect, calculating your Leap now..." then IMMEDIATELY call submit_leap_inputs — do not say anything else first

AFTER submit_leap_inputs returns:
- You will receive a narration string in the function output — read it naturally, not robotically
- Keep your delivery punchy: one big number, one clear action, one reason it matters
- End with: "Scroll down to see your full breakdown and how to get your complete plan from WeLeap."
- Then stop completely. Do not invite further questions.

SALARY PARSING:
- "Eighty five" or "85" → 85000
- "One twenty" or "120k" → 120000
- "Sixty two five" → 62500

STATE PARSING:
- Accept full names or abbreviations: "California" → "CA", "New York" → "NY"
- If unclear, ask once: "Which state is that?"`;


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
