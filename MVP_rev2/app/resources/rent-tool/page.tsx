/**
 * Ribbit Rent Tool
 *
 * Chat mode:  Streaming text chat with the Ribbit persona.
 * Voice mode: WebRTC connection to OpenAI Realtime API — true bidirectional
 *             audio, automatic turn detection, no tapping required.
 *             Feels like a phone call.
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Send, ArrowLeft, PhoneOff, MicOff, Mic } from 'lucide-react';
import { ChatMarkdown } from '@/components/chat/ChatMarkdown';
import { ChatLoadingDots } from '@/components/chat/ChatLoadingDots';

// ─── Types ────────────────────────────────────────────────────────────────────

type InsightCard =
  | { type: 'takehome'; monthlyGross: number; takehome: number; rentMin: number; rentMax: number }
  | { type: 'market'; location: string; marketMin: number; marketMax: number; budgetMid: number }
  | { type: 'day0'; monthlyRent: number; savings: number; totalNeeded: number };

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  card?: InsightCard;
}

type CallState = 'idle' | 'connecting' | 'connected' | 'error' | 'ended';

// ─── Card Detection ───────────────────────────────────────────────────────────

/** Extract the first dollar amount matching a pattern from text. */
function parseAmt(text: string, ...patterns: RegExp[]): number | null {
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return parseInt(m[1].replace(/,/g, ''), 10);
  }
  return null;
}

/**
 * After each Ribbit message, detect which insight card to show based on
 * what numbers and keywords appear in the response.
 */
