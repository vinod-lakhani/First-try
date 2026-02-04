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
import { ChatMarkdown } from '@/components/chat/ChatMarkdown';
import { ChatLoadingDots } from '@/components/chat/ChatLoadingDots';
import { sendChatMessage } from '@/lib/chat/chatService';
import { CHAT_INPUT_PLACEHOLDER } from '@/lib/chat/chatPrompts';
import type { ChatCurrentPlanData } from '@/lib/chat/buildChatPlanData';
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
  /** First-time setup: simplified UI (intro + outcome card in parent), hide delta/table; parent shows CTA row */
  isFirstTimeSetup?: boolean;
  /** First-time: placeholder for chat input (e.g. "Ask Ribbit a question… (e.g., 'Why match first?')") */
  firstTimeChatPlaceholder?: string;
  /** First-time: content to show between intro bubble and chat input (What this plan does card, CTA, Details). Ensures order: intro → What/CTA/Details → input. */
  firstTimeMiddleContent?: React.ReactNode;
  /** Open confirmation modal (parent handles modal) */
  onConfirmApply: () => void;
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
  /** Current plan data for chat (net worth, savings breakdown, savings allocation) — ensures consistency across all chat windows */
  currentPlanDataForChat?: ChatCurrentPlanData;
  /** When set, show as assistant message (plan updated by user edit, not applied yet) */
  pendingUpdateMessage?: string | null;
  /** Engine-only explain (toolOutput.explain) — Sidekick uses ONLY these numbers */
  toolOutputExplain?: SavingsAllocationExplain | null;
  /** Called when user confirms a deviation via Proceed. Parent applies override and recomputes plan. Returns confirmation message to show in chat. */
  onUserRequestedPlanChange?: (constraint: {
    category: 'ef' | 'debt' | 'retirementExtra' | 'brokerage' | '401k' | 'hsa';
    delta: number;
  }) => string | void;
  /** When user has made custom changes, override delta to show current (baseline) vs proposed (custom). Ensures "Not applied yet" and delta table appear. */
  deltaOverride?: {
    headline?: string;
    rows: Array<{ id: string; label: string; current: { monthly: number }; proposed: { monthly: number } }>;
    isNoChange?: boolean;
  } | null;
}

/** Post-tax categories shown with Proceed/Skip. Pre-tax (401k, HSA) parsed but handled via engine rerun. */
type DeviationCategory = 'ef' | 'debt' | 'retirementExtra' | 'brokerage' | '401k' | 'hsa';
const VALID_DEVIATION_CATEGORIES = new Set<string>(['ef', 'debt', 'retirementExtra', 'brokerage', '401k', 'hsa']);

