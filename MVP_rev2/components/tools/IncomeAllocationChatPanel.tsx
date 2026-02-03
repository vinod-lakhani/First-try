/**
 * Ribbit — Income plan (savings-helper). Simplified summary card: headline, chips,
 * sentence, quick actions (Save faster / More spending money / Why?), chat.
 * Proposal strip lives on the page; chat never shows Current vs Proposed unless there is a delta.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import ReactMarkdown from 'react-markdown';
import { sendChatMessageStreaming } from '@/lib/chat/chatService';
import { CHAT_INPUT_PLACEHOLDER } from '@/lib/chat/chatPrompts';
import { getShiftLimit, type IncomeAllocationSnapshot } from '@/lib/income/incomeAllocationAdapter';

export type IncomeProposalIntent = 'SAVE_MORE' | 'MORE_SPENDING' | 'TIGHTEN_PLAN';

export interface IncomeAllocationChatPanelProps {
  snapshot: IncomeAllocationSnapshot;
  onTrack: boolean;
  stepAmountForTweak: number;
  payrollEstLine?: { payroll: number; match: number };
  onConfirmApply: () => void;
  onNotNow: () => void;
  onDraftProposal: (intent: IncomeProposalIntent) => void;
  lastUserIntent?: string | null;
  chatInputRef?: React.RefObject<HTMLTextAreaElement | null>;
  showProposalInCard?: boolean;
  /** When set, chips show these labels/values (actuals vs plan states). */
  chipCfg?: { chipALabel: string; chipBLabel: string; chipAValue: number; chipBValue: number };
  /** When !onTrack, used for MODE B intro: "You're trending about $X [over/under] your plan..." */
  driftAmount?: number;
  driftDirection?: 'over' | 'under';
}

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

const FMT = (n: number) =>
  `$${Math.round(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/mo`;

function parseIncomeIntent(text: string): IncomeProposalIntent | null {
  const t = text.toLowerCase().trim();
  if (/save\s+more|help\s+me\s+save|tighten|cut\s+(back\s+)?(spending|wants)|reduce\s+(my\s+)?(spending|wants)/i.test(t)) return 'SAVE_MORE';
  if (/more\s+spending|spending\s+money|free\s+up|give\s+me\s+more|need\s+more\s+(money|spending)/i.test(t)) return 'MORE_SPENDING';
  if (/tighten\s+(my\s+)?plan/i.test(t)) return 'TIGHTEN_PLAN';
  return null;
}

