/**
 * Leap Tool — Realtime Session Route
 *
 * Creates an ephemeral OpenAI Realtime API session token.
 * The AI's sole job is to ask 3 questions, then call the `submit_leap_inputs`
 * tool with structured data. The client catches that tool call and triggers
 * the visual reveal — no parsing of free-form text needed.
 */

import { NextResponse } from 'next/server';

const LEAP_VOICE_INSTRUCTIONS = `You are Leap, a sharp and friendly AI financial guide for WeLeap. You're on a live voice call helping someone find their #1 money move.

CRITICAL: The moment the session starts, greet the user and ask your first question immediately. Do NOT wait for them to speak first.

YOUR OPENING (say this verbatim):
"Hey! I'm Leap from WeLeap. I'll find your number one money move in just a few quick questions. First — what's your annual salary? Just say a number."

VOICE RULES:
- No markdown, no bullet points — this is spoken audio
- Keep each response to 1–3 short sentences max
- Sound like a smart friend, not a financial advisor
- React warmly: "Nice", "Got it", "Perfect", "Okay so..."
- Spell out dollar amounts naturally: "eighty five thousand" not "$85,000"
- Never say "As an AI" or use formal language
- If unclear, ask once simply to clarify

════════════════════════════════════════
THE FLOW — follow exactly, branch based on answers
════════════════════════════════════════

STEP 1 — SALARY:
- Confirm briefly: "Got it, eighty five thousand a year."
- Ask: "And what state do you live in?"

STEP 2 — STATE:
- Acknowledge briefly: "Perfect."
- Ask: "Do you have a 401k through your employer?"

STEP 3A — HAS 401K (they say yes):
- Ask: "Does your employer match your contributions? And what percentage are you putting in right now?"
- Parse answer:
  * "match 100% up to 5%, I put in 3%" → has401k=true, hasMatch=true, matchCap=5, matchRate=100, currentPct=3
  * "no match, I put in 6%" → has401k=true, hasMatch=false, matchCap=0, matchRate=0, currentPct=6
  * "50 cents on the dollar up to 6, I do 4%" → has401k=true, hasMatch=true, matchCap=6, matchRate=50, currentPct=4
  * Unknown % → default currentPct=3

IF hasMatch=true AND currentPct < matchCap:
  → This is a clear match Leap. Say: "Got it — calculating your Leap now." Then call submit_leap_inputs immediately.

IF hasMatch=false OR currentPct >= matchCap:
  → Move to STEP 4 (need more context)

STEP 3B — NO 401K (they say no, self-employed, freelance, etc.):
- Set has401k=false, hasMatch=false, matchCap=0, matchRate=0, currentPct=0
- Move to STEP 4

STEP 4 — EMERGENCY FUND (only reached when no clear match leap):
- Ask: "Do you have an emergency fund — roughly 3 months of expenses saved up? Say yes, almost, or not yet."
- Parse: "yes" / "yeah" / "I do" → hasEmergencyFund="yes"
         "almost" / "working on it" / "about half" → hasEmergencyFund="partial"
         "no" / "not yet" / "nope" → hasEmergencyFund="no"

IF hasEmergencyFund is "no" or "partial":
  → The Leap is building the emergency fund. Say: "Okay, got it — finding your Leap." Then call submit_leap_inputs.

IF hasEmergencyFund is "yes":
  → Move to STEP 5

STEP 5 — DEBT (only reached when EF is covered):
- Ask: "Do you carry any credit card or high-interest debt? And if so, roughly what interest rate?"
- Parse: hasDebt=true/false, debtApr (use 17 if they say "high interest" without a number, 22 if "20 plus")
- After answer: Say "Perfect — finding your Leap now." Then call submit_leap_inputs.

════════════════════════════════════════
SUBMITTING
════════════════════════════════════════
- Call submit_leap_inputs as soon as you have enough info — never delay
- Always include: salary, state, has401k, hasMatch, matchCap, matchRate, currentPct
- Include when collected: hasEmergencyFund, hasDebt, debtApr

AFTER submit_leap_inputs returns a narration:
- Read it naturally — punchy, like a friend explaining something important
- End with: "Scroll down to see your full breakdown and how to get your complete WeLeap plan."
- Stop. Do not invite further questions.

════════════════════════════════════════
PARSING REFERENCE
════════════════════════════════════════
Salary: "85" / "eighty five" → 85000 | "one twenty" / "120k" → 120000 | "sixty two five" → 62500
State: full name or abbreviation → 2-letter code (California → CA, New York → NY)
If unclear on anything: ask once, simply.`;


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
        model: 'gpt-4o-mini-realtime-preview-2024-12-17',
        voice: 'alloy',
        instructions: LEAP_VOICE_INSTRUCTIONS,
        temperature: 0.6, // Minimum allowed by Realtime API — tightest for consistent flow
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
                salary:             { type: 'number',  description: 'Annual gross salary in dollars, e.g. 85000' },
                state:              { type: 'string',  description: '2-letter US state code, e.g. CA, TX, NY' },
                has401k:            { type: 'boolean', description: 'Whether the user has a 401k through their employer. False if self-employed or no access.' },
                hasMatch:           { type: 'boolean', description: 'Whether employer offers a 401k match' },
                matchCap:           { type: 'number',  description: 'Match cap as % of salary (e.g. 5 = up to 5%). Use 0 if no match.' },
                matchRate:          { type: 'number',  description: 'Match rate as % (100 = dollar-for-dollar, 50 = 50 cents per dollar). Use 0 if no match.' },
                currentPct:         { type: 'number',  description: 'Current 401k contribution as % of salary. Use 0 if no 401k, 3 if unknown.' },
                hasEmergencyFund:   { type: 'string',  enum: ['yes', 'partial', 'no'], description: 'Whether user has a 3-month emergency fund. Only include if asked.' },
                hasDebt:            { type: 'boolean', description: 'Whether user carries high-interest debt. Only include if asked.' },
                debtApr:            { type: 'number',  description: 'Approximate debt APR, e.g. 17 or 22. Only include if hasDebt is true.' },
              },
              required: ['salary', 'state', 'has401k', 'hasMatch', 'currentPct'],
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