function detectCard(ribbitText: string, history: Message[]): InsightCard | null {
  const t = ribbitText;

  // Helper: find all raw numbers (3+ digits) in text
  function allNums(text: string): number[] {
    return [...text.matchAll(/\$\s*([\d,]{3,})/g)]
      .map(m => parseInt(m[1].replace(/,/g, ''), 10))
      .filter(n => n > 0);
  }

  // Helper: find a dollar range like "$1,500 to $2,000" or "$1,500 - $2,000" or "$1,500 and $2,000"
  function dollarRange(text: string): [number, number] | null {
    const m = text.match(/\$\s*([\d,]+)\s*(?:to|[-–—]|and)\s*\$\s*([\d,]+)/i);
    if (!m) return null;
    const a = parseInt(m[1].replace(/,/g, ''), 10);
    const b = parseInt(m[2].replace(/,/g, ''), 10);
    return a > 0 && b > 0 && a !== b ? [Math.min(a, b), Math.max(a, b)] : null;
  }

  // ── Card 1: Take-home + rent range ────────────────────────────────────────
  // Triggered when Ribbit mentions take-home pay AND any dollar range in same message.
  const hasTakehome = /take[- ]?home/i.test(t);

  if (hasTakehome) {
    const range = dollarRange(t);
    const nums = allNums(t);

    // Take-home: the number that appears right after "take-home" keywords, or the
    // largest plausible monthly income figure (between 2k–20k)
    const takehome =
      parseAmt(t,
        /take[- ]?home[^$\d]{0,30}\$\s*([\d,]+)/i,
        /\$\s*([\d,]+)[^.!?]{0,30}take[- ]?home/i,
      ) ??
      nums.filter(n => n >= 2000 && n <= 20000).sort((a, b) => b - a)[0] ??
      null;

    if (range && takehome) {
      const [rentMin, rentMax] = range;
      // Sanity: rent range must be smaller than take-home and look like rent ($500–$8k)
      if (rentMin >= 500 && rentMax <= 10000 && rentMin < takehome) {
        const lastUser = [...history].reverse().find(m => m.isUser)?.text ?? '';
        const grossRaw = parseAmt(lastUser, /([\d,]{5,})/);
        const monthlyGross = grossRaw
          ? Math.round(grossRaw / 12)
          : Math.round(takehome / 0.68);
        return { type: 'takehome', monthlyGross, takehome, rentMin, rentMax };
      }
    }
  }

  // ── Card 2: Market rent comparison ────────────────────────────────────────
  // Triggered when Ribbit gives actual market rent figures for a location.
  // "range" alone is intentionally excluded — it also appears in "Rent Target Range"
  // in the final recommendation, which would create a false market card.
  const hasMarket = /(?:market\s+rent|typical\s+rent|average\s+rent|typical|average|one[- ]bedroom|1[- ]bed(?:room)?|studio)/i.test(t);
  const range2 = dollarRange(t);

  if (hasMarket && range2 && !hasTakehome) {
    const [marketMin, marketMax] = range2;
    if (marketMin >= 500 && marketMax <= 15000) {
      const takehomeCard = history.find(m => m.card?.type === 'takehome')?.card as
        Extract<InsightCard, { type: 'takehome' }> | undefined;
      const budgetMid = takehomeCard
        ? Math.round((takehomeCard.rentMin + takehomeCard.rentMax) / 2)
        : 0;

      const lastUser = [...history].reverse().find(m => m.isUser)?.text ?? '';
      const location = lastUser.trim().length < 40 ? lastUser.trim() : 'your area';

      return { type: 'market', location, marketMin, marketMax, budgetMid };
    }
  }

  // ── Card 3: Day 0 move-in costs ───────────────────────────────────────────
  // Triggered when Ribbit explains upfront move-in costs.
  const hasDay0 = /(?:day\s*0|first.month|upfront|security.deposit|move[- ]in)/i.test(t);

  if (hasDay0) {
    const nums = allNums(t);

    // Derive monthly rent from the market card so line items are consistent
    const marketCard = history.find(m => m.card?.type === 'market')?.card as
      Extract<InsightCard, { type: 'market' }> | undefined;
    const monthlyRent = marketCard
      ? Math.round((marketCard.marketMin + marketCard.marketMax) / 2)
      : 3000;

    // totalNeeded: prefer an explicit "X upfront" or "total of X" phrase.
    // We intentionally do NOT use "needed" as a trailing keyword because
    // "you'd be just shy of what's needed" would falsely match the savings amount.
    const totalNeeded =
      parseAmt(t,
        // keyword BEFORE amount:  "roughly $5,600 upfront", "need about $8,400"
        /(?:looking\s+at|need(?:ing)?|cost(?:s|ing)?|spend|total)[^$\d]{0,30}\$\s*([\d,]+)/i,
        // amount THEN "upfront" or "total" (not "needed"):
        /\$\s*([\d,]+)[^.!?]{0,20}upfront/i,
        /\$\s*([\d,]+)[^.!?]{0,20}(?:total|overall)/i,
      ) ??
      // Smart fallback: the amount closest to 3× monthly rent is the move-in total
      (nums.length > 0
        ? nums.filter(n => n < 30000).sort((a, b) =>
            Math.abs(a - monthlyRent * 3) - Math.abs(b - monthlyRent * 3)
          )[0]
        : null);

    const lastUser = [...history].reverse().find(m => m.isUser)?.text ?? '';
    const savings = parseAmt(lastUser, /([\d,]{3,})/);

    const derivedTotal = totalNeeded ?? monthlyRent * 3;

    if (savings != null && monthlyRent) {
      return { type: 'day0', monthlyRent, savings, totalNeeded: derivedTotal };
    }
  }

  return null;
}

