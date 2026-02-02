/**
 * Income Plan Chat Card — 4-state lifecycle + Adjust Plan review mode.
 * Sends lifecycle snapshot as context; supports deterministic injected messages + Apply/Ask/Keep actions.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChatMarkdown } from '@/components/chat/ChatMarkdown';
import { ChatLoadingDots } from '@/components/chat/ChatLoadingDots';
import { sendChatMessageStreaming } from '@/lib/chat/chatService';
import type { IncomeAllocationSnapshot } from '@/lib/income/incomeAllocationLifecycle';
import type { AdjustPlanMessage, MessageBlock } from '@/lib/income/adjustPlanMessage';
import { CHAT_HELPER_TEXT, CHAT_INPUT_PLACEHOLDER } from '@/lib/chat/chatPrompts';
import type { ChatCurrentPlanData } from '@/lib/chat/buildChatPlanData';

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  isInjected?: boolean;
}

const SUGGESTION_CHIPS = [
  'What if I save $100 more?',
  'What if I want more spending money?',
  'Why did you choose this amount?',
];

export interface IncomePlanChatCardProps {
  snapshot: IncomeAllocationSnapshot;
  uiMode: 'DEFAULT' | 'ADJUST_REVIEW';
  adjustPlanMessage: AdjustPlanMessage | null;
  chatFocusRequested: boolean;
  lastInjectedMessageKey: string | null;
  onMessageInjected: (key: string) => void;
  onApply: () => void;
  onAskQuestion: () => void;
  onKeepPlan: () => void;
  /** When the AI proposes a specific savings amount, parent can show it in Explore options */
  onProposalFromChat?: (plannedSavings: number) => void;
  /** After Apply+Confirm, parent sets this; chat appends it and calls onConfirmationMessageShown */
  confirmationMessage?: string | null;
  onConfirmationMessageShown?: () => void;
  /** Complete savings (401k, HSA, match, post-tax allocation) so Ribbit can answer "what is my current savings" with correct total */
  completeSavingsBreakdown?: {
    payroll401kMonthly: number;
    hsaMonthly: number;
    employerMatchMonthly: number;
    employerHSAMonthly: number;
    postTaxCashMonthly: number;
    allocation: { emergencyFund: number; debtPayoff: number; retirementTaxAdv: number; brokerage: number };
    totalSavingsMonthly: number;
  } | null;
  /** Current plan data for chat (net worth, savings breakdown, savings allocation) — ensures consistency across all chat windows */
  currentPlanDataForChat?: ChatCurrentPlanData;
}