export function IncomeAllocationChatPanel({
  snapshot,
  onTrack,
  stepAmountForTweak,
  payrollEstLine,
  onConfirmApply,
  onNotNow,
  onDraftProposal,
  lastUserIntent = null,
  chatInputRef: externalChatInputRef,
  showProposalInCard = false,
  chipCfg,
  driftAmount,
  driftDirection,
}: IncomeAllocationChatPanelProps) {
  const { proposed, current } = snapshot;
  const hasProposed = proposed != null;

  const introOnTrack = "Your spending is tracking your plan. Want to save faster or free up spending money?";
  const introDrifting = driftAmount != null && driftDirection
    ? `You're trending about $${Math.round(driftAmount).toLocaleString()} ${driftDirection} your plan this month. Want me to adjust your plan, or help you get back on track?`
    : "Your spending is drifting from your plan. Want me to suggest a step-sized adjustment?";
  const introProposalDrafted = "I drafted a step-sized change for this month. Nothing is applied until you confirm. Want me to apply it?";

  const defaultIntro = hasProposed ? introProposalDrafted : (onTrack ? introOnTrack : introDrifting);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: '0', text: defaultIntro, isUser: false, timestamp: new Date() },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [notNowCooldown, setNotNowCooldown] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<IncomeProposalIntent | null>(null);
  const chatThreadContainerRef = useRef<HTMLDivElement>(null);
  const internalTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const textareaRef = externalChatInputRef ?? internalTextareaRef;

  useEffect(() => {
    const el = chatThreadContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (messages.length === 1) {
      const intro = hasProposed ? introProposalDrafted : (onTrack ? introOnTrack : introDrifting);
      setMessages((prev) => (prev[0].text !== intro ? [{ ...prev[0], text: intro }] : prev));
    }
  }, [hasProposed, onTrack, introOnTrack, introDrifting, introProposalDrafted, messages.length]);

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

    const intent = parseIncomeIntent(text);
    if (intent) setPendingIntent(intent);
    else setPendingIntent(null);

    const contextPacket = {
      past3m: snapshot.past3m,
      current: snapshot.current,
      recommended: snapshot.recommended,
      proposed: intent ? null : snapshot.proposed,
      shiftLimit: snapshot.proposed?.shiftLimit ?? (snapshot.current?.netIncomeMonthly != null
        ? getShiftLimit(snapshot.current.netIncomeMonthly)
        : null),
      uiState: {
        proposedExists: Boolean(snapshot.proposed),
        lastUserIntent: lastUserIntent ?? text,
        pendingIntent: intent ?? undefined,
        onTrack,
      },
    };

    const streamingId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: streamingId, text: '', isUser: false, timestamp: new Date() }]);

    try {
      await sendChatMessageStreaming(
        {
          messages: [...messages, userMessage].map((m) => ({
            id: m.id,
            text: m.text,
            isUser: m.isUser,
            timestamp: m.timestamp,
          })),
          context: 'savings-helper',
          userPlanData: { incomeAllocationContext: contextPacket },
        },
        {
          onChunk(text) {
            setMessages((prev) =>
              prev.map((m) => (m.id === streamingId ? { ...m, text: m.text + text } : m))
            );
          },
        }
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Something went wrong.';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamingId ? { ...m, text: `I couldn't complete that: ${errMsg}` } : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceed = () => {
    if (pendingIntent) {
      onDraftProposal(pendingIntent);
      setPendingIntent(null);
    }
  };

  const handleNotNow = () => {
    onNotNow();
    setNotNowCooldown(true);
    setTimeout(() => setNotNowCooldown(false), 30000);
  };

  const safeToSpend = chipCfg?.chipAValue ?? (current.needsMonthly + current.wantsMonthly);
  const cashSavings = chipCfg?.chipBValue ?? current.cashMonthly;
  const chipALabel = chipCfg?.chipALabel ?? 'Safe to spend';
  const chipBLabel = chipCfg?.chipBLabel ?? 'Cash savings';
  const headline = onTrack ? 'Your spending is on track' : 'Your spending is drifting';
  const sentence = onTrack
    ? "Your spending is tracking your plan. Want to save faster or free up spending money?"
    : `I can suggest a step-sized adjustment (about $${Math.round(stepAmountForTweak).toLocaleString()}) to better match your plan.`;

  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardContent className="p-4 space-y-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Ribbit — Income plan</h2>

        <p className="text-lg font-medium text-slate-900 dark:text-white">{headline}</p>

        <div className="flex flex-wrap gap-3">
          <div className="rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 min-w-[140px]">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{chipALabel}</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{FMT(safeToSpend)}</p>
          </div>
          <div className="rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 min-w-[140px]">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{chipBLabel}</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{FMT(cashSavings)}</p>
          </div>
        </div>

        {(payrollEstLine?.payroll ?? 0) > 0 || (payrollEstLine?.match ?? 0) > 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Payroll savings (est.): {FMT(payrollEstLine?.payroll ?? 0)} · Match (est.): {FMT(payrollEstLine?.match ?? 0)}
          </p>
        ) : null}

        <p className="text-sm text-slate-600 dark:text-slate-400">{sentence}</p>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => onDraftProposal('SAVE_MORE')}
          >
            Save faster
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDraftProposal('MORE_SPENDING')}
          >
            More spending money
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleSend('Why?')} disabled={isLoading}>
            Why?
          </Button>
        </div>

        {showProposalInCard && hasProposed && proposed && (
          <>
            <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-3 text-sm">
              <p className="font-medium text-slate-900 dark:text-white mb-2">{proposed.narrative.headline}</p>
              <div className="space-y-1 text-xs">
                {Math.abs(proposed.deltas.wantsMonthly) >= 0.5 && (
                  <div className="flex justify-between">
                    <span>Wants</span>
                    <span>{FMT(current.wantsMonthly)} → {FMT(proposed.wantsMonthly)} ({proposed.deltas.wantsMonthly >= 0 ? '+' : ''}{FMT(proposed.deltas.wantsMonthly)})</span>
                  </div>
                )}
                {Math.abs(proposed.deltas.cashMonthly) >= 0.5 && (
                  <div className="flex justify-between">
                    <span>Cash</span>
                    <span>{FMT(current.cashMonthly)} → {FMT(proposed.cashMonthly)} ({proposed.deltas.cashMonthly >= 0 ? '+' : ''}{FMT(proposed.deltas.cashMonthly)})</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={onConfirmApply} className="bg-green-600 hover:bg-green-700 text-white">Confirm & Apply</Button>
              <Button variant="outline" size="sm" onClick={handleNotNow} disabled={notNowCooldown}>Not now</Button>
            </div>
          </>
        )}

        <p className="text-sm text-slate-600 dark:text-slate-400">Ask Ribbit about your spending and plan…</p>

        <div ref={chatThreadContainerRef} className="space-y-3 max-h-72 overflow-y-auto border-t border-slate-200 dark:border-slate-700 pt-3">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.isUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-lg px-4 py-3 ${
                  m.isUser ? 'bg-green-600 text-white text-sm' : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                }`}
              >
                {m.isUser ? (
                  <p className="whitespace-pre-wrap">{m.text}</p>
                ) : (
                  <div className="prose prose-base dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 text-slate-800 dark:text-slate-200 leading-relaxed">
                    <ReactMarkdown>{m.text}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 text-sm text-slate-500">Thinking…</div>
            </div>
          )}
          {pendingIntent && !isLoading && messages.length >= 2 && messages[messages.length - 1]?.isUser === false && (
            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="button" onClick={handleProceed} className="rounded-full bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-green-700">
                Proceed
              </Button>
              <Button type="button" variant="outline" onClick={() => setPendingIntent(null)} className="rounded-full px-4 py-2 text-sm font-medium">
                Skip
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-end gap-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 min-h-[4.5rem]">
          <textarea
            ref={textareaRef}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder={CHAT_INPUT_PLACEHOLDER}
            rows={2}
            className="flex-1 min-h-[2.5rem] max-h-32 resize-y bg-transparent text-base outline-none placeholder:text-slate-500 py-1"
            disabled={isLoading}
          />
          <Button onClick={() => handleSend()} disabled={isLoading || !chatInput.trim()} size="sm">Send</Button>
        </div>
      </CardContent>
    </Card>
  );
}