// ─── Insight Card Components ──────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function TakehomeCard({ card }: { card: Extract<InsightCard, { type: 'takehome' }> }) {
  const taxes = card.monthlyGross - card.takehome;
  const taxPct = card.monthlyGross > 0 ? Math.round((taxes / card.monthlyGross) * 100) : 30;
  const rentPct = Math.round(((card.rentMin + card.rentMax) / 2 / card.takehome) * 100);

  return (
    <div className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm dark:border-emerald-900/50 dark:bg-emerald-950/30">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 mb-3">
        How we got your take-home
      </p>
      <div className="space-y-1.5 text-slate-700 dark:text-slate-300">
        <div className="flex justify-between">
          <span>Monthly gross</span>
          <span className="font-medium">${fmt(card.monthlyGross)}</span>
        </div>
        <div className="flex justify-between text-red-500 dark:text-red-400">
          <span>Est. taxes & deductions (~{taxPct}%)</span>
          <span>−${fmt(taxes)}</span>
        </div>
        <div className="flex justify-between border-t border-emerald-200 dark:border-emerald-800 pt-1.5 font-semibold text-slate-900 dark:text-slate-100">
          <span>Monthly take-home</span>
          <span>${fmt(card.takehome)}</span>
        </div>
      </div>

      {/* Rent range bar */}
      <div className="mt-3">
        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
          <span>25–30% rent guideline</span>
          <span>${fmt(card.rentMin)} – ${fmt(card.rentMax)}/mo</span>
        </div>
        <div className="relative h-5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div
            className="absolute top-0 h-full bg-emerald-300 dark:bg-emerald-700 rounded-full"
            style={{ left: `${Math.round((card.rentMin / card.takehome) * 100)}%`, width: `${Math.round(((card.rentMax - card.rentMin) / card.takehome) * 100)}%` }}
          />
          <div
            className="absolute top-0 left-0 h-full bg-emerald-500 dark:bg-emerald-500 rounded-full"
            style={{ width: `${Math.round((card.rentMin / card.takehome) * 100)}%` }}
          />
          <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white drop-shadow-sm">
            ~{rentPct}% of take-home
          </span>
        </div>
      </div>
    </div>
  );
}

