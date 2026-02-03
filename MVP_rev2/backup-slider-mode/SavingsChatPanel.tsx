/**
 * Chat-first panel for Savings Allocation tool.
 * Shows contextual intro, plan summary, Confirm & Apply / Adjust plan / Not now.
 * Reuses existing chat thread UI + input; does NOT change API wiring.
 * TODO Phase 2B: Income Allocation chat-first wrapper.
 * TODO Phase 2C: Money Sweeper chat-first flow.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { sendChatMessage } from '@/lib/chat/chatService';
import type { ProposedPlan } from '@/lib/tools/savings/types';
import type { SavingsAllocationExplain, DeltaRowId } from '@/lib/tools/savings/explain';

const WHY_KEY_COPY: Record<DeltaRowId, string> = {
  EMPLOYER_MATCH: 'Capture employer match — free money.',
  '401K_CONTRIB': 'Save in your 401(k) for retirement.',
  HSA: 'Tax-advantaged health savings.',
  EMERGENCY_FUND: 'Build a buffer for emergencies.',
  HIGH_APR_DEBT: 'Pay down high-interest debt for a guaranteed return.',
  RETIREMENT: 'Tax-advantaged retirement (Roth IRA, etc.).',
  BROKERAGE: 'Invest in a taxable brokerage for flexibility.',
};

export interface SavingsChatPanelProps {
  /** Intro message (seeded assistant) — contextual based on leap or "Review savings allocation" */
  introMessage: string;
  /** Current proposed plan (from engine or UI edits) */
  proposedPlan: ProposedPlan;
  /** Whether the proposed plan has been confirmed/applied */
  isConfirmed: boolean;
  /** Open confirmation modal (parent handles modal) */
  onConfirmApply: () => void;
  /** Scroll to "Adjust allocation" section */
  onAdjustPlan: () => void;
  /** Not now — route to feed, optional cooldown */
  onNotNow: () => void;
  /** Compact user state for chat context (safe subset) */
  userStateForChat?: Record<string, unknown>;
  /** Baseline (current/saved) plan for chat — so Ribbit can explain current vs proposed */
  baselinePlanForChat?: {
    planSteps: Array<{ id: string; type: string; label: string; amountMonthly?: number }>;
    totals: Record<string, unknown>;
    assumptions: string[];
    warnings?: string[];
    keyMetric?: { label: string; value: string };
  } | null;
  /** Current context for chat (source, leapId, leapType) */
  currentContextForChat?: { source?: string; leapId?: string; leapType?: string };
  /** When set, show as assistant message (plan updated by user edit, not applied yet) */
  pendingUpdateMessage?: string | null;
  /** Engine-only explain (toolOutput.explain) — Sidekick uses ONLY these numbers */
  toolOutputExplain?: SavingsAllocationExplain | null;
  /** Called when user confirms a deviation in chat (e.g. "Yes, reduce EF by $200"). Parent should update the proposed plan so UI shows current vs proposed. */
  onUserRequestedPlanChange?: (constraint: {
    category: 'ef' | 'debt' | 'retirementExtra' | 'brokerage';
    delta: number;
  }) => void;
  /** When user has made custom changes, override delta to show current (baseline) vs proposed (custom). Ensures "Not applied yet" and delta table appear. */
  deltaOverride?: {
    headline?: string;
    rows: Array<{ id: string; label: string; current: { monthly: number }; proposed: { monthly: number } }>;
    isNoChange?: boolean;
  } | null;
}

/** Confirmation words — only apply UI update when user has confirmed (not on initial request). */
const CONFIRM_WORDS = /^(?:yes|ok|sure|confirm|do\s+it|go\s+ahead|sounds\s+good|please|apply|that\s+works)/i;
const HAS_CONFIRM = /(?:^|[\s,])(?:yes|ok|sure|confirm|do\s+it|go\s+ahead|sounds\s+good|please\s+do|apply|that\s+works)(?:[\s,]|$)/i;

