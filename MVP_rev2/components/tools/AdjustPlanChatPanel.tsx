/**
 * Embedded "Ribbit — Adjustments" chat inside Adjust Plan Details.
 * Context-aware of manual edits; supports intent commands; never fabricates numbers.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { sendChatMessageStreaming } from '@/lib/chat/chatService';
import { CHAT_HELPER_TEXT } from '@/lib/chat/chatPrompts';
import {
  parseSavingsAllocationIntent,
  intentToDelta,
  type SavingsAllocationIntentContext,
} from '@/lib/chat/savingsAllocationIntent';

export interface AdjustPlanChatContext {
  currentPlanSummary: Record<string, number>;
  proposedPlanSummary: Record<string, number>;
  changedRows: Array<{ label: string; current: number; proposed: number }>;
  postTaxPool: number;
  cashLeft: number;
  matchCaptured: boolean;
  matchGapMonthly: number;
  matchLostIfLowered?: number;
  uiMessages: Array<{ type: string; text: string }>;
  lastEditedKey: string | null;
}

export interface AdjustPlanChatPanelProps {
  context: AdjustPlanChatContext;
  onReset: () => void;
  onApplyEdit: (edit: { type: 'ef' | 'debt' | 'retirementExtra' | 'brokerage' | '401k' | 'hsa'; delta: number }) => void;
}

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

const QUICK_PROMPTS = [
  'Why is match important?',
  'What happens if I lower emergency fund?',
  'Reset to recommended',
];

/** Build intent context from AdjustPlanChatPanel context (currentPlanSummary keys: ef$, debt$, etc.). */
function buildIntentContext(summary: Record<string, number>): SavingsAllocationIntentContext {
  return {
    preTax401k$: summary.preTax401k$ ?? summary['401k'] ?? 0,
    hsa$: summary.hsa$ ?? 0,
    ef$: summary.ef$ ?? 0,
    debt$: summary.debt$ ?? 0,
    retirementExtra$: summary.retirementTaxAdv$ ?? summary.retirementExtra$ ?? 0,
    brokerage$: summary.brokerage$ ?? 0,
  };
}

/** Parse user message via shared intent module; returns adjust-panel edit or reset. */
function parseIntent(
  text: string,
  currentPlanSummary: Record<string, number>
): { action: 'reset' } | { action: 'edit'; type: 'ef' | 'debt' | 'retirementExtra' | 'brokerage' | '401k' | 'hsa'; delta: number } | null {
  const context = buildIntentContext(currentPlanSummary);
  const intent = parseSavingsAllocationIntent(text, context);
  if (!intent) return null;

  if (intent.kind === 'reset') return { action: 'reset' };

  const deltaResult = intentToDelta(intent, context);
  if (!deltaResult) return null;
  return {
    action: 'edit',
    type: deltaResult.category,
    delta: deltaResult.delta,
  };
}

export function AdjustPlanChatPanel({ context, onReset, onApplyEdit }: AdjustPlanChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const streamingTextRef = useRef('');
  const streamingMessageIdRef = useRef<string | null>(null);
  const [streamingTick, setStreamingTick] = useState(0);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages, streamingTick]);

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? chatInput).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), text, isUser: true, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    if (!overrideText) setChatInput('');
    setIsLoading(true);

    const intent = parseIntent(text, context.currentPlanSummary);
    if (intent) {
      if (intent.action === 'reset') {
        onReset();
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: "Done — reset to the recommended plan.", isUser: false, timestamp: new Date() }]);
        setIsLoading(false);
        return;
      }
      if (intent.action === 'edit') {
        onApplyEdit({ type: intent.type, delta: intent.delta });
      }
    }

    const streamingId = (Date.now() + 1).toString();
    streamingTextRef.current = '';
    streamingMessageIdRef.current = streamingId;
    setMessages(prev => [...prev, { id: streamingId, text: '', isUser: false, timestamp: new Date() }]);

    try {
      const contextPacket = JSON.stringify({
        currentPlan: context.currentPlanSummary,
        proposedPlan: context.proposedPlanSummary,
        changedRows: context.changedRows,
        postTaxPool: context.postTaxPool,
        cashLeft: context.cashLeft,
        matchCaptured: context.matchCaptured,
        matchGapMonthly: context.matchGapMonthly,
        matchLostIfLowered: context.matchLostIfLowered,
        warnings: context.uiMessages.map(m => m.text),
        lastEditedKey: context.lastEditedKey,
      }, null, 2);

      await sendChatMessageStreaming(
        {
          messages: [...messages, userMsg].map(m => ({ id: m.id, text: m.text, isUser: m.isUser, timestamp: m.timestamp })),
          context: 'savings-adjustments',
          userPlanData: {
            adjustmentsContext: contextPacket,
            ...context,
          },
        },
        {
          onChunk(text) {
            streamingTextRef.current += text;
            setStreamingTick((t) => t + 1);
          },
        }
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Something went wrong.';
      setMessages(prev =>
        prev.map(m => (m.id === streamingId ? { ...m, text: `I couldn't complete that: ${errMsg}` } : m))
      );
    } finally {
      setMessages(prev =>
        prev.map(m => (m.id === streamingId ? { ...m, text: streamingTextRef.current } : m))
      );
      streamingMessageIdRef.current = null;
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Ribbit — Adjustments</h4>
      <p className="text-xs text-slate-600 dark:text-slate-400">{CHAT_HELPER_TEXT}</p>

      <div className="flex flex-wrap gap-1.5">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => handleSend(prompt)}
            disabled={isLoading}
            className="rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div ref={threadRef} className="space-y-2 max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-slate-50 dark:bg-slate-800/50">
        {messages.map((m) => {
          const isStreamingThis = m.id === streamingMessageIdRef.current && isLoading;
          const displayText = isStreamingThis ? streamingTextRef.current : (m.text ?? '');
          return (
          <div key={m.id} className={`flex ${m.isUser ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-lg px-2.5 py-1.5 text-xs ${m.isUser ? 'bg-green-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-600'}`}>
              {m.isUser ? <p className="whitespace-pre-wrap">{m.text}</p> : <div className="prose prose-xs dark:prose-invert max-w-none"><ReactMarkdown>{displayText}</ReactMarkdown></div>}
            </div>
          </div>
          );
        })}
        {isLoading && <div className="text-xs text-slate-500">Thinking…</div>}
      </div>

      <div className="flex gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5">
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
          placeholder="Ask or e.g. decrease EF by $200…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500"
          disabled={isLoading}
        />
        <button type="button" onClick={() => handleSend()} disabled={!chatInput.trim() || isLoading} className="shrink-0 rounded-full bg-green-600 p-1.5 text-white hover:bg-green-700 disabled:opacity-50">
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
