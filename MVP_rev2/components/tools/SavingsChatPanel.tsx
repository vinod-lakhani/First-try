/**
 * Savings Allocation chat panel.
 *
 * Capability: User can update the savings plan via chat. When the user requests a change
 * (e.g. "reduce 401k", "put more in emergency fund", "I don't want 401k contributions")
 * and the assistant agrees, we apply that change and the plan UI updates immediately.
 *
 * This capability is NOT limited to onboarding: it works in all Savings Allocator modes
 * (first-time setup, review-from-Feed, no-match, no-hsa, etc.). The parent page provides
 * onUserRequestedPlanChange regardless of mode.
 *
 * Plan updates are applied through a single path: onUserRequestedPlanChange({ category, delta }).
 * Changes are derived from (1) parsing user/assistant messages, or (2) structured planChanges
 * returned by the chat API when the AI confirms a change. The parent applies each change
 * (pre-tax steppers or post-tax overrides) and recomputes the proposed plan.
 */

'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Send } from 'lucide-react';
import { ChatMarkdown } from '@/components/chat/ChatMarkdown';
import { ChatLoadingDots } from '@/components/chat/ChatLoadingDots';
import { sendChatMessage, sendChatMessageStreaming } from '@/lib/chat/chatService';

/** Structured plan changes from chat (savings-allocator). Absolute values for pre-tax; deltas for post-tax. */
type PlanChangesFromChat = {
  preTax401k?: number;
  hsa?: number;
  efDelta?: number;
  debtDelta?: number;
  retirementExtraDelta?: number;
  brokerageDelta?: number;
};
import { CHAT_INPUT_PLACEHOLDER } from '@/lib/chat/chatPrompts';
import {
  parseSavingsAllocationIntent,
  intentToDelta,
  intentIsSingleCategoryChange,
  type SavingsAllocationIntentContext,
} from '@/lib/chat/savingsAllocationIntent';
import type { ChatCurrentPlanData } from '@/lib/chat/buildChatPlanData';
import type { ProposedPlan } from '@/lib/tools/savings/types';
import type { SavingsAllocationExplain } from '@/lib/tools/savings/explain';

const DEBUG_STREAMING = typeof window !== 'undefined' && (
  window.location.search.includes('debug=stream') ||
  (window as unknown as { __SAVINGS_CHAT_DEBUG_STREAM__?: boolean }).__SAVINGS_CHAT_DEBUG_STREAM__
);
function streamLog(...args: unknown[]) {
  if (DEBUG_STREAMING) console.log('[SavingsChatPanel:stream]', ...args);
}

/** True if the user only asked for an explanation or comparison (no allocation change). We skip applying plan changes, skip deviation parsing, and do not show Proceed/Skip. */
function isExplainOnlyRequest(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const t = text.trim().toLowerCase();
  return (
    /^explain\s*(this\s+)?(the\s+)?(plan|breakdown|allocation)/i.test(t) ||
    /^explain\s+(the\s+)?change\s+(you\s+are\s+)?proposing/i.test(t) ||
    /^explain\s+the\s+change/i.test(t) ||
    /^explain\s+the\s+difference\s+(between)?/i.test(t) ||
    /^explain\s+(my\s+)?(savings\s+)?plan/i.test(t) ||
    /^explain\s+(the\s+)?savings\s+(plan|breakdown)/i.test(t) ||
    /plan\s+to\s+me/i.test(t) ||
    /^why\s+(the\s+plan\s+works|these\s+changes)\??$/i.test(t) ||
    /^explain\s+the\s+breakdown$/i.test(t) ||
    /what('s|\s+is)\s+different/i.test(t) ||
    /^what\s+changed\??$/i.test(t) ||
    /^how\s+(does\s+)?(this\s+)?compare/i.test(t) ||
    /^compare\s+(current|baseline|plan)/i.test(t) ||
    /^(current|baseline)\s+vs\s+(proposed|plan)/i.test(t) ||
    /has\s+anything\s+changed/i.test(t) ||
    /(anything|something)\s+changed\s+between/i.test(t) ||
    /difference\s+between\s+(the\s+)?(current|existing)\s+and\s+(the\s+)?proposed/i.test(t)
  );
}

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
  /** Called when user confirms a deviation via Proceed. Parent applies override and recomputes plan. Returns confirmation message to show in chat. When targetMonthly is set (set_target intent), parent should set that category to the target value so the proposed plan shows the correct amount regardless of engine base. */
  onUserRequestedPlanChange?: (constraint: {
    category: 'ef' | 'debt' | 'retirementExtra' | 'brokerage' | '401k' | 'hsa';
    delta: number;
    targetMonthly?: number;
  }) => string | void;
  /** When user has made custom changes, override delta to show current (baseline) vs proposed (custom). Ensures "Not applied yet" and delta table appear. */
  deltaOverride?: {
    headline?: string;
    rows: Array<{ id: string; label: string; current: { monthly: number }; proposed: { monthly: number } }>;
    isNoChange?: boolean;
    /** When true (first_time, no user changes yet), show only Ribbit Proposal column. */
    singleColumn?: boolean;
  } | null;
  /** Current 401k employee contribution (monthly) — used to parse "eliminate 401k" from assistant message. */
  currentPreTax401k$?: number;
  /** Current HSA contribution (monthly) — used to parse "eliminate HSA" from assistant message. */
  currentHsa$?: number;
  /** When provided, chat thread is controlled by parent so messages survive panel remounts (fixes "explanation overwritten" when parent re-renders). */
  messages?: ChatMessage[];
  /** Setter for controlled messages; must be provided together with messages. */
  setMessages?: (updater: React.SetStateAction<ChatMessage[]>) => void;
}

/** Post-tax categories shown with Proceed/Skip. Pre-tax (401k, HSA) parsed but handled via engine rerun. */
type DeviationCategory = 'ef' | 'debt' | 'retirementExtra' | 'brokerage' | '401k' | 'hsa';

/** Apply plan changes: intent first (chat creates intent, tool uses intent), then PLAN_CHANGES as fallback.
 * Returns the first "Got it. That frees up $X/month" message from the callback for patching the streamed reply. */