/** Parse user message for deviation CONFIRMATION. Only triggers when user confirms (yes/ok/etc), not on initial "reduce EF by $200" request. */
function parseDeviationConfirmation(
  text: string,
  recentAssistantText?: string
): { category: 'ef' | 'debt' | 'retirementExtra' | 'brokerage'; delta: number } | null {
  const t = text.toLowerCase().trim();
  const numMatch = t.match(/\$?(\d+)/);
  if (!numMatch) return null;
  const amount = parseInt(numMatch[1], 10);
  if (amount <= 0) return null;

  const hasConfirm = HAS_CONFIRM.test(t) || CONFIRM_WORDS.test(t);
  if (!hasConfirm) return null;

  const ctx = (recentAssistantText ?? '').toLowerCase();
  const reduceItMatch = /reduce\s+it\s+by\s+\$?\d+/i.test(t);
  const reduceEf = /(?:reduce|go\s+ahead).*?(?:emergency\s*fund|ef)\s+by\s+\$?\d+/i.test(t) ||
    (reduceItMatch && /(?:emergency| ef |buffer)/i.test(ctx));
  const reduceDebt = /(?:reduce|go\s+ahead).*?(?:debt|high\s*[- ]?apr)\s+by\s+\$?\d+/i.test(t) ||
    (reduceItMatch && /debt/i.test(ctx));
  const reduceRetirement = /(?:reduce|go\s+ahead).*?(?:retirement|roth|ira)\s+by\s+\$?\d+/i.test(t) ||
    (reduceItMatch && /(?:retirement|roth|ira)/i.test(ctx));
  const reduceBrokerage = /(?:reduce|go\s+ahead).*?(?:brokerage|investing)\s+by\s+\$?\d+/i.test(t) ||
    (reduceItMatch && /(?:brokerage|investing)/i.test(ctx));

  if (reduceEf) return { category: 'ef', delta: -amount };
  if (reduceDebt) return { category: 'debt', delta: -amount };
  if (reduceRetirement) return { category: 'retirementExtra', delta: -amount };
  if (reduceBrokerage) return { category: 'brokerage', delta: -amount };

  if (reduceItMatch) {
    if (/(?:emergency| ef |buffer)/i.test(ctx)) return { category: 'ef', delta: -amount };
    if (/debt/i.test(ctx)) return { category: 'debt', delta: -amount };
    if (/(?:retirement|roth|ira)/i.test(ctx)) return { category: 'retirementExtra', delta: -amount };
    if (/(?:brokerage|investing)/i.test(ctx)) return { category: 'brokerage', delta: -amount };
  }

  // Increase patterns (delta is positive) — also require confirmation
  if (hasConfirm && /increase\s+(?:emergency\s*fund|ef)\s+by\s+\$?\d+/i.test(t)) return { category: 'ef', delta: amount };
  if (hasConfirm && /increase\s+(?:debt|high\s*[- ]?apr)\s+by\s+\$?\d+/i.test(t)) return { category: 'debt', delta: amount };
  if (hasConfirm && /increase\s+(?:retirement|roth|ira)\s+by\s+\$?\d+/i.test(t)) return { category: 'retirementExtra', delta: amount };
  if (hasConfirm && /increase\s+(?:brokerage|investing)\s+by\s+\$?\d+/i.test(t)) return { category: 'brokerage', delta: amount };

  return null;
}

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export function SavingsChatPanel({
  introMessage,
  proposedPlan,
  isConfirmed,
  onConfirmApply,
  onAdjustPlan,
  onNotNow,
  userStateForChat = {},
  baselinePlanForChat = null,
  currentContextForChat = {},
  pendingUpdateMessage = null,
  toolOutputExplain = null,
  onUserRequestedPlanChange = undefined,
  deltaOverride = null,
}: SavingsChatPanelProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '0', text: introMessage, isUser: false, timestamp: new Date() },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatThreadContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll only the chat thread area so new messages are visible; do not scroll the page (avoids jumping to net worth chart)
  useEffect(() => {
    const el = chatThreadContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? chatInput).trim();
    if (!text || isLoading) return;
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text,
      isUser: true,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    if (!overrideText) setChatInput('');
    setIsLoading(true);

    // When user confirms a deviation (e.g. "Yes, reduce EF by $200"), update the proposed plan so UI shows current vs proposed
    const lastAssistant = messages.filter((m) => !m.isUser).pop();
    const parsed = parseDeviationConfirmation(text, lastAssistant?.text);
    if (parsed && onUserRequestedPlanChange) {
      onUserRequestedPlanChange(parsed);
    }

    try {
      const proposedPlanCompact = {
        planSteps: proposedPlan.steps.slice(0, 5),
        totals: proposedPlan.totals,
        assumptions: proposedPlan.assumptions.slice(0, 5),
        warnings: proposedPlan.warnings ?? [],
        keyMetric: proposedPlan.keyMetric,
        ...(toolOutputExplain && { explain: toolOutputExplain }),
      };
      const response = await sendChatMessage({
        messages: [...messages, userMessage].map((m) => ({
          id: m.id,
          text: m.text,
          isUser: m.isUser,
          timestamp: m.timestamp,
        })),
        context: 'savings-allocator',
        userPlanData: {
          ...userStateForChat,
          toolOutput: proposedPlanCompact,
          baselinePlan: baselinePlanForChat ?? undefined,
          currentContext: currentContextForChat,
        },
      });
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), text: response, isUser: false, timestamp: new Date() },
      ]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Something went wrong.';
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), text: `I couldn't complete that: ${errMsg}`, isUser: false, timestamp: new Date() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const delta = deltaOverride ?? toolOutputExplain?.delta;
  const hasDelta = (delta?.rows?.length ?? 0) > 0;
  const isNoChange = Boolean(delta?.isNoChange);
  const planSummaryBullets = proposedPlan.steps
    .slice(0, 5)
    .filter((s) => (s.amountMonthly ?? 0) > 0)
    .map((s) => `• ${s.label}: $${Math.round(s.amountMonthly ?? 0).toLocaleString()}/mo`)
    .join('\n');
  const keyLine = proposedPlan.keyMetric?.value ? `${proposedPlan.keyMetric.label}: ${proposedPlan.keyMetric.value}` : '';
  // Current plan from explain or baseline: show when we have a saved plan but no delta/proposed yet
  const currentPlanFromExplain = toolOutputExplain?.currentPlan;
  const hasCurrentPlanFromExplain =
    currentPlanFromExplain &&
    (currentPlanFromExplain.match401k$ ?? 0) + (currentPlanFromExplain.preTax401k$ ?? 0) + (currentPlanFromExplain.hsa$ ?? 0) +
      (currentPlanFromExplain.ef$ ?? 0) + (currentPlanFromExplain.debt$ ?? 0) +
      (currentPlanFromExplain.retirementTaxAdv$ ?? 0) + (currentPlanFromExplain.brokerage$ ?? 0) >
      0;
  const baselineStepsWithAmounts =
    baselinePlanForChat?.planSteps?.filter((s) => (s.amountMonthly ?? 0) > 0) ?? [];
  const hasBaselinePlan = baselineStepsWithAmounts.length > 0;
  const currentPlanBullets =
    hasCurrentPlanFromExplain || hasBaselinePlan
      ? hasCurrentPlanFromExplain
        ? [
            currentPlanFromExplain.match401k$! > 0 && `• 401(k) match: $${Math.round(currentPlanFromExplain.match401k$!).toLocaleString()}/mo`,
            (currentPlanFromExplain.preTax401k$ ?? currentPlanFromExplain.match401k$)! > 0 &&
              `• 401(k) contribution: $${Math.round((currentPlanFromExplain.preTax401k$ ?? currentPlanFromExplain.match401k$)!).toLocaleString()}/mo`,
            (currentPlanFromExplain.hsa$ ?? 0) > 0 && `• HSA: $${Math.round(currentPlanFromExplain.hsa$!).toLocaleString()}/mo`,
            (currentPlanFromExplain.ef$ ?? 0) > 0 && `• Emergency fund: $${Math.round(currentPlanFromExplain.ef$!).toLocaleString()}/mo`,
            (currentPlanFromExplain.debt$ ?? 0) > 0 && `• Debt paydown: $${Math.round(currentPlanFromExplain.debt$!).toLocaleString()}/mo`,
            (currentPlanFromExplain.retirementTaxAdv$ ?? 0) > 0 &&
              `• Retirement: $${Math.round(currentPlanFromExplain.retirementTaxAdv$!).toLocaleString()}/mo`,
            (currentPlanFromExplain.brokerage$ ?? 0) > 0 && `• Brokerage: $${Math.round(currentPlanFromExplain.brokerage$!).toLocaleString()}/mo`,
          ]
            .filter(Boolean)
            .join('\n')
        : baselineStepsWithAmounts
            .map((s) => `• ${s.label}: $${Math.round(s.amountMonthly ?? 0).toLocaleString()}/mo`)
            .join('\n')
      : '';

  const fmt = (n: number | undefined) =>
    n != null && n > 0 ? `$${Math.round(n).toLocaleString()}/mo` : '$0';

  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Ribbit — Savings plan</h2>
          {!isConfirmed && !isNoChange && (
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Not applied yet</span>
          )}
        </div>

        {/* Delta view: headline + (plan snapshot when no change, else Current vs Proposed table) + Why button */}
        <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-3 text-sm text-slate-700 dark:text-slate-300">
          {hasDelta && delta ? (
            <>
              {delta.headline && (
                <p className="font-medium text-slate-900 dark:text-white mb-2">{delta.headline}</p>
              )}
              {isNoChange ? (
                <div className="space-y-1 text-xs">
                  <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">Current plan</p>
                  {(delta.rows ?? []).map((row) => (
                    <div key={row.id} className="flex justify-between">
                      <span className="text-slate-700 dark:text-slate-300">{row.label}</span>
                      <span className="font-medium text-slate-900 dark:text-white">{fmt(row.current.monthly)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 dark:border-slate-600">
                      <th className="text-left py-1 pr-2 font-medium text-slate-700 dark:text-slate-300"></th>
                      <th className="text-right py-1 px-2 font-medium text-slate-700 dark:text-slate-300">Current</th>
                      <th className="text-right py-1 px-2 font-medium text-slate-700 dark:text-slate-300">Proposed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(delta.rows ?? []).map((row) => (
                      <tr key={row.id} className="border-b border-slate-200 dark:border-slate-600/50">
                        <td className="py-1 pr-2 text-slate-700 dark:text-slate-300">{row.label}</td>
                        <td className="text-right py-1 px-2">{fmt(row.current.monthly)}</td>
                        <td className="text-right py-1 px-2 font-medium text-slate-900 dark:text-white">{fmt(row.proposed.monthly)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          ) : planSummaryBullets ? (
            <>
              <p className="font-medium text-slate-900 dark:text-white mb-1">Proposed plan</p>
              <pre className="whitespace-pre-wrap font-sans text-xs">{planSummaryBullets}</pre>
              {keyLine && <p className="mt-2 font-medium text-slate-900 dark:text-white">{keyLine}</p>}
            </>
          ) : currentPlanBullets ? (
            <>
              <p className="font-medium text-slate-900 dark:text-white mb-1">Current plan</p>
              <pre className="whitespace-pre-wrap font-sans text-xs">{currentPlanBullets}</pre>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Proposed plan will appear here after reviewing your budget. Adjust sliders below or ask Ribbit.
              </p>
            </>
          ) : (
            <p className="text-slate-500 dark:text-slate-400">No allocation yet. Adjust sliders below or ask Ribbit.</p>
          )}
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-400">
          Have questions? Ask me below — I&apos;ll explain any part of this plan.
        </p>

        {/* Suggested question — sends when clicked so explanation appears in chat */}
        {hasDelta && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleSend(isNoChange ? 'Why the plan works?' : 'Why these changes?')}
              disabled={isLoading}
              className="rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              {isNoChange ? 'Why the plan works?' : 'Why these changes?'}
            </button>
          </div>
        )}

        {/* Pending update message (after user edits sliders) */}
        {pendingUpdateMessage && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2 text-sm text-amber-800 dark:text-amber-200">
            {pendingUpdateMessage}
          </div>
        )}

        {/* Chat thread — ref so we scroll only this container, not the page */}
        <div ref={chatThreadContainerRef} className="space-y-3 max-h-48 overflow-y-auto border-t border-slate-200 dark:border-slate-700 pt-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  m.isUser
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                }`}
              >
                {m.isUser ? (
                  <p className="whitespace-pre-wrap">{m.text}</p>
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{m.text}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 text-sm text-slate-500">
                Thinking…
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2">
          <input
            ref={inputRef}
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            placeholder="Ask about your plan…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500"
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!chatInput.trim() || isLoading}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>

        {/* Confirm & Apply (hidden when plan unchanged) / Adjust plan at bottom of tile */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-200 dark:border-slate-700 mt-3">
          {!isNoChange && (
            <Button size="sm" onClick={onConfirmApply}>
              Confirm & Apply
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onAdjustPlan}>
            Adjust plan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