export function IncomePlanChatCard({
  snapshot,
  uiMode,
  adjustPlanMessage,
  chatFocusRequested,
  lastInjectedMessageKey,
  onMessageInjected,
  onApply,
  onAskQuestion,
  onKeepPlan,
  onProposalFromChat,
  confirmationMessage,
  onConfirmationMessageShown,
  completeSavingsBreakdown,
  currentPlanDataForChat,
}: IncomePlanChatCardProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (chatFocusRequested && containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      textareaRef.current?.focus();
    }
  }, [chatFocusRequested]);

  useEffect(() => {
    if (uiMode === 'ADJUST_REVIEW' && adjustPlanMessage && adjustPlanMessage.key !== lastInjectedMessageKey) {
      onMessageInjected(adjustPlanMessage.key);
    }
  }, [uiMode, adjustPlanMessage, lastInjectedMessageKey, onMessageInjected]);

  const lastConfirmationRef = useRef<string | null>(null);
  useEffect(() => {
    if (confirmationMessage && confirmationMessage !== lastConfirmationRef.current) {
      lastConfirmationRef.current = confirmationMessage;
      setMessages((prev) => [
        ...prev,
        { id: `confirm_${Date.now()}`, text: confirmationMessage, isUser: false, timestamp: new Date() },
      ]);
      onConfirmationMessageShown?.();
    }
    if (!confirmationMessage) lastConfirmationRef.current = null;
  }, [confirmationMessage, onConfirmationMessageShown]);

  const contextPacket = {
    mode: snapshot.mode,
    state: snapshot.state,
    netIncomeMonthly: snapshot.income.netIncomeMonthly,
    last3m_avg: snapshot.actuals.last3m_avg,
    lastMonth: snapshot.actuals.lastMonth,
    currentPlan: snapshot.plan.currentPlan,
    recommendedPlan: snapshot.plan.recommendedPlan,
    deltas: snapshot.deltas,
    shiftLimit: snapshot.shiftLimit,
    narrative: snapshot.narrative,
    ...(completeSavingsBreakdown && { completeSavingsBreakdown }),
  };

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
    setShowSuggestions(false);
    setIsLoading(true);

    const streamingId = `streaming_${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: streamingId, text: '', isUser: false, timestamp: new Date() },
    ]);

    try {
      const meta = await sendChatMessageStreaming(
        {
          messages: [...messages, userMessage].map((m) => ({
            id: m.id,
            text: m.text,
            isUser: m.isUser,
            timestamp: m.timestamp,
          })),
          context: 'savings-helper',
          userPlanData: {
            ...currentPlanDataForChat,
            incomeAllocationLifecycle: contextPacket,
          },
        },
        {
          onChunk(text) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamingId ? { ...m, text: m.text + text } : m
              )
            );
          },
          onDone({ proposedPlannedSavings: proposedSavings }) {
            if (proposedSavings != null && onProposalFromChat) onProposalFromChat(proposedSavings);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamingId
                  ? {
                      ...m,
                      text: m.text.replace(/\n?PROPOSED_SAVINGS:\s*[\d.]+\s*$/im, '').trim(),
                    }
                  : m
              )
            );
          },
        }
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Something went wrong.';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamingId
            ? { ...m, text: `I couldn't complete that: ${errMsg}` }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (s: string) => {
    setChatInput(s);
    setShowSuggestions(false);
    textareaRef.current?.focus();
  };

  const latestInjectedMessage = uiMode === 'ADJUST_REVIEW' && adjustPlanMessage ? adjustPlanMessage : null;

  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardContent className="p-4 space-y-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Ribbit</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {CHAT_HELPER_TEXT}
        </p>
        <div ref={containerRef} className="space-y-4 max-h-[28rem] overflow-y-auto border-t border-slate-200 dark:border-slate-700 pt-3">
          {messages.length === 0 && !latestInjectedMessage && (
            <p className="text-xs text-slate-500 dark:text-slate-400 italic">
              Try: &quot;Why this number?&quot; or &quot;What if I want to save more?&quot;
            </p>
          )}
          {/* Tile first so "Ask a question" answers stream below it */}
          {latestInjectedMessage && (
            <div className="flex justify-start">
              <div className="w-full max-w-[90%] rounded-lg px-4 py-3 bg-slate-100 dark:bg-slate-800">
                <div className="space-y-3">
                  {latestInjectedMessage.blocks.map((block, idx) => {
                    if (block.type === 'text') return <p key={idx} className="text-sm text-slate-800 dark:text-slate-200">{block.value}</p>;
                    if (block.type === 'compare') {
                      return (
                        <div key={idx} className="text-sm space-y-1">
                          <div className="flex justify-between gap-4 whitespace-nowrap">
                            <span className="text-slate-600 dark:text-slate-400">{block.leftLabel}:</span>
                            <span className="font-medium">{block.leftValue}</span>
                          </div>
                          <div className="flex justify-between gap-4 whitespace-nowrap">
                            <span className="text-slate-600 dark:text-slate-400">{block.rightLabel}:</span>
                            <span className={`font-medium ${block.noChange ? 'text-slate-500' : 'text-green-600 dark:text-green-400'}`}>{block.rightValue}</span>
                          </div>
                        </div>
                      );
                    }
                    if (block.type === 'bullets') return <ul key={idx} className="text-sm list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300">{block.items.map((i, j) => <li key={j}>{i}</li>)}</ul>;
                    if (block.type === 'question') return <p key={idx} className="text-sm font-medium text-slate-800 dark:text-slate-200">{block.value}</p>;
                    if (block.type === 'actions') {
                      return (
                        <div key={idx} className="flex flex-wrap gap-2 pt-2">
                          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={onApply}>
                            Apply
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setShowSuggestions(true); onAskQuestion(); textareaRef.current?.focus(); }}>
                            Ask a question
                          </Button>
                          <Button size="sm" variant="ghost" onClick={onKeepPlan}>
                            Keep my plan
                          </Button>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.isUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2.5 ${
                  m.isUser ? 'bg-green-600 text-white text-sm' : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
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
          {showSuggestions && (
            <div className="flex flex-wrap gap-2">
              {SUGGESTION_CHIPS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSuggestionClick(s)}
                  className="rounded-full border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {isLoading && (() => {
            const last = messages[messages.length - 1];
            const showThinking = !last || last.isUser || last.text === '';
            return showThinking ? (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-2.5">
                  <ChatLoadingDots />
                </div>
              </div>
            ) : null;
          })()}
        </div>
        <div className="flex items-end gap-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 min-h-[4rem]">
          <textarea
            ref={textareaRef}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={CHAT_INPUT_PLACEHOLDER}
            rows={2}
            className="flex-1 min-h-[2.5rem] max-h-32 resize-y bg-transparent text-base outline-none placeholder:text-slate-500 py-1"
            disabled={isLoading}
          />
          <Button onClick={() => handleSend()} disabled={isLoading || !chatInput.trim()} size="sm">
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