function applyPlanChangesFromChat(
  changes: PlanChangesFromChat,
  ctx: {
    onUserRequestedPlanChange: (c: { category: DeviationCategory; delta: number; targetMonthly?: number }) => string | void;
    currentPreTax401k$: number;
    currentHsa$: number;
    currentEf$?: number;
    currentDebt$?: number;
    currentRetirementExtra$?: number;
    currentBrokerage$?: number;
  },
  lastUserMessage?: string
): string | undefined {
  const {
    onUserRequestedPlanChange,
    currentPreTax401k$,
    currentHsa$,
    currentEf$ = 0,
    currentDebt$ = 0,
    currentRetirementExtra$ = 0,
    currentBrokerage$ = 0,
  } = ctx;
  let followUpMessage: string | undefined;
  const captureCallback = (c: { category: DeviationCategory; delta: number; targetMonthly?: number }) => {
    const result = onUserRequestedPlanChange(c);
    if (typeof result === 'string' && followUpMessage === undefined) followUpMessage = result;
    return result;
  };

  const intentContext: SavingsAllocationIntentContext = {
    preTax401k$: currentPreTax401k$,
    hsa$: currentHsa$,
    ef$: currentEf$,
    debt$: currentDebt$,
    retirementExtra$: currentRetirementExtra$,
    brokerage$: currentBrokerage$,
  };

  const intent = lastUserMessage ? parseSavingsAllocationIntent(lastUserMessage, intentContext) : null;
  const appliedFromIntent =
    intent != null && intent.kind !== 'reset' && intentIsSingleCategoryChange(intent);
  const intentCategory =
    appliedFromIntent && intent != null
      ? (intent.kind === 'eliminate' ? intent.category : intent.category)
      : null;
  const skipApiDestinationDeltas =
    appliedFromIntent &&
    intentCategory != null &&
    ['ef', 'debt', 'retirementExtra', 'brokerage'].includes(intentCategory);

  if (appliedFromIntent && intent != null) {
    const resolved = intentToDelta(intent, intentContext);
    if (resolved && Math.abs(resolved.delta) > 0.5) {
      // For post-tax categories, always pass targetMonthly so the allocator applies it relative to the displayed "Current" plan, not the engine base (avoids EF going to 0 when base differs from baseline).
      const isPostTax = ['ef', 'debt', 'retirementExtra', 'brokerage'].includes(resolved.category);
      const current = resolved.category === 'ef' ? currentEf$ : resolved.category === 'debt' ? currentDebt$ : resolved.category === 'retirementExtra' ? currentRetirementExtra$ : resolved.category === 'brokerage' ? currentBrokerage$ : 0;
      const targetMonthly =
        intent.kind === 'set_target'
          ? intent.targetMonthly
          : isPostTax
            ? Math.max(0, current + resolved.delta)
            : undefined;
      captureCallback({ category: resolved.category as DeviationCategory, delta: resolved.delta, targetMonthly });
    }
  }

  if (!appliedFromIntent || intentCategory !== '401k') {
    if (changes.preTax401k != null) {
      const delta = changes.preTax401k - currentPreTax401k$;
      if (Math.abs(delta) > 0.5) captureCallback({ category: '401k', delta });
    }
  }
  if (!appliedFromIntent || intentCategory !== 'hsa') {
    if (changes.hsa != null) {
      const delta = changes.hsa - currentHsa$;
      if (Math.abs(delta) > 0.5) captureCallback({ category: 'hsa', delta });
    }
  }

  if (!skipApiDestinationDeltas) {
    if (changes.efDelta != null && Math.abs(changes.efDelta) > 0.5) captureCallback({ category: 'ef', delta: changes.efDelta });
    if (changes.debtDelta != null && Math.abs(changes.debtDelta) > 0.5) captureCallback({ category: 'debt', delta: changes.debtDelta });
    if (changes.retirementExtraDelta != null && Math.abs(changes.retirementExtraDelta) > 0.5) captureCallback({ category: 'retirementExtra', delta: changes.retirementExtraDelta });
    if (changes.brokerageDelta != null && Math.abs(changes.brokerageDelta) > 0.5) captureCallback({ category: 'brokerage', delta: changes.brokerageDelta });
  }

  return followUpMessage;
}