function MarketCard({ card }: { card: Extract<InsightCard, { type: 'market' }> }) {
  const max = Math.max(card.marketMax, card.budgetMid) * 1.1;
  const budgetPct = Math.round((card.budgetMid / max) * 100);
  const marketMidPct = Math.round(((card.marketMin + card.marketMax) / 2 / max) * 100);
  const gap = Math.round((card.marketMin + card.marketMax) / 2) - card.budgetMid;
  const overBudget = gap > 0;

  return (
    <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm dark:border-blue-900/50 dark:bg-blue-950/30">
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400 mb-3">
        Your budget vs {card.location} market
      </p>
      <div className="space-y-2.5">
        <div>
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>Your budget</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">${fmt(card.budgetMid)}/mo</span>
          </div>
          <div className="h-4 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${budgetPct}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>Typical 1BR</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">${fmt(card.marketMin)}–${fmt(card.marketMax)}/mo</span>
          </div>
          <div className="h-4 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div className="h-full rounded-full bg-blue-400" style={{ width: `${marketMidPct}%` }} />
          </div>
        </div>
      </div>
      <div className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium ${overBudget ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'}`}>
        {overBudget
          ? `~$${fmt(gap)}/mo gap for solo — a roommate could close it`
          : `Your budget fits the market — you have some room to work with`}
      </div>
    </div>
  );
}

function Day0Card({ card }: { card: Extract<InsightCard, { type: 'day0' }> }) {
  const covered = card.savings >= card.totalNeeded;
  const shortfall = card.totalNeeded - card.savings;
  const savingsPct = Math.min(100, Math.round((card.savings / card.totalNeeded) * 100));

  return (
    <div className="mt-2 rounded-xl border border-violet-100 bg-violet-50/60 p-4 text-sm dark:border-violet-900/50 dark:bg-violet-950/30">
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-400 mb-3">
        Day 0 move-in math
      </p>
      <div className="space-y-1.5 text-slate-700 dark:text-slate-300">
        <div className="flex justify-between">
          <span>First month</span>
          <span>${fmt(card.monthlyRent)}</span>
        </div>
        <div className="flex justify-between">
          <span>Last month</span>
          <span>${fmt(card.monthlyRent)}</span>
        </div>
        <div className="flex justify-between">
          <span>Security deposit</span>
          <span>~${fmt(card.monthlyRent)}</span>
        </div>
        <div className="flex justify-between border-t border-violet-200 dark:border-violet-800 pt-1.5 font-semibold text-slate-900 dark:text-slate-100">
          <span>Total needed</span>
          <span>${fmt(card.totalNeeded)}</span>
        </div>
      </div>

      {/* Savings progress */}
      <div className="mt-3">
        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
          <span>Your savings</span>
          <span className={covered ? 'text-emerald-600 font-medium' : 'text-amber-600 font-medium'}>
            ${fmt(card.savings)} ({savingsPct}%)
          </span>
        </div>
        <div className="h-4 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${covered ? 'bg-emerald-500' : 'bg-amber-400'}`}
            style={{ width: `${savingsPct}%` }}
          />
        </div>
        {!covered && (
          <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
            ${fmt(shortfall)} short — about {Math.ceil(shortfall / 500)} months of saving $500/mo
          </p>
        )}
        {covered && (
          <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            You're covered — you can move now
          </p>
        )}
      </div>
    </div>
  );
}

function InsightCardView({ card }: { card: InsightCard }) {
  if (card.type === 'takehome') return <TakehomeCard card={card} />;
  if (card.type === 'market') return <MarketCard card={card} />;
  if (card.type === 'day0') return <Day0Card card={card} />;
  return null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RIBBIT_OPENING_CHAT =
  "Hey! I'm Ribbit, your rent sidekick 🐸 I'll help you figure out what rent actually makes sense for your situation — and give you a few real insights along the way.\n\nLet's start simple: **what's your gross annual income?** (That's before taxes — your full salary or estimated yearly earnings.)";

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Ribbit Avatar ────────────────────────────────────────────────────────────

function RibbitAvatar({ className = '' }: { className?: string }) {
  return (
    <div className={`overflow-hidden rounded-full bg-black shrink-0 ${className}`}>
      <img
        src="/ribbit.png"
        alt="Ribbit"
        className="h-full w-full object-cover"
        style={{ objectPosition: '50% 10%' }}
      />
    </div>
  );
}

// Wake listener removed — voice is now started by clicking the Ribbit icon.

// ─── Realtime Voice Session ───────────────────────────────────────────────────

interface RealtimeSessionProps {
  onMessage: (msg: Message) => void;
  onUpdateMessage: (id: string, text: string) => void;
  onStateChange: (state: CallState) => void;
  onResponseComplete: (text: string) => void;
}

function RealtimeSession({ onMessage, onUpdateMessage, onStateChange, onResponseComplete }: RealtimeSessionProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isRibbitSpeaking, setIsRibbitSpeaking] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micTrackRef = useRef<MediaStreamTrack | null>(null);
  const streamingIdRef = useRef<string | null>(null);
  const streamingTextRef = useRef('');
  const pendingUserMsgIdRef = useRef<string | null>(null);

  // Callbacks via ref so the data channel handler always has fresh versions
  const onMessageRef = useRef(onMessage);
  const onUpdateRef = useRef(onUpdateMessage);
  const onResponseCompleteRef = useRef(onResponseComplete);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onUpdateRef.current = onUpdateMessage; }, [onUpdateMessage]);
  useEffect(() => { onResponseCompleteRef.current = onResponseComplete; }, [onResponseComplete]);

  const cleanupConnection = useCallback(() => {
    micTrackRef.current?.stop();
    dcRef.current?.close();
    pcRef.current?.close();
    micTrackRef.current = null;
    dcRef.current = null;
    pcRef.current = null;
  }, []);

  const handleDisconnect = useCallback(() => {
    cleanupConnection();
    onStateChange('ended');
  }, [cleanupConnection, onStateChange]);

  const toggleMute = useCallback(() => {
    if (!micTrackRef.current) return;
    micTrackRef.current.enabled = !micTrackRef.current.enabled;
    setIsMuted((v) => !v);
  }, []);

  // Handle events from the OpenAI Realtime data channel
  const handleEvent = useCallback((raw: string) => {
    let evt: any;
    try { evt = JSON.parse(raw); } catch { return; }

    switch (evt.type) {
      case 'input_audio_buffer.speech_started':
        setIsUserSpeaking(true);
        break;

      case 'input_audio_buffer.speech_stopped':
        setIsUserSpeaking(false);
        // Add a placeholder immediately so the user's bubble appears BEFORE Ribbit responds
        {
          const placeholderId = makeId();
          pendingUserMsgIdRef.current = placeholderId;
          onMessageRef.current({ id: placeholderId, text: '…', isUser: true, timestamp: new Date() });
        }
        break;

      // Ribbit's spoken transcript arrives incrementally
      case 'response.audio_transcript.delta':
        if (!streamingIdRef.current) {
          const id = makeId();
          streamingIdRef.current = id;
          streamingTextRef.current = '';
          setIsRibbitSpeaking(true);
          onMessageRef.current({ id, text: '', isUser: false, timestamp: new Date() });
        }
        streamingTextRef.current += evt.delta ?? '';
        onUpdateRef.current(streamingIdRef.current, streamingTextRef.current);
        break;

      // Ribbit's full response turn is complete — trigger card detection
      case 'response.done':
        setIsRibbitSpeaking(false);
        if (streamingTextRef.current) {
          onResponseCompleteRef.current(streamingTextRef.current);
        }
        streamingIdRef.current = null;
        streamingTextRef.current = '';
        break;

      // User's speech transcript — fill in the placeholder that was created on speech_stopped
      case 'conversation.item.input_audio_transcription.completed':
        if (evt.transcript?.trim()) {
          if (pendingUserMsgIdRef.current) {
            onUpdateRef.current(pendingUserMsgIdRef.current, evt.transcript);
            pendingUserMsgIdRef.current = null;
          } else {
            onMessageRef.current({ id: makeId(), text: evt.transcript, isUser: true, timestamp: new Date() });
          }
        } else if (pendingUserMsgIdRef.current) {
          // Empty transcript — remove the placeholder
          onUpdateRef.current(pendingUserMsgIdRef.current, '');
          pendingUserMsgIdRef.current = null;
        }
        break;

      case 'error':
        console.error('Realtime API error:', evt);
        setCallError(evt.error?.message ?? 'An error occurred during the call.');
        break;
    }
  }, []);

  // Start WebRTC connection on mount
  useEffect(() => {
    let cancelled = false;

    async function startSession() {
      try {
        // 1. Get an ephemeral session token from our server
        const tokenRes = await fetch('/api/realtime/session', { method: 'POST' });
        if (!tokenRes.ok) {
          const d = await tokenRes.json().catch(() => ({}));
          throw new Error(d.error ?? 'Could not create session. Check your OpenAI API key.');
        }
        const sessionData = await tokenRes.json();
        const ephemeralKey = sessionData.client_secret?.value;
        if (!ephemeralKey) throw new Error('Invalid session response from server.');

        if (cancelled) return;

        // 2. Get microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        micTrackRef.current = stream.getTracks()[0];

        // 3. Create WebRTC peer connection
        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        // 4. Wire up Ribbit's audio output to a hidden <audio> element
        pc.ontrack = (e) => {
          const el = document.getElementById('ribbit-audio') as HTMLAudioElement | null;
          if (el) el.srcObject = e.streams[0];
        };

        // 5. Add microphone as audio input
        pc.addTrack(micTrackRef.current);

        // 6. Data channel carries events (transcripts, VAD signals, etc.)
        const dc = pc.createDataChannel('oai-events');
        dcRef.current = dc;

        dc.addEventListener('message', (e) => handleEvent(e.data));

        dc.addEventListener('open', () => {
          if (cancelled) return;
          onStateChange('connected');
          // Trigger Ribbit's opening greeting immediately
          dc.send(JSON.stringify({ type: 'response.create' }));
        });

        dc.addEventListener('close', () => {
          if (!cancelled) onStateChange('ended');
        });

        // 7. SDP offer/answer with OpenAI's Realtime endpoint
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const sdpRes = await fetch(
          'https://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview',
          {
            method: 'POST',
            body: offer.sdp,
            headers: {
              Authorization: `Bearer ${ephemeralKey}`,
              'Content-Type': 'application/sdp',
            },
          }
        );

        if (!sdpRes.ok) {
          const detail = await sdpRes.text().catch(() => '');
          throw new Error(`WebRTC negotiation failed (${sdpRes.status}). ${detail}`);
        }

        await pc.setRemoteDescription({ type: 'answer', sdp: await sdpRes.text() });

      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Connection failed.';
        setCallError(msg);
        onStateChange('error');
      }
    }

    startSession();

    return () => {
      cancelled = true;
      cleanupConnection();
    };
  }, [handleEvent, onStateChange, cleanupConnection]);

  return (
    <div className="flex flex-col items-center gap-6 py-6 px-4">
      {/* Hidden audio element — Ribbit's voice plays here via WebRTC */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio id="ribbit-audio" autoPlay playsInline />

      {/* Speaking avatars */}
      <div className="flex items-center gap-8">
        {/* Ribbit */}
        <div className="flex flex-col items-center gap-2">
          <RibbitAvatar className={`h-16 w-16 transition-all duration-300 ${
              isRibbitSpeaking
                ? 'ring-4 ring-emerald-300 ring-offset-2 shadow-xl shadow-emerald-200 dark:shadow-emerald-900 scale-105'
                : ''
            }`} />
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Ribbit</span>
        </div>

        {/* Animated call bars */}
        <div className="flex items-center gap-[3px] h-8">
          {[0.6, 1, 0.7, 0.9, 0.5].map((scale, i) => (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-200 ${
                isRibbitSpeaking
                  ? 'bg-emerald-400'
                  : isUserSpeaking
                  ? 'bg-blue-400'
                  : 'bg-slate-200 dark:bg-slate-700'
              }`}
              style={{
                height:
                  isRibbitSpeaking || isUserSpeaking
                    ? `${10 + scale * 18}px`
                    : '6px',
                animationDelay: `${i * 80}ms`,
                animation:
                  isRibbitSpeaking || isUserSpeaking
                    ? `pulse ${0.6 + scale * 0.4}s ease-in-out infinite alternate`
                    : 'none',
              }}
            />
          ))}
        </div>

        {/* User */}
        <div className="flex flex-col items-center gap-2">
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-3xl dark:bg-slate-800 transition-all duration-300 ${
              isUserSpeaking
                ? 'ring-4 ring-blue-300 ring-offset-2 shadow-xl shadow-blue-100 dark:shadow-blue-900 scale-105'
                : ''
            }`}
          >
            👤
          </div>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">You</span>
        </div>
      </div>

      {/* Status text */}
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 min-h-5">
        {callError
          ? null
          : isRibbitSpeaking
          ? 'Ribbit is speaking…'
          : isUserSpeaking
          ? 'Listening to you…'
          : isMuted
          ? 'You are muted'
          : 'Speak anytime'}
      </p>

      {/* Error */}
      {callError && (
        <div className="max-w-sm rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 text-center dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {callError}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-8">
        {/* Mute toggle */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            onClick={toggleMute}
            className={`flex h-12 w-12 items-center justify-center rounded-full border-2 transition-colors ${
              isMuted
                ? 'border-red-300 bg-red-50 text-red-600 dark:border-red-700 dark:bg-red-950 dark:text-red-400'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
            }`}
            aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          <span className="text-xs text-slate-400">{isMuted ? 'Unmute' : 'Mute'}</span>
        </div>

        {/* End call */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            onClick={handleDisconnect}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-200 hover:bg-red-600 transition-colors dark:shadow-red-900"
            aria-label="End call"
          >
            <PhoneOff className="h-6 w-6" />
          </button>
          <span className="text-xs text-slate-400">End call</span>
        </div>
      </div>
    </div>
  );
}

// ─── Idle / Click-to-Start State ─────────────────────────────────────────────
// Shown when voice mode is active but no call is in progress.
// Clicking the Ribbit icon starts the call.

function WakeListeningState({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <button
        onClick={onStart}
        aria-label="Start voice conversation with Ribbit"
        className="group relative flex h-24 w-24 items-center justify-center focus:outline-none"
      >
        {/* Hover glow ring */}
        <div className="absolute inset-0 rounded-full bg-emerald-100 opacity-0 transition-opacity duration-300 group-hover:opacity-70 dark:bg-emerald-900/50" />
        {/* Subtle idle pulse */}
        <div className="absolute inset-2 animate-pulse rounded-full bg-emerald-50 opacity-40 dark:bg-emerald-900/30" style={{ animationDuration: '2.5s' }} />
        <RibbitAvatar className="relative h-16 w-16 shadow-lg transition-transform duration-200 group-hover:scale-110 group-active:scale-95" />
      </button>
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
        Click Ribbit to start your voice conversation
      </p>
      <p className="text-xs text-slate-400 dark:text-slate-500">Tap the icon above to connect</p>
    </div>
  );
}

// ─── Connecting Spinner ───────────────────────────────────────────────────────

function ConnectingState() {
  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-emerald-100 opacity-70 dark:bg-emerald-900/50" />
        <RibbitAvatar className="relative h-16 w-16 shadow-lg" />
      </div>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Connecting…</p>
    </div>
  );
}

// ─── Call Ended State ─────────────────────────────────────────────────────────
// Briefly shows "Call ended" then auto-returns to wake-listening state.

function CallEndedState({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="flex flex-col items-center gap-2 py-8">
      <RibbitAvatar className="h-16 w-16 opacity-50" />
      <p className="text-sm text-slate-400 dark:text-slate-500">Call ended</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RentToolPage() {
  const [mode, setMode] = useState<'chat' | 'voice'>('chat');
  const [messages, setMessages] = useState<Message[]>([
    { id: 'init', text: RIBBIT_OPENING_CHAT, isUser: false, timestamp: new Date() },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [callState, setCallState] = useState<CallState>('idle');
  // Key forces RealtimeSession to remount cleanly on restart
  const [sessionKey, setSessionKey] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isLoadingRef = useRef(false);
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { isLoadingRef.current = isLoading; }, [isLoading]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, callState]);

  // Callbacks for RealtimeSession
  const addMessage = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const updateMessage = useCallback((id: string, text: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text } : m)));
  }, []);

  // Attach an insight card to the most recent Ribbit message
  const attachCard = useCallback((ribbitText: string) => {
    setMessages((prev) => {
      const card = detectCard(ribbitText, prev);
      if (!card) return prev;
      // Find the last Ribbit message (should be the one just completed)
      const lastRibbit = [...prev].reverse().find((m) => !m.isUser);
      if (!lastRibbit) return prev;
      return prev.map((m) => (m.id === lastRibbit.id ? { ...m, card } : m));
    });
  }, []);

  // Switch mode: reset conversation
  const switchMode = useCallback((newMode: 'chat' | 'voice') => {
    if (newMode === mode) return;
    setMode(newMode);
    setCallState('idle');
    setChatError(null);
    setInput('');
    // Voice mode starts with an empty transcript — Ribbit will speak first via WebRTC
    setMessages(
      newMode === 'chat'
        ? [{ id: makeId(), text: RIBBIT_OPENING_CHAT, isUser: false, timestamp: new Date() }]
        : []
    );
  }, [mode]);

  const restartCall = useCallback(() => {
    setCallState('idle');
    setMessages([]); // clear transcript so next call starts fresh
    setSessionKey((k) => k + 1);
  }, []);

  // Start a voice call when the user clicks the Ribbit icon
  const handleStartCall = useCallback(() => {
    setCallState('connecting');
  }, []);

  // ── Chat send ──────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoadingRef.current) return;

    setInput('');
    setChatError(null);
    setIsLoading(true);
    isLoadingRef.current = true;

    const userMsg: Message = { id: makeId(), text, isUser: true, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);

    const history = [...messagesRef.current, userMsg];
    const ribbitId = makeId();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, context: 'ribbit-rent', stream: true }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error ?? 'Something went wrong. Please try again.');
      }

      setMessages((prev) => [
        ...prev,
        { id: ribbitId, text: '', isUser: false, timestamp: new Date() },
      ]);

      const contentType = res.headers.get('Content-Type') ?? '';
      if (contentType.includes('text/event-stream') && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        let full = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split('\n\n');
          buf = parts.pop() ?? '';
          for (const part of parts) {
            const line = part.split('\n').find((l) => l.startsWith('data: '));
            if (!line) continue;
            try {
              const d = JSON.parse(line.slice(6).trim());
              if (d.text) {
                full += d.text;
                setMessages((prev) =>
                  prev.map((m) => (m.id === ribbitId ? { ...m, text: full } : m))
                );
              }
            } catch (_) {}
          }
        }
        reader.releaseLock();
        attachCard(full);
      } else {
        const d = await res.json();
        const text = d.response ?? 'I had trouble responding. Please try again.';
        setMessages((prev) =>
          prev.map((m) => (m.id === ribbitId ? { ...m, text } : m))
        );
        attachCard(text);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setChatError(msg);
      setMessages((prev) => prev.filter((m) => m.id !== ribbitId));
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
      inputRef.current?.focus();
    }
  }, [input]);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen flex-col bg-slate-50 dark:bg-slate-950">
      {/* ── Header ── */}
      <header className="shrink-0 border-b bg-white dark:bg-slate-900">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
          <Link
            href="/resources"
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Resources</span>
          </Link>

          <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />

          <div className="flex flex-1 items-center gap-2.5">
            <RibbitAvatar className="h-8 w-8 shadow-sm" />
            <div>
              <p className="text-sm font-semibold leading-none text-slate-900 dark:text-slate-100">Ribbit</p>
              <p className="text-xs leading-none mt-0.5 text-slate-500 dark:text-slate-400">Rent Sidekick · by WeLeap</p>
            </div>
          </div>

          {/* Live call indicator */}
          {callState === 'connected' && (
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 dark:bg-emerald-950">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Live</span>
            </div>
          )}

          {/* Mode toggle */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
            {(['chat', 'voice'] as const).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  mode === m
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Transcript / Messages ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
          {/* Voice mode label */}
          {mode === 'voice' && messages.length === 0 && callState === 'connecting' && null}

          {messages.filter((msg) => msg.text.trim().length > 0).map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${msg.isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {!msg.isUser && (
                <RibbitAvatar className="mt-0.5 h-7 w-7 shadow-sm" />
              )}
              <div className="flex max-w-[80%] flex-col">
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.isUser
                      ? 'rounded-tr-sm bg-primary text-primary-foreground'
                      : 'rounded-tl-sm border border-slate-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800'
                  }`}
                >
                  {msg.isUser ? (
                    <p>{msg.text}</p>
                  ) : (
                    <ChatMarkdown size="base">{msg.text || ' '}</ChatMarkdown>
                  )}
                </div>
                {/* Insight card rendered below Ribbit's bubble */}
                {msg.card && <InsightCardView card={msg.card} />}
              </div>
            </div>
          ))}

          {/* Chat loading dots */}
          {isLoading && messages[messages.length - 1]?.text === '' && (
            <div className="flex gap-2.5">
              <RibbitAvatar className="mt-0.5 h-7 w-7 shadow-sm" />
              <div className="rounded-2xl rounded-tl-sm border border-slate-100 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <ChatLoadingDots />
              </div>
            </div>
          )}

          {/* Chat error */}
          {chatError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
              {chatError}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── CHAT INPUT ── */}
      {mode === 'chat' && (
        <div className="shrink-0 border-t bg-white px-4 py-3 dark:bg-slate-900">
          <div className="mx-auto flex max-w-2xl items-end gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
              }}
              placeholder="Type your answer…"
              rows={1}
              disabled={isLoading}
              autoFocus
              style={{ maxHeight: '120px', overflowY: 'auto' }}
              className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              aria-label="Send"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-slate-400 dark:text-slate-600">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      )}

      {/* ── VOICE CALL UI ── */}
      {mode === 'voice' && (
        <div className="shrink-0 border-t bg-white dark:bg-slate-900">
          {callState === 'idle' && <WakeListeningState onStart={handleStartCall} />}

          {/* RealtimeSession mounts on 'connecting' and manages its own connected/error states */}
          {(callState === 'connecting' || callState === 'connected' || callState === 'error') && (
            <>
              {callState === 'connecting' && <ConnectingState />}
              <div className={callState === 'connecting' ? 'hidden' : ''}>
                <RealtimeSession
                  key={sessionKey}
                  onMessage={addMessage}
                  onUpdateMessage={updateMessage}
                  onStateChange={setCallState}
                  onResponseComplete={attachCard}
                />
              </div>
            </>
          )}

          {callState === 'ended' && <CallEndedState onDone={restartCall} />}
        </div>
      )}
    </div>
  );
}