/** Parse deviation REQUEST — kept for parseDeviationConfirmation / future use. Intent for Proceed/Skip now comes from chat API (allocationChangeIntent). */
function parseDeviationRequest(
  text: string
): { category: DeviationCategory; delta: number } | null {
  const t = text.trim();

  // "Change/set my emergency fund contribution from $1365 to $1000" → delta = 1000 - 1365 = -365
  const fromToMatch = t.match(/(?:from\s+)\$?(\d{1,7})\s+to\s+\$?(\d{1,7})/i) ?? t.match(/\$?(\d{1,7})\s+to\s+\$?(\d{1,7})/);
  if (fromToMatch) {
    const fromNum = parseInt(fromToMatch[1], 10);
    const toNum = parseInt(fromToMatch[2], 10);
    const delta = toNum - fromNum;
    if (delta !== 0 && fromNum > 0 && toNum >= 0) {
      if (/(?:emergency\s*fund|ef|buffer|emergency)(?:\s+contribution)?/i.test(t)) return { category: 'ef', delta };
      if (/(?:debt|high\s*[- ]?apr)(?:\s+pay(?:ment|down)?)?/i.test(t)) return { category: 'debt', delta };
      if (/(?:retirement|roth|ira)(?:\s+contribution)?/i.test(t)) return { category: 'retirementExtra', delta };
      if (/(?:brokerage|investing)(?:\s+contribution)?/i.test(t)) return { category: 'brokerage', delta };
      if (/(?:401\s*k|401k)(?:\s+contribution)?/i.test(t)) return { category: '401k', delta };
      if (/\bhsa\b(?:\s+contribution)?/i.test(t)) return { category: 'hsa', delta };
    }
  }

  // Prefer amount from "by $200" or "by 200" — avoid matching unrelated numbers (e.g. "3 months")
  const byMatch = t.match(/by\s+\$?(\d+)(?:\s|$|,|\.)/i) ?? t.match(/(?:reduce|lower|cut|drop|decrease|increase|raise|boost|add)\s+(?:my\s+)?(?:emergency\s*fund|ef|debt|retirement|roth|ira|brokerage|investing|401\s*k|hsa)[^0-9]*\$?(\d+)/i);
  const numMatch = byMatch ?? t.match(/\$(\d+)/) ?? t.match(/(?:by\s+)?\$?(\d+)/);
  if (!numMatch) return null;
  const amount = parseInt(numMatch[1], 10);
  if (amount <= 0) return null;
  const reduce = /(?:reduce|lower|cut|drop|decrease)\s+(?:my\s+)?/i;
  const increase = /(?:increase|raise|boost|add)\s+(?:my\s+)?/i;
  const reduceEf = /(?:emergency\s*fund|ef|buffer|emergency)/i.test(t) && reduce.test(t);
  const reduceDebt = /(?:debt|high\s*[- ]?apr)/i.test(t) && reduce.test(t);
  const reduceRetirement = /(?:retirement|roth|ira)/i.test(t) && reduce.test(t);
  const reduceBrokerage = /(?:brokerage|investing)/i.test(t) && reduce.test(t);
  const reduce401k = /(?:401\s*k|401k)/i.test(t) && reduce.test(t);
  const reduceHsa = /\bhsa\b/i.test(t) && reduce.test(t);
  const increaseEf = /(?:emergency\s*fund|ef|buffer|emergency)/i.test(t) && increase.test(t);
  const increaseDebt = /(?:debt|high\s*[- ]?apr)/i.test(t) && increase.test(t);
  const increaseRetirement = /(?:retirement|roth|ira)/i.test(t) && increase.test(t);
  const increaseBrokerage = /(?:brokerage|investing)/i.test(t) && increase.test(t);
  const increase401k = /(?:401\s*k|401k)/i.test(t) && increase.test(t);
  const increaseHsa = /\bhsa\b/i.test(t) && increase.test(t);
  if (reduceEf) return { category: 'ef', delta: -amount };
  if (reduceDebt) return { category: 'debt', delta: -amount };
  if (reduceRetirement) return { category: 'retirementExtra', delta: -amount };
  if (reduceBrokerage) return { category: 'brokerage', delta: -amount };
  if (reduce401k) return { category: '401k', delta: -amount };
  if (reduceHsa) return { category: 'hsa', delta: -amount };
  if (increaseEf) return { category: 'ef', delta: amount };
  if (increaseDebt) return { category: 'debt', delta: amount };
  if (increaseRetirement) return { category: 'retirementExtra', delta: amount };
  if (increaseBrokerage) return { category: 'brokerage', delta: amount };
  if (increase401k) return { category: '401k', delta: amount };
  if (increaseHsa) return { category: 'hsa', delta: amount };
  return null;
}

/** Confirmation words — only apply UI update when user has confirmed (not on initial request). */
const CONFIRM_WORDS = /^(?:yes|ok|sure|confirm|do\s+it|go\s+ahead|sounds\s+good|please|apply|that\s+works|proceed)/i;
const HAS_CONFIRM = /(?:^|[\s,])(?:yes|ok|sure|confirm|do\s+it|go\s+ahead|sounds\s+good|please\s+(?:do|proceed)|apply|that\s+works|proceed)(?:[\s,]|$)/i;