/** Parse "no 401k" / "don't want 401k contributions" etc. — needs context for full amount. */
function parseOptOutRequest(
  text: string,
  context: DeviationParseContext
): { category: DeviationCategory; delta: number } | null {
  const t = text.trim().toLowerCase();
  const no401k = /(?:do\s+not|don't|dont)\s+want\s+(?:any\s+)?(?:401\s*\(?\s*k\s*\)?|401k)\s*contributions?/i.test(t) ||
    /(?:no|skip|without)\s+(?:401\s*\(?\s*k\s*\)?|401k)/i.test(t) || /(?:eliminate|remove)\s+(?:my\s+)?(?:401\s*\(?\s*k\s*\)?|401k)/i.test(t);
  const noHsa = /(?:do\s+not|don't|dont)\s+want\s+(?:any\s+)?hsa/i.test(t) || /(?:no|skip)\s+hsa/i.test(t) || /(?:eliminate|remove)\s+(?:my\s+)?hsa/i.test(t);
  if (no401k && (context.preTax401k$ ?? 0) > 0) return { category: '401k', delta: -(context.preTax401k$ ?? 0) };
  if (noHsa && (context.hsa$ ?? 0) > 0) return { category: 'hsa', delta: -(context.hsa$ ?? 0) };
  return null;
}

/** Parse deviation REQUEST from user message. Uses intent (chat creates intent, tool uses intent). */
function parseDeviationRequest(
  text: string,
  context?: DeviationParseContext
): { category: DeviationCategory; delta: number } | null {
  if (context) {
    const intentContext: SavingsAllocationIntentContext = {
      preTax401k$: context.preTax401k$ ?? 0,
      hsa$: context.hsa$ ?? 0,
      ef$: context.ef$ ?? 0,
      debt$: context.debt$ ?? 0,
      retirementExtra$: context.retirementExtra$ ?? 0,
      brokerage$: context.brokerage$ ?? 0,
    };
    const intent = parseSavingsAllocationIntent(text, intentContext);
    if (!intent || intent.kind === 'reset') return null;
    const resolved = intentToDelta(intent, intentContext);
    if (!resolved || Math.abs(resolved.delta) < 0.5) return null;
    return { category: resolved.category as DeviationCategory, delta: resolved.delta };
  }
  const t = text.trim();
  const ctx401k = context?.preTax401k$ ?? 0;
  const ctxHsa = context?.hsa$ ?? 0;

  // "Reduce/set 401k to $100" or "401k to 100" = target value; delta = target - current
  // Check for "to X" patterns first (before "by X") so "reduce 401k to 100" is parsed as target, not "reduce by 100"
  const to401kPatterns = [
    /(?:reduce|set|make)\s+(?:my\s+)?(?:401\s*\(?\s*k\s*\)?|401k)\s+(?:contribution\s+)?to\s+\$?(\d+)/i,
    /(?:401\s*\(?\s*k\s*\)?|401k)\s+(?:contribution\s+)?to\s+\$?(\d+)/i,
    /(?:reduce|set|make)\s+(?:my\s+)?(?:401\s*\(?\s*k\s*\)?|401k)\s+to\s+\$?(\d+)/i,
  ];
  for (const pattern of to401kPatterns) {
    const match = t.match(pattern);
    if (match && ctx401k > 0) {
      const target = parseInt(match[1], 10);
      if (target >= 0 && target <= 100000) return { category: '401k', delta: target - ctx401k };
    }
  }
  const toHsaPatterns = [
    /(?:reduce|set|make)\s+(?:my\s+)?hsa\s+(?:contribution\s+)?to\s+\$?(\d+)/i,
    /hsa\s+(?:contribution\s+)?to\s+\$?(\d+)/i,
    /(?:reduce|set|make)\s+(?:my\s+)?hsa\s+to\s+\$?(\d+)/i,
  ];
  for (const pattern of toHsaPatterns) {
    const match = t.match(pattern);
    if (match && ctxHsa > 0) {
      const target = parseInt(match[1], 10);
      if (target >= 0 && target <= 100000) return { category: 'hsa', delta: target - ctxHsa };
    }
  }
  
  // "Reduce/set emergency fund to $200" = target value; delta = target - current
  // Check for "to X" patterns BEFORE "by X" so "reduce emergency fund to 200" is parsed as target
  const ctxEf = context?.ef$ ?? 0;
  const ctxDebt = context?.debt$ ?? 0;
  const ctxRetirement = context?.retirementExtra$ ?? 0;
  const ctxBrokerage = context?.brokerage$ ?? 0;
  
  const toEfPatterns = [
    /(?:reduce|set|make|change)\s+(?:my\s+)?(?:emergency\s*fund|emergency fund|ef|buffer)\s+(?:contribution\s+)?to\s+\$?(\d+)/i,
    /(?:want\s+to\s+)?(?:change\s+)?(?:my\s+)?(?:emergency\s*fund|emergency fund|ef|buffer)\s+(?:contribution\s+)?to\s+\$?(\d+)/i,
    /(?:emergency\s*fund|emergency fund|ef|buffer)\s+(?:contribution\s+)?to\s+\$?(\d+)/i,
  ];
  for (const pattern of toEfPatterns) {
    const match = t.match(pattern);
    if (match) {
      const target = parseInt(match[1], 10);
      if (target >= 0 && target <= 100000) {
        const delta = target - ctxEf;
        console.log('[parseDeviationRequest] Parsed EF "to" pattern:', {
          text: t.substring(0, 100),
          target,
          ctxEf,
          delta,
          warning: ctxEf === 0 && /reduce/i.test(t) 
            ? 'WARNING: User said "reduce" but ctxEf is 0 - baseline may not be set correctly in first_time scenario!' 
            : undefined,
        });
        // CRITICAL: Always parse "to X" patterns, even if ctxEf is 0
        // If ctxEf is 0 but user said "reduce", log a warning but still return the delta
        // The fix in page.tsx (using engineSnapshot for first_time) should prevent ctxEf from being 0
        return { category: 'ef', delta };
      }
    }
  }
  
  const toDebtPatterns = [
    /(?:reduce|set|make)\s+(?:my\s+)?(?:debt|high\s*[- ]?apr)\s+to\s+\$?(\d+)/i,
    /(?:debt|high\s*[- ]?apr)\s+to\s+\$?(\d+)/i,
  ];
  for (const pattern of toDebtPatterns) {
    const match = t.match(pattern);
    if (match && ctxDebt > 0) {
      const target = parseInt(match[1], 10);
      if (target >= 0 && target <= 100000) return { category: 'debt', delta: target - ctxDebt };
    }
  }
  
  const toRetirementPatterns = [
    /(?:reduce|set|make)\s+(?:my\s+)?(?:retirement|roth|ira)\s+to\s+\$?(\d+)/i,
    /(?:retirement|roth|ira)\s+to\s+\$?(\d+)/i,
  ];
  for (const pattern of toRetirementPatterns) {
    const match = t.match(pattern);
    if (match && ctxRetirement > 0) {
      const target = parseInt(match[1], 10);
      if (target >= 0 && target <= 100000) return { category: 'retirementExtra', delta: target - ctxRetirement };
    }
  }
  
  const toBrokeragePatterns = [
    /(?:reduce|set|make)\s+(?:my\s+)?(?:brokerage|investing|investment)\s+to\s+\$?(\d+)/i,
    /(?:brokerage|investing|investment)\s+to\s+\$?(\d+)/i,
  ];
  for (const pattern of toBrokeragePatterns) {
    const match = t.match(pattern);
    if (match && ctxBrokerage > 0) {
      const target = parseInt(match[1], 10);
      if (target >= 0 && target <= 100000) return { category: 'brokerage', delta: target - ctxBrokerage };
    }
  }
  
  // If "reduce 401k" + number but number is much smaller than current, likely "to X" not "by X"
  // e.g. "reduce 401k 100" when current is 677 → treat as "to 100" (delta = -577), not "by 100" (delta = -100)
  const reduce401kWithNumber = /(?:reduce|lower|cut|drop|decrease)\s+(?:my\s+)?(?:401\s*\(?\s*k\s*\)?|401k)/i.test(t);
  if (reduce401kWithNumber && ctx401k > 0) {
    // Try to match "to $X" first, then fall back to number after 401k
    const toMatch = t.match(/(?:401\s*\(?\s*k\s*\)?|401k)[^\d]*to\s+\$?(\d+)/i);
    const numMatch = toMatch ?? t.match(/(?:401\s*\(?\s*k\s*\)?|401k)[^\d]*\$?(\d+)/i);
    if (numMatch) {
      const amount = parseInt(numMatch[1], 10);
      // If explicitly says "to" OR amount is less than 50% of current, treat as "to X"
      if (toMatch || (amount > 0 && amount < ctx401k * 0.5 && amount <= 100000)) {
        const delta = amount - ctx401k;
        console.log('[parseDeviationRequest] Parsed 401k "to" pattern:', {
          text: t.substring(0, 100),
          toMatch: toMatch?.[1],
          numMatch: numMatch[1],
          amount,
          ctx401k,
          delta,
        });
        return { category: '401k', delta };
      }
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

/** Optional context for parsing "eliminate/remove 401k or HSA" (need current amounts to compute delta). */
export type DeviationParseContext = { 
  preTax401k$?: number; 
  hsa$?: number;
  ef$?: number;
  debt$?: number;
  retirementExtra$?: number;
  brokerage$?: number;
};

/** Parse "That frees up $X/month" or "frees up $X" from assistant message. */
function parseFreedAmountFromAssistant(assistantText: string): number | null {
  // Match decimal numbers too (e.g., "$828.4")
  const match = assistantText.match(/(?:frees?\s+up|free\s+up).*?\$?(\d+\.?\d*)(?:\/month)?/i);
  if (!match) return null;
  const n = Math.round(parseFloat(match[1]));
  return n > 0 && n <= 100000 ? n : null;
}

/** Check if freed amount is from pre-tax source (401k/HSA reduction). */
function isPreTaxSource(assistantText: string): boolean {
  return /(?:401\s*\(?\s*k\s*\)?|401k|hsa).*?(?:frees?\s+up|reduced|eliminated|removed)/i.test(assistantText) ||
    /(?:frees?\s+up|reduced).*?(?:401\s*\(?\s*k\s*\)?|401k|hsa)/i.test(assistantText) ||
    /pre-tax/i.test(assistantText);
}

/** Parse user reply for "where to move" choice after we asked (e.g. "debt", "emergency fund", "investment", "HSA"). */
function parseDestinationChoice(userText: string): DeviationCategory | null {
  const t = userText.trim().toLowerCase();
  if (/^(?:put\s+it\s+)?(?:toward|to)\s+(?:debt|high\s*[- ]?apr)/i.test(t) || /^debt$/i.test(t)) return 'debt';
  if (/^(?:put\s+it\s+)?(?:toward|to)\s+(?:emergency|ef|buffer)/i.test(t) || /^(?:emergency\s*fund|ef)$/i.test(t)) return 'ef';
  if (/^(?:put\s+it\s+)?(?:toward|to)\s+(?:investment|brokerage|investing)/i.test(t) || /^(?:investment|brokerage|investing)$/i.test(t)) return 'brokerage';
  if (/^(?:put\s+it\s+)?(?:toward|to)\s+(?:retirement|roth|ira)/i.test(t) || /^(?:retirement|roth|ira)$/i.test(t)) return 'retirementExtra';
  if (/^(?:put\s+it\s+)?(?:toward|to)\s+hsa/i.test(t) || /^hsa$/i.test(t)) return 'hsa';
  return null;
}

/** Fallback: extract deviation from assistant message when it mentions Proceed/Skip and a specific change, or "eliminate/remove/set to zero 401k/HSA". */
function parseDeviationFromAssistantResponse(
  assistantText: string,
  context?: DeviationParseContext
): { category: DeviationCategory; delta: number } | null {
  const t = assistantText.replace(/\*\*/g, '');
  
  // CRITICAL: Don't parse if assistant is asking "where should it go?" - this is just listing options, not a command
  const isAskingWhereToMove = /where\s+should|or\s+say|tell\s+me\s+where|say\s+"|say\s+'/i.test(t) && 
    /(?:emergency|debt|investment|retirement|hsa|brokerage).*?(?:emergency|debt|investment|retirement|hsa|brokerage)/i.test(t);
  if (isAskingWhereToMove) {
    console.log('[parseDeviationFromAssistantResponse] Skipping parse - assistant is asking where to move, not giving a command');
    return null;
  }
  
  const has401k = /(?:401\s*\(?\s*k\s*\)?|401k)/i.test(t);
  const hasHsa = /\bhsa\b/i.test(t);
  const ctx401k = context?.preTax401k$ ?? 0;
  const ctxHsa = context?.hsa$ ?? 0;

  // Check for "to $X" patterns FIRST (before "frees up" check) to ensure target values are preserved
  // This handles cases where user said "reduce to $100" and assistant confirms with "reduced by $X, frees up $X"
  const to401kMatch = t.match(/(?:reduced|reduce|set|make)\s+(?:your\s+)?(?:401\s*\(?\s*k\s*\)?|401k)\s+(?:contribution\s+)?to\s+\$?(\d+)/i) ?? 
    t.match(/(?:401\s*\(?\s*k\s*\)?|401k)\s+(?:contribution\s+)?to\s+\$?(\d+)/i) ??
    t.match(/(?:reduced|reduce|set|make)\s+(?:your\s+)?(?:401\s*\(?\s*k\s*\)?|401k)\s+to\s+\$?(\d+)/i);
  if (to401kMatch && has401k && ctx401k > 0) {
    const target = parseInt(to401kMatch[1], 10);
    if (target >= 0 && target <= 100000) {
      return { category: '401k', delta: target - ctx401k };
    }
  }
  const toHsaMatch = t.match(/(?:reduced|reduce|set|make)\s+(?:your\s+)?hsa\s+(?:contribution\s+)?to\s+\$?(\d+)/i) ??
    t.match(/hsa\s+(?:contribution\s+)?to\s+\$?(\d+)/i) ??
    t.match(/(?:reduced|reduce|set|make)\s+(?:your\s+)?hsa\s+to\s+\$?(\d+)/i);
  if (toHsaMatch && hasHsa && ctxHsa > 0) {
    const target = parseInt(toHsaMatch[1], 10);
    if (target >= 0 && target <= 100000) {
      return { category: 'hsa', delta: target - ctxHsa };
    }
  }

  // Check for "to $X" patterns for post-tax buckets (emergency fund, debt, retirement, brokerage)
  const ctxEf = context?.ef$ ?? 0;
  const ctxDebt = context?.debt$ ?? 0;
  const ctxRetirement = context?.retirementExtra$ ?? 0;
  const ctxBrokerage = context?.brokerage$ ?? 0;
  
  const toEfMatch = t.match(/(?:reduced|reduce|set|make)\s+(?:your\s+)?(?:emergency\s*fund|emergency fund|ef|buffer)\s+to\s+\$?(\d+)/i) ??
    t.match(/(?:emergency\s*fund|emergency fund|ef|buffer)\s+to\s+\$?(\d+)/i);
  if (toEfMatch && ctxEf > 0) {
    const target = parseInt(toEfMatch[1], 10);
    if (target >= 0 && target <= 100000) {
      console.log('[parseDeviationFromAssistantResponse] Parsed EF "to" pattern:', {
        text: t.substring(0, 150),
        target,
        ctxEf,
        delta: target - ctxEf,
      });
      return { category: 'ef', delta: target - ctxEf };
    }
  }
  
  const toDebtMatch = t.match(/(?:reduced|reduce|set|make)\s+(?:your\s+)?(?:debt|high\s*[- ]?apr)\s+to\s+\$?(\d+)/i) ??
    t.match(/(?:debt|high\s*[- ]?apr)\s+to\s+\$?(\d+)/i);
  if (toDebtMatch && ctxDebt > 0) {
    const target = parseInt(toDebtMatch[1], 10);
    if (target >= 0 && target <= 100000) {
      return { category: 'debt', delta: target - ctxDebt };
    }
  }
  
  const toRetirementMatch = t.match(/(?:reduced|reduce|set|make)\s+(?:your\s+)?(?:retirement|roth|ira)\s+to\s+\$?(\d+)/i) ??
    t.match(/(?:retirement|roth|ira)\s+to\s+\$?(\d+)/i);
  if (toRetirementMatch && ctxRetirement > 0) {
    const target = parseInt(toRetirementMatch[1], 10);
    if (target >= 0 && target <= 100000) {
      return { category: 'retirementExtra', delta: target - ctxRetirement };
    }
  }
  
  const toBrokerageMatch = t.match(/(?:reduced|reduce|set|make)\s+(?:your\s+)?(?:brokerage|investing|investment)\s+to\s+\$?(\d+)/i) ??
    t.match(/(?:brokerage|investing|investment)\s+to\s+\$?(\d+)/i);
  if (toBrokerageMatch && ctxBrokerage > 0) {
    const target = parseInt(toBrokerageMatch[1], 10);
    if (target >= 0 && target <= 100000) {
      return { category: 'brokerage', delta: target - ctxBrokerage };
    }
  }

  // Check for "by $X" patterns BEFORE "frees up" check - this handles "reduced by $828.4" correctly
  // CRITICAL: Match decimal numbers too (e.g., "$828.4" or "by $828.4")
  const byMatchDecimal = t.match(/by\s+\$?(\d+\.?\d*)(?:\s|$|,|\.|\/mo|per month|monthly)/i);
  const byMatch = byMatchDecimal ?? t.match(/by\s+\$?(\d+)(?:\s|$|,|\.|\/mo|per month|monthly)/i) ?? t.match(/(?:reduce|reducing|lower|cut|drop|decrease)[^0-9]*\$?(\d+\.?\d*)/i);
  const numMatch = byMatch ?? t.match(/\$(\d+\.?\d*)\s*(?:\/mo|per month|monthly)?/) ?? t.match(/\$(\d+\.?\d*)/) ?? t.match(/\$(\d+)/);
  if (numMatch) {
    // Use parseFloat to handle decimals, then round to nearest dollar
    const amount = Math.round(parseFloat(numMatch[1]));
    if (amount > 0 && amount <= 10000) {
      const isReduce = /(?:reduce|reducing|lower|cut|drop|decrease)/i.test(t);
      const isIncrease = /(?:increase|increasing|raise|boost|add)/i.test(t);
      const delta = isReduce ? -amount : isIncrease ? amount : 0;
      if (delta !== 0) {
        // CRITICAL: Only match categories if there's an explicit action verb AND the category is mentioned
        // Don't match if category is just mentioned as an option (e.g., "to emergency fund, debt, investment")
        // Check for action verb + category pattern, not just category mention
        const efAction = /(?:reduce|reducing|lower|cut|drop|decrease|increase|increasing|raise|boost|add).*?(?:emergency\s*fund|emergency fund|ef|buffer)/i.test(t) ||
          /(?:emergency\s*fund|emergency fund|ef|buffer).*?(?:reduce|reducing|lower|cut|drop|decrease|increase|increasing|raise|boost|add|by)/i.test(t);
        const debtAction = /(?:reduce|reducing|lower|cut|drop|decrease|increase|increasing|raise|boost|add).*?(?:debt|high\s*[- ]?apr)/i.test(t) ||
          /(?:debt|high\s*[- ]?apr).*?(?:reduce|reducing|lower|cut|drop|decrease|increase|increasing|raise|boost|add|by)/i.test(t);
        const retirementAction = /(?:reduce|reducing|lower|cut|drop|decrease|increase|increasing|raise|boost|add).*?(?:retirement|roth|ira)/i.test(t) ||
          /(?:retirement|roth|ira).*?(?:reduce|reducing|lower|cut|drop|decrease|increase|increasing|raise|boost|add|by)/i.test(t);
        const brokerageAction = /(?:reduce|reducing|lower|cut|drop|decrease|increase|increasing|raise|boost|add).*?(?:brokerage|investing|investment)/i.test(t) ||
          /(?:brokerage|investing|investment).*?(?:reduce|reducing|lower|cut|drop|decrease|increase|increasing|raise|boost|add|by)/i.test(t);
        const hsaAction = /(?:reduce|reducing|lower|cut|drop|decrease|increase|increasing|raise|boost|add).*?hsa/i.test(t) ||
          /\bhsa\b.*?(?:reduce|reducing|lower|cut|drop|decrease|increase|increasing|raise|boost|add|by)/i.test(t);
        
        if (efAction && /(?:emergency\s*fund|emergency fund|ef|buffer)/i.test(t)) return { category: 'ef', delta };
        if (debtAction && /(?:debt|high\s*[- ]?apr)/i.test(t)) return { category: 'debt', delta };
        if (retirementAction && /(?:retirement|roth|ira)/i.test(t)) return { category: 'retirementExtra', delta };
        if (brokerageAction && /(?:brokerage|investing|investment)/i.test(t)) return { category: 'brokerage', delta };
        if (/(?:401\s*k|401k)/i.test(t)) {
          console.log('[parseDeviationFromAssistantResponse] Parsed 401k "by" pattern:', {
            text: t.substring(0, 150),
            byMatchDecimal: byMatchDecimal?.[1],
            byMatch: byMatch?.[1],
            numMatch: numMatch[1],
            amount,
            delta,
            ctx401k,
          });
          return { category: '401k', delta };
        }
        if (hsaAction && /\bhsa\b/i.test(t)) return { category: 'hsa', delta };
      }
    }
  }

  // "Frees up $X/month" — use parsed amount for partial reduction; only use full context when amount >= current or not parseable
  // BUT: Only use this if we didn't already find a "to $X" or "by $X" pattern above
  const freesUp = /(?:frees?\s+up|free\s+up)\s+\$?\d+/i.test(t);
  const freedAmount = parseFreedAmountFromAssistant(assistantText);
  if (!to401kMatch && !byMatch && freesUp && ctx401k > 0 && (has401k || !/(?:emergency|debt|brokerage|retirement|roth|ef\b|hsa)/i.test(t))) {
    const delta401k = freedAmount != null && freedAmount < ctx401k ? -freedAmount : -ctx401k;
    console.log('[parseDeviationFromAssistantResponse] Using "frees up" for 401k:', {
      freedAmount,
      ctx401k,
      delta401k,
    });
    return { category: '401k', delta: delta401k };
  }
  if (!toHsaMatch && !byMatch && freesUp && ctxHsa > 0 && (hasHsa || /frees?\s+up.*hsa|hsa.*frees?\s+up/i.test(t))) {
    const deltaHsa = freedAmount != null && freedAmount < ctxHsa ? -freedAmount : -ctxHsa;
    return { category: 'hsa', delta: deltaHsa };
  }

  const eliminateOrRemove = /(?:eliminate|eliminated|remove|removed|drop\s+to\s+zero|stop\s+contributing|discontinue|set\s+(?:your\s+)?(?:401k|401\s*\(?\s*k\s*\)?|hsa)\s+to\s+\$?0|to\s+zero|reduced\s+to\s+\$?0|now\s+\$?0|contribution\s+to\s+\$?0)/i.test(t);
  // "Reducing your 401(k) is not optimal... Use Proceed to see the updated plan" — treat as full elimination ONLY if no target value specified AND no "by $X" pattern found
  const reduceOrProceed401k = has401k && !to401kMatch && !byMatch && (/(?:reducing|reduce)\s+(?:your\s+)?(?:401|401k)/i.test(t) || /proceed\s+to\s+see\s+the\s+updated\s+plan|updated\s+plan/i.test(t));
  const reduceOrProceedHsa = hasHsa && !toHsaMatch && !byMatch && (/(?:reducing|reduce).*hsa/i.test(t) || /proceed\s+to\s+see\s+the\s+updated\s+plan|updated\s+plan/i.test(t));

  if ((eliminateOrRemove || reduceOrProceed401k) && has401k && ctx401k > 0) {
    return { category: '401k', delta: -ctx401k };
  }
  if ((eliminateOrRemove || reduceOrProceedHsa) && hasHsa && ctxHsa > 0) {
    return { category: 'hsa', delta: -ctxHsa };
  }
  
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

export interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export const SavingsChatPanel: React.FC<SavingsChatPanelProps> = ({
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
  currentPreTax401k$,
  currentHsa$,
  messages: controlledMessages,
  setMessages: controlledSetMessages,
}) => {
  // Always pass current amounts so we can parse "eliminate 401k/HSA" and "reduce to X" from assistant message
  // Get baseline values from baselinePlanForChat (which reflects the frozen baseline/Ribbit Proposal)
  const baselineEf$ = useMemo(() => {
    if (!baselinePlanForChat?.planSteps) return 0;
    const efStep = baselinePlanForChat.planSteps.find(s => s.id === 'ef' || s.type === 'emergency');
    return efStep?.amountMonthly ?? 0;
  }, [baselinePlanForChat]);
  
  const baselineDebt$ = useMemo(() => {
    if (!baselinePlanForChat?.planSteps) return 0;
    const debtStep = baselinePlanForChat.planSteps.find(s => s.id === 'debt' || s.type === 'debt');
    return debtStep?.amountMonthly ?? 0;
  }, [baselinePlanForChat]);
  
  const baselineRetirement$ = useMemo(() => {
    if (!baselinePlanForChat?.planSteps) return 0;
    const retirementStep = baselinePlanForChat.planSteps.find(s => s.id === 'retirement' || s.type === 'retirement_tax_advantaged');
    return retirementStep?.amountMonthly ?? 0;
  }, [baselinePlanForChat]);
  
  const baselineBrokerage$ = useMemo(() => {
    if (!baselinePlanForChat?.planSteps) return 0;
    const brokerageStep = baselinePlanForChat.planSteps.find(s => s.id === 'brokerage' || s.type === 'brokerage');
    return brokerageStep?.amountMonthly ?? 0;
  }, [baselinePlanForChat]);
  
  const deviationContext = useMemo(
    () => ({ 
      preTax401k$: currentPreTax401k$ ?? 0, 
      hsa$: currentHsa$ ?? 0,
      ef$: baselineEf$,
      debt$: baselineDebt$,
      retirementExtra$: baselineRetirement$,
      brokerage$: baselineBrokerage$,
    }),
    [currentPreTax401k$, currentHsa$, baselineEf$, baselineDebt$, baselineRetirement$, baselineBrokerage$]
  );
  const router = useRouter();
  const [internalMessages, setMessagesRaw] = useState<ChatMessage[]>([
    { id: '0', text: introMessage, isUser: false, timestamp: new Date() },
  ]);
  const setMessagesInternal = useCallback((updater: React.SetStateAction<ChatMessage[]>) => {
    if (DEBUG_STREAMING) {
      const stack = new Error().stack ?? '';
      streamLog('setMessages INVOKED', { callSite: stack.split('\n').slice(2, 5).join(' | ') });
    }
    setMessagesRaw(updater);
  }, []);
  const isControlled = controlledMessages != null && controlledSetMessages != null;
  const messages = isControlled ? controlledMessages : internalMessages;
  const setMessages = isControlled ? controlledSetMessages : setMessagesInternal;
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingDeviation, setPendingDeviation] = useState<{
    category: 'ef' | 'debt' | 'retirementExtra' | 'brokerage' | '401k' | 'hsa';
    delta: number;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatThreadContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  /** Avoid applying the same assistant message twice when parent re-renders (prevents "Maximum update depth exceeded"). */
  const lastAppliedMessageIdRef = useRef<string | null>(null);
  /** Same streaming pattern as FinancialSidekick: accumulate in ref, render from ref during stream, flush to state in finally. */
  const streamingTextRef = useRef('');
  const streamingMessageIdRef = useRef<string | null>(null);
  /** When we correct "to $X" and apply plan changes, allocator returns "Got it. That frees up $N/month". We patch the streamed reply with this amount. */
  const streamingCorrectFreedAmountRef = useRef<number | null>(null);
  /** Id of the message we last streamed into — keep so we can show ref content until state has committed (avoids flash/overwrite). */
  const lastStreamedMessageIdRef = useRef<string | null>(null);
  /** Track last assistant message id + length to detect overwrite of same message. */
  const lastAssistantRef = useRef<{ id: string; len: number }>({ id: '', len: 0 });
  const [streamingTick, setStreamingTick] = useState(0);
  /** Ref to read latest messages from async callbacks (e.g. stability check). */
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  useEffect(() => {
    if (!DEBUG_STREAMING) return;
    streamLog('MOUNTED');
    return () => {
      streamLog('UNMOUNTED');
    };
  }, []);

  // Scroll only the chat thread area so new messages are visible; do not scroll the page (avoids jumping to net worth chart)
  useEffect(() => {
    const el = chatThreadContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, streamingTick]);

  // When assistant proposes or confirms a change, extract deviation so Proceed shows and/or plan updates immediately
  // Skip for "explain the plan" type requests — the response contains Current/Proposed text that can be falsely parsed as a deviation and trigger a plan update that overwrites the streamed reply
  useEffect(() => {
    if (!onUserRequestedPlanChange || messages.length < 2) return;
    const last = messages[messages.length - 1];
    if (last.isUser) return;
    const prevUser = [...messages].reverse().find((m) => m.isUser);
    if (prevUser && isExplainOnlyRequest(prevUser.text ?? '')) {
      streamLog('deviation effect: SKIP (explain-only)', { lastId: last.id, lastMsgLen: (last.text ?? '').length });
      return;
    }
    const text = last.text ?? '';
    const parsed = parseDeviationFromAssistantResponse(text, deviationContext);
    if (!parsed) return;

    const assistantConfirmed = /(?:frees?\s+up|free\s+up|i've\s+reduced|i've\s+eliminated|i've\s+removed|here's\s+the\s+updated\s+plan)/i.test(text);
    // Apply at most once per message so parent re-renders don't re-trigger (avoids infinite loop)
    if (assistantConfirmed) {
      if (lastAppliedMessageIdRef.current === last.id) return;
      lastAppliedMessageIdRef.current = last.id;
      // CRITICAL: Prefer pendingDeviation if it exists - it has the correct delta from user's original "to $X" request
      // Only use parsed assistant response if pendingDeviation doesn't exist or is for a different category
      const toApply = pendingDeviation && pendingDeviation.category === parsed.category ? pendingDeviation : parsed;
      console.log('[SavingsChatPanel] Applying change from assistant:', {
        assistantText: text.substring(0, 200),
        parsed,
        pendingDeviation,
        toApply,
        category: toApply.category,
        delta: toApply.delta,
        willUsePendingDeviation: pendingDeviation && pendingDeviation.category === parsed.category,
        deviationContext,
        warning: pendingDeviation && Math.abs(pendingDeviation.delta) < Math.abs(parsed.delta) && parsed.category === pendingDeviation.category
          ? 'WARNING: pendingDeviation delta is smaller than parsed delta - may indicate baseline was wrong'
          : undefined,
      });
      streamLog('deviation effect: CALLING onUserRequestedPlanChange', { category: toApply.category, delta: toApply.delta });
      onUserRequestedPlanChange(toApply);
      setPendingDeviation(null);
      return;
    }
    if (!pendingDeviation) setPendingDeviation(parsed);
  }, [messages, pendingDeviation, onUserRequestedPlanChange, deviationContext]);

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

    const requestParsed = parseDeviationRequest(text, deviationContext);
    const optOutParsed = parseOptOutRequest(text, deviationContext);
    if (isExplainOnlyRequest(text)) {
      setPendingDeviation(null);
    } else if (requestParsed) {
      console.log('[SavingsChatPanel] Setting pendingDeviation from user request:', {
        text: text.substring(0, 100),
        requestParsed,
        deviationContext,
      });
      setPendingDeviation(requestParsed);
    } else if (optOutParsed) {
      console.log('[SavingsChatPanel] Setting pendingDeviation from opt-out:', optOutParsed);
      setPendingDeviation(optOutParsed);
    } else if (!/^(?:Why\s+(?:these\s+changes|the\s+plan\s+works)\??)$/i.test(text)) {
      setPendingDeviation(null);
    }

    // When user says where to move freed funds ("debt", "emergency fund", "investment", "HSA") after we asked
    const destination = parseDestinationChoice(text);
    if (destination && onUserRequestedPlanChange && messages.length >= 1) {
      const lastAssistant = [...messages].reverse().find((m) => !m.isUser);
      const assistantText = lastAssistant?.text ?? '';
      const preTaxAmount = parseFreedAmountFromAssistant(assistantText);
      if (preTaxAmount != null && /where\s+should|or\s+say|tell\s+me\s+where/i.test(assistantText)) {
        const isPreTax = isPreTaxSource(assistantText);
        const ESTIMATED_MARGINAL_TAX_RATE = 0.25; // 25% combined federal + state
        
        // Calculate amount based on source and destination types
        let amountToApply: number;
        let appliedLabel: string;
        if (isPreTax) {
          // Source is pre-tax (401k/HSA reduction)
          if (destination === 'hsa') {
            // Pre-tax → pre-tax: use full amount
            amountToApply = preTaxAmount;
            appliedLabel = `$${Math.round(preTaxAmount).toLocaleString()}/month`;
          } else {
            // Pre-tax → post-tax: apply tax conversion
            amountToApply = Math.round(preTaxAmount * (1 - ESTIMATED_MARGINAL_TAX_RATE));
            const taxSavings = preTaxAmount - amountToApply;
            appliedLabel = `$${Math.round(amountToApply).toLocaleString()}/month ($${Math.round(preTaxAmount).toLocaleString()} pre-tax, ~$${Math.round(taxSavings).toLocaleString()} goes to taxes)`;
          }
        } else {
          // Source is post-tax: use full amount
          amountToApply = preTaxAmount;
          appliedLabel = `$${Math.round(amountToApply).toLocaleString()}/month`;
        }
        
        if (destination === 'hsa') {
          // HSA is pre-tax — just add the full pre-tax amount, don't touch brokerage (no default allocation happened)
          onUserRequestedPlanChange({ category: 'hsa', delta: amountToApply });
        } else if (destination === 'brokerage') {
          // User chose investment — add freed amount to brokerage (default was already brokerage; no subtract needed)
          onUserRequestedPlanChange({ category: 'brokerage', delta: amountToApply });
        } else {
          // User chose a post-tax bucket (ef, debt, retirement) — move from default (brokerage) to their choice
          // Only subtract if source was pre-tax (we calculated post-tax amount) and default would have been brokerage
          if (isPreTax) {
            // Default would have been brokerage with post-tax amount, but user chose different post-tax bucket
            const postTaxAmount = Math.round(preTaxAmount * (1 - ESTIMATED_MARGINAL_TAX_RATE));
            onUserRequestedPlanChange({ category: 'brokerage', delta: -postTaxAmount });
          }
          onUserRequestedPlanChange({ category: destination, delta: amountToApply });
        }
        const DEST_LABELS: Record<string, string> = {
          ef: 'emergency fund',
          debt: 'debt paydown',
          retirementExtra: 'retirement',
          brokerage: 'investment account',
          hsa: 'HSA',
        };
        const label = DEST_LABELS[destination] ?? destination;
        setMessages((prev) => [
          ...prev,
          { id: `moved-${Date.now()}`, text: `Done. I've moved ${appliedLabel} to your ${label}. Here's the updated plan — want me to apply it?`, isUser: false, timestamp: new Date() },
        ]);
        setIsLoading(false);
        return;
      }
    }

    // When user says "yes"/"apply"/etc to a proposed change, apply the deviation so the plan UI updates immediately (use pendingDeviation if set, else parse last assistant message)
    const isConfirmation = HAS_CONFIRM.test(text) || CONFIRM_WORDS.test(text);
    if (isConfirmation && onUserRequestedPlanChange && !requestParsed) {
      const lastAssistant = [...messages].reverse().find((m) => !m.isUser);
      const assistantText = lastAssistant?.text ?? '';
      const asksWhereToMove = /where\s+should|or\s+say|tell\s+me\s+where/i.test(assistantText);
      
      // If assistant asked "where should it go?" and user says "apply" (default), move to brokerage with tax conversion
      if (asksWhereToMove && isConfirmation) {
        const preTaxAmount = parseFreedAmountFromAssistant(assistantText);
        const isPreTax = isPreTaxSource(assistantText);
        if (preTaxAmount != null && isPreTax) {
          const ESTIMATED_MARGINAL_TAX_RATE = 0.25;
          const postTaxAmount = Math.round(preTaxAmount * (1 - ESTIMATED_MARGINAL_TAX_RATE));
          onUserRequestedPlanChange({ category: 'brokerage', delta: postTaxAmount });
          const taxSavings = preTaxAmount - postTaxAmount;
          setMessages((prev) => [
            ...prev,
            { id: `default-${Date.now()}`, text: `Done. I've moved ~$${postTaxAmount}/month to your investment account ($${preTaxAmount} pre-tax, ~$${taxSavings} goes to taxes). Here's the updated plan — want me to apply it?`, isUser: false, timestamp: new Date() },
          ]);
          setIsLoading(false);
          return;
        }
      }
      
      const toApply = pendingDeviation ?? (() => {
        return parseDeviationFromAssistantResponse(assistantText, deviationContext);
      })();
      if (toApply) {
        const confirmMsg = onUserRequestedPlanChange(toApply);
        if (typeof confirmMsg === 'string') {
          setMessages((prev) => [
            ...prev,
            { id: `confirm-${Date.now()}`, text: confirmMsg, isUser: false, timestamp: new Date() },
          ]);
        }
        setPendingDeviation(null);
        setIsLoading(false);
        return;
      }
    }

    const proposedPlanCompact = {
      planSteps: proposedPlan.steps.slice(0, 5),
      totals: proposedPlan.totals,
      assumptions: proposedPlan.assumptions.slice(0, 5),
      warnings: proposedPlan.warnings ?? [],
      keyMetric: proposedPlan.keyMetric,
      ...(toolOutputExplain && { explain: toolOutputExplain }),
    };
    const chatRequest = {
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

    // Explain-only requests: use non-streaming so we set one complete message and avoid streaming timing/overwrite issues
    if (isExplainOnlyRequest(text)) {
      const explainMessageId = (Date.now() + 1).toString();
      setMessages((prev) => [...prev, { id: explainMessageId, text: '', isUser: false, timestamp: new Date() }]);
      try {
        const result = await sendChatMessage(chatRequest);
        const fullText = typeof result === 'string' ? result : (result?.response ?? '');
        setMessages((prev) =>
          prev.map((m) => (m.id === explainMessageId ? { ...m, text: fullText || 'I couldn\'t generate an explanation.' } : m))
        );
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Something went wrong.';
        setMessages((prev) =>
          prev.map((m) => (m.id === explainMessageId ? { ...m, text: `I couldn't complete that: ${errMsg}` } : m))
        );
      } finally {
        setIsLoading(false);
      }
      return;
    }

    const streamingId = (Date.now() + 1).toString();
    streamingTextRef.current = '';
    streamingMessageIdRef.current = streamingId;
    lastStreamedMessageIdRef.current = streamingId;
    streamLog('stream START', { streamingId, userMsgPreview: text.slice(0, 50), messagesCount: messages.length + 2 });
    setMessages((prev) => [...prev, { id: streamingId, text: '', isUser: false, timestamp: new Date() }]);

    let chunkCount = 0;
    try {
      await sendChatMessageStreaming(
        chatRequest,
        {
          onChunk(chunk: string) {
            chunkCount++;
            streamingTextRef.current += chunk;
            setStreamingTick((t) => t + 1);
            if (DEBUG_STREAMING && chunkCount <= 3) streamLog('onChunk', { chunkNum: chunkCount, chunkLen: chunk.length, totalLen: streamingTextRef.current.length });
          },
          onDone(meta: { proposedPlannedSavings?: number; planChanges?: PlanChangesFromChat }) {
            streamLog('onDone', { hasPlanChanges: !!meta.planChanges, chunkCount, refLen: streamingTextRef.current.length, refPreview: streamingTextRef.current.slice(0, 80) });
            if (!meta.planChanges || !onUserRequestedPlanChange) return;
            const lastUserMsg = [...messages, userMessage].filter((m) => m.isUser).pop()?.text ?? '';
            if (isExplainOnlyRequest(lastUserMsg)) {
              streamLog('onDone SKIP applyPlanChanges (explain-only request)');
              return;
            }
            streamLog('onDone APPLYING planChanges', meta.planChanges);
            streamingCorrectFreedAmountRef.current = null;
            const followUpMsg = applyPlanChangesFromChat(meta.planChanges, {
              onUserRequestedPlanChange,
              currentPreTax401k$: currentPreTax401k$ ?? 0,
              currentHsa$: currentHsa$ ?? 0,
              currentEf$: baselineEf$,
              currentDebt$: baselineDebt$,
              currentRetirementExtra$: baselineRetirement$,
              currentBrokerage$: baselineBrokerage$,
            }, lastUserMsg);
            // Extract correct "frees up $N/month" so we can patch the streamed reply if the AI said the wrong amount
            if (typeof followUpMsg === 'string') {
              const match = followUpMsg.match(/frees up \$\*?(\d+)\*?\/month/i) ?? followUpMsg.match(/That frees up \$(\d+)/i);
              if (match) streamingCorrectFreedAmountRef.current = parseInt(match[1], 10);
            }
          },
        }
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Something went wrong.';
      streamLog('catch: setting error message', { streamingId, errMsg });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamingId ? { ...m, text: `I couldn't complete that: ${errMsg}` } : m
        )
      );
    } finally {
      let finalText = streamingTextRef.current;
      const correctAmount = streamingCorrectFreedAmountRef.current;
      if (correctAmount != null && correctAmount > 0) {
        // AI may have said "That frees up $1/month" — replace with correct amount from allocator callback
        finalText = finalText.replace(
          /(frees up |That frees up )(\$\*?\d+\*?\/month)/gi,
          (_, prefix, _old) => `${prefix}$${correctAmount}/month`
        );
        streamLog('finally: patched frees up amount', { correctAmount, hadPatch: true });
      }
      streamingCorrectFreedAmountRef.current = null;
      streamLog('finally: flushing to state', { streamingId, finalLen: finalText.length, finalPreview: finalText.slice(0, 100) });
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === streamingId ? { ...m, text: finalText } : m));
        const updated = next.find((m) => m.id === streamingId);
        streamLog('setMessages(flush) updater ran', { streamingId, updatedMsgLen: updated?.text?.length ?? 0 });
        return next;
      });
      setIsLoading(false);
      queueMicrotask(() => {
        streamLog('queueMicrotask: clearing streamingMessageIdRef');
        streamingMessageIdRef.current = null;
      });
    }
  };

  // Once the last-streamed message has content in state, stop using the ref fallback so we don't hold refs forever
  useEffect(() => {
    const lastId = lastStreamedMessageIdRef.current;
    if (!lastId) return;
    const msg = messages.find((m) => m.id === lastId);
    if (msg && (msg.text ?? '').trim().length > 0) {
      const len = msg.text!.length;
      streamLog('effect: clearing lastStreamedMessageIdRef (message has content in state)', { lastId, msgLen: len });
      lastStreamedMessageIdRef.current = null;
      // Delayed stability check: read latest state after 2s to see if something overwrote the message
      if (DEBUG_STREAMING) {
        const checkAt = 2000;
        const idToCheck = lastId;
        const expectedLen = len;
        const timeoutId = window.setTimeout(() => {
          const latest = messagesRef.current;
          const current = latest.find((m) => m.id === idToCheck);
          const currentLen = (current?.text ?? '').length;
          if (currentLen !== expectedLen) {
            streamLog('STABILITY CHECK: message length changed after 2s', {
              id: idToCheck,
              expectedLen,
              currentLen,
              preview: (current?.text ?? '').slice(0, 80),
            });
          } else {
            streamLog('stability check (2s): message unchanged', { id: idToCheck, len: currentLen });
          }
        }, checkAt);
        return () => window.clearTimeout(timeoutId);
      }
    }
  }, [messages]);

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

        {/* Delta view: single column (Ribbit only) when first_time and no user changes; else col 1 = Ribbit/Current, col 2 = Proposed. */}
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
                    <th className="text-right py-1 px-2 font-medium text-slate-700 dark:text-slate-300">
                      {delta.singleColumn ? 'Ribbit Proposal' : (isFirstTimeSetup ? 'Ribbit Proposal' : 'Current Plan')}
                    </th>
                    {!delta.singleColumn && (
                      <th className="text-right py-1 px-2 font-medium text-slate-700 dark:text-slate-300">Proposed</th>
                    )}
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
                        {!delta.singleColumn && (
                          <td className={`text-right py-1 px-2 ${proposedCellClass}`}>{fmt(row.proposed.monthly)}</td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          ) : planSummaryBullets ? (
            <>
              <p className="font-medium text-slate-900 dark:text-white mb-1">Proposed plan</p>
              <pre className="whitespace-pre-wrap font-sans text-xs">{planSummaryBullets}</pre>
              {keyLine && <p className="mt-2 font-medium text-slate-900 dark:text-white">{keyLine}</p>}
            </>
          ) : currentPlanBullets ? (
            <>
              <p className="font-medium text-slate-900 dark:text-white mb-1">{isFirstTimeSetup ? 'Ribbit Plan' : 'Current plan'}</p>
              <pre className="whitespace-pre-wrap font-sans text-xs">{currentPlanBullets}</pre>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Proposed will appear here after you adjust the plan. Ask Ribbit if you have questions.
              </p>
            </>
          ) : (
            <p className="text-slate-500 dark:text-slate-400">No allocation yet. Ask Ribbit if you have questions.</p>
          )}
        </div>

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
              onClick={() => handleSend(
                isNoChange
                  ? 'Why the plan works?'
                  : "What's different between my current plan and the proposed plan? Explain the changes you're proposing and why."
              )}
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

        {/* Chat thread — show only streamed/final text (no prepended breakdown block). */}
        <div ref={chatThreadContainerRef} className="space-y-4 max-h-[36rem] overflow-y-auto border-t border-slate-200 dark:border-slate-700 pt-3">
          {(isFirstTimeSetup ? messages.slice(1) : messages).map((m, idx, arr) => {
            const isStreamingThis = m.id === streamingMessageIdRef.current && isLoading;
            const isJustStreamed = m.id === lastStreamedMessageIdRef.current && !m.isUser;
            const displayText = isStreamingThis
              ? streamingTextRef.current
              : isJustStreamed && (m.text ?? '').trim() === '' && streamingTextRef.current
                ? streamingTextRef.current
                : (m.text ?? '');
            const isLastAssistant = !m.isUser && idx === arr.length - 1;
            if (DEBUG_STREAMING && isLastAssistant) {
              const len = (m.text ?? '').length;
              const prev = lastAssistantRef.current;
              if (prev.id === m.id && prev.len > 0 && len < prev.len) {
                streamLog('OVERWRITE DETECTED: same message length decreased', { id: m.id, from: prev.len, to: len, preview: (m.text ?? '').slice(0, 80) });
              }
              lastAssistantRef.current = { id: m.id, len };
              streamLog('render last assistant', {
                id: m.id,
                mTextLen: len,
                mTextPreview: (m.text ?? '').slice(0, 60),
                displayLen: displayText.length,
                displayPreview: displayText.slice(0, 60),
                isStreamingThis,
                isJustStreamed,
                refLen: streamingTextRef.current.length,
              });
            }
            return (
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
                    <ChatMarkdown size="sm">{displayText}</ChatMarkdown>
                  )}
                </div>
              </div>
            );
          })}
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
};