/** Parse user message for deviation CONFIRMATION. Only triggers when user confirms (yes/ok/etc), not on initial "reduce EF by $200" request. */
function parseDeviationConfirmation(
  text: string,
  recentAssistantText?: string,
  recentUserText?: string
): { category: 'ef' | 'debt' | 'retirementExtra' | 'brokerage'; delta: number } | null {
  const t = text.toLowerCase().trim();
  const ctx = (recentAssistantText ?? '').toLowerCase();
  const prevUser = (recentUserText ?? '').toLowerCase();

  const hasConfirm = HAS_CONFIRM.test(t) || CONFIRM_WORDS.test(t);
  if (!hasConfirm) return null;

  // Amount can be in current message ("Yes, reduce by $200"), assistant's message ("reduce EF by $200"), or previous user message ("reduce emergency fund by $200")
  let amount = 0;
  const numInUser = t.match(/(?:by\s+)?\$?(\d+)/);
  const numInAssistant = ctx.match(/(?:by\s+)?\$?(\d+)/);
  const numInPrevUser = prevUser.match(/(?:by\s+)?\$?(\d+)/);
  if (numInUser) amount = parseInt(numInUser[1], 10);
  else if (numInAssistant) amount = parseInt(numInAssistant[1], 10);
  else if (numInPrevUser) amount = parseInt(numInPrevUser[1], 10);
  if (amount <= 0) return null;
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

  // "yes please proceed" or similar — amount/category from assistant's or previous user's message
  const searchCtx = ctx || prevUser;
  if (hasConfirm && amount > 0 && searchCtx) {
    if (/(?:reduce|reducing).*?(?:emergency| ef |buffer)/i.test(searchCtx) || /(?:emergency| ef |buffer).*?(?:by|reduce)/i.test(searchCtx)) return { category: 'ef', delta: -amount };
    if (/(?:reduce|reducing).*?(?:debt|high\s*[- ]?apr)/i.test(searchCtx) || /(?:debt|high\s*[- ]?apr).*?(?:by|reduce)/i.test(searchCtx)) return { category: 'debt', delta: -amount };
    if (/(?:reduce|reducing).*?(?:retirement|roth|ira)/i.test(searchCtx) || /(?:retirement|roth|ira).*?(?:by|reduce)/i.test(searchCtx)) return { category: 'retirementExtra', delta: -amount };
    if (/(?:reduce|reducing).*?(?:brokerage|investing)/i.test(searchCtx) || /(?:brokerage|investing).*?(?:by|reduce)/i.test(searchCtx)) return { category: 'brokerage', delta: -amount };
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
  isFirstTimeSetup = false,
  firstTimeChatPlaceholder,
  firstTimeMiddleContent,
  onConfirmApply,
  onNotNow,
  userStateForChat = {},
  baselinePlanForChat = null,
  currentContextForChat = {},
  currentPlanDataForChat,
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
  const [pendingDeviation, setPendingDeviation] = useState<{
    category: 'ef' | 'debt' | 'retirementExtra' | 'brokerage' | '401k' | 'hsa';
    delta: number;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatThreadContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll only the chat thread area so new messages are visible; do not scroll the page (avoids jumping to net worth chart)
  useEffect(() => {
    const el = chatThreadContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // Proceed/Skip are shown when the chat API returns allocationChangeIntent (model infers user intent). No client-side regex.

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
    setPendingDeviation(null);

    const proposedPlanCompact = {
      planSteps: proposedPlan.steps.slice(0, 5),
      totals: proposedPlan.totals,
      assumptions: proposedPlan.assumptions.slice(0, 5),
      warnings: proposedPlan.warnings ?? [],
      keyMetric: proposedPlan.keyMetric,
      ...(toolOutputExplain && { explain: toolOutputExplain }),
    };
    const chatPayload = {
      messages: [...messages, userMessage].map((m) => ({
        id: m.id,
        text: m.text,
        isUser: m.isUser,
        timestamp: m.timestamp,
      })),
      context: 'savings-allocator' as const,
      userPlanData: {
        ...userStateForChat,
        ...currentPlanDataForChat,
        toolOutput: proposedPlanCompact,
        baselinePlan: baselinePlanForChat ?? undefined,
        currentContext: currentContextForChat,
      },
    };

    // Always non-streaming for savings-allocator: full response in one shot so we never get overwrite/disappear.
    try {
      const result = await sendChatMessage(chatPayload);
      const responseText = typeof result === 'string' ? result : result.response;
      setMessages((prev) => [
        ...prev,
        { id: `msg-${Date.now()}`, text: responseText, isUser: false, timestamp: new Date() },
      ]);
      // Show Proceed/Skip only when the chat API inferred allocation_change intent. Use intent.type so explain/compare never show buttons.
      const intentType = typeof result === 'object' ? result.intent?.type : undefined;
      const allocationChange = typeof result === 'object' ? result.allocationChangeIntent : undefined;
      const isAllocationChange = intentType === 'allocation_change' && allocationChange && VALID_DEVIATION_CATEGORIES.has(allocationChange.category) && typeof allocationChange.delta === 'number';
      if (isAllocationChange) {
        setPendingDeviation({ category: allocationChange.category as DeviationCategory, delta: allocationChange.delta });
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Something went wrong.';
      setMessages((prev) => [
        ...prev,
        { id: `msg-${Date.now()}`, text: `I couldn't complete that: ${errMsg}`, isUser: false, timestamp: new Date() },
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

        {/* Delta view: Ribbit Proposal (col 1, frozen) vs Proposed (col 2, working copy). Hidden for first-time (hero card shown in parent). */}
        {!isFirstTimeSetup && (
        <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-3 text-sm text-slate-700 dark:text-slate-300">
          {hasDelta && delta ? (
            <>
              {delta.headline && (
                <p className="font-medium text-slate-900 dark:text-white mb-2">{delta.headline}</p>
              )}
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 dark:border-slate-600">
                    <th className="text-left py-1 pr-2 font-medium text-slate-700 dark:text-slate-300"></th>
                    <th className="text-right py-1 px-2 font-medium text-slate-700 dark:text-slate-300">Ribbit Proposal</th>
                    <th className="text-right py-1 px-2 font-medium text-slate-700 dark:text-slate-300">Proposed</th>
                  </tr>
                </thead>
                <tbody>
                  {(delta.rows ?? []).map((row) => {
                    const cur = row.current.monthly ?? 0;
                    const prop = row.proposed.monthly ?? 0;
                    const diff = prop - cur;
                    const isIncrease = diff > 0.01;
                    const isDecrease = diff < -0.01;
                    const proposedCellClass = isIncrease
                      ? 'text-green-600 dark:text-green-400 font-medium'
                      : isDecrease
                        ? 'text-red-600 dark:text-red-400 font-medium'
                        : 'font-medium text-slate-900 dark:text-white';
                    return (
                      <tr key={row.id} className="border-b border-slate-200 dark:border-slate-600/50">
                        <td className="py-1 pr-2 text-slate-700 dark:text-slate-300">{row.label}</td>
                        <td className="text-right py-1 px-2">{fmt(row.current.monthly)}</td>
                        <td className={`text-right py-1 px-2 ${proposedCellClass}`}>{fmt(row.proposed.monthly)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          ) : planSummaryBullets ? (
            <>
              <p className="font-medium text-slate-900 dark:text-white mb-1">Proposed</p>
              <pre className="whitespace-pre-wrap font-sans text-xs">{planSummaryBullets}</pre>
              {keyLine && <p className="mt-2 font-medium text-slate-900 dark:text-white">{keyLine}</p>}
            </>
          ) : currentPlanBullets ? (
            <>
              <p className="font-medium text-slate-900 dark:text-white mb-1">Ribbit Proposal</p>
              <pre className="whitespace-pre-wrap font-sans text-xs">{currentPlanBullets}</pre>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Proposed will appear here after you adjust the plan. Ask Ribbit if you have questions.
              </p>
            </>
          ) : (
            <p className="text-slate-500 dark:text-slate-400">No allocation yet. Ask Ribbit if you have questions.</p>
          )}
        </div>
        )}

        {!isFirstTimeSetup && (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Have questions? Ask me below — I&apos;ll explain any part of this plan.
        </p>
        )}

        {/* Suggested question — sends when clicked so explanation appears in chat. Hidden for first-time. */}
        {!isFirstTimeSetup && hasDelta && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleSend(isNoChange ? 'Why the plan works?' : 'Explain the breakdown')}
              disabled={isLoading}
              className="rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              {isNoChange ? 'Why the plan works?' : 'Explain the breakdown'}
            </button>
          </div>
        )}

        {/* Pending update message (after user edits sliders). Never show in first-time. */}
        {!isFirstTimeSetup && pendingUpdateMessage && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2 text-sm text-amber-800 dark:text-amber-200">
            {pendingUpdateMessage}
          </div>
        )}

        {/* First-time: single intro bubble only, then middle content (What this plan does, CTA, Details), then input. No full thread, no delta. */}
        {isFirstTimeSetup && (
          <>
            <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-lg px-4 py-3 bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                  <ChatMarkdown size="base">{introMessage}</ChatMarkdown>
                </div>
              </div>
            </div>
            {firstTimeMiddleContent}
          </>
        )}

        {/* Chat thread — show messages and responses. In first-time, intro is above; show only user Q + assistant A here. */}
        <div ref={chatThreadContainerRef} className="space-y-4 max-h-[36rem] overflow-y-auto border-t border-slate-200 dark:border-slate-700 pt-3">
          {(isFirstTimeSetup ? messages.slice(1) : messages).map((m) => (
            <div
              key={m.id}
              className={`flex ${m.isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2.5 ${
                  m.isUser
                    ? 'bg-green-600 text-white text-sm'
                    : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                }`}
              >
                {m.isUser ? (
                  <p className="text-sm whitespace-pre-wrap">{m.text}</p>
                ) : (
                  <ChatMarkdown size="sm">{m.text}</ChatMarkdown>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-2.5">
                <ChatLoadingDots />
              </div>
            </div>
          )}
          {pendingDeviation && !isLoading && onUserRequestedPlanChange && (
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const confirmMsg = onUserRequestedPlanChange(pendingDeviation);
                  if (typeof confirmMsg === 'string') {
                    setMessages((prev) => [
                      ...prev,
                      { id: `confirm-${Date.now()}`, text: confirmMsg, isUser: false, timestamp: new Date() },
                    ]);
                  }
                  setPendingDeviation(null);
                }}
                className="rounded-full border border-green-600 bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-green-700"
              >
                Proceed
              </button>
              <button
                type="button"
                onClick={() => setPendingDeviation(null)}
                className="rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Skip
              </button>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input — larger textarea for easier typing */}
        <div className="flex items-end gap-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 min-h-[4.5rem]">
          <textarea
            ref={inputRef}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={isFirstTimeSetup && firstTimeChatPlaceholder ? firstTimeChatPlaceholder : CHAT_INPUT_PLACEHOLDER}
            rows={2}
            className="flex-1 min-h-[2.5rem] max-h-32 resize-y bg-transparent text-base outline-none placeholder:text-slate-500 py-1"
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!chatInput.trim() || isLoading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>

        {/* Confirm & Apply (hidden in first-time — parent shows "Apply savings plan" + "See details first" in firstTimeMiddleContent) */}
        {!isFirstTimeSetup && !isNoChange && (
          <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-200 dark:border-slate-700 mt-3">
            <Button size="sm" onClick={onConfirmApply}>
              Confirm & Apply
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
