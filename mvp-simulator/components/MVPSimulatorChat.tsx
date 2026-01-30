/**
 * MVP Simulator Chat
 *
 * Chat panel for the MVP Simulator. Sends context "mvp-simulator" and current
 * inputs + outputs so Ribbit can answer questions about how outputs were calculated.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Send } from 'lucide-react';
import { withBasePath } from '@/lib/utils/basePath';
import { sendChatMessage } from '@/lib/chat/chatService';
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface MVPSimulatorChatProps {
  userPlanData?: Record<string, unknown> | null;
  /** Controlled open state (when provided by parent for split layout) */
  isOpen?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  /** When true, render inline in bottom half of split (no fixed overlay) */
  embedded?: boolean;
}

export function MVPSimulatorChat({ userPlanData, isOpen: controlledOpen, onOpen, onClose, embedded }: MVPSimulatorChatProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = (open: boolean) => {
    if (controlledOpen !== undefined) {
      if (open) onOpen?.();
      else onClose?.();
    } else {
      setInternalOpen(open);
    }
  };
  const [imageSrc, setImageSrc] = useState('/images/ribbit.png');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Run a simulation first, then ask me how any output was calculated (e.g. savings, allocations, net worth).",
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setImageSrc(withBasePath('images/ribbit.png'));
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      inputRef.current?.focus();
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      isUser: true,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await sendChatMessage({
        messages: [...messages, userMessage].map((m) => ({
          id: m.id,
          text: m.text,
          isUser: m.isUser,
          timestamp: m.timestamp,
        })),
        context: 'mvp-simulator',
        userPlanData: userPlanData ?? undefined,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: response,
          isUser: false,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong.';
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: `Sorry, I couldn’t get a response: ${errorMessage}`,
          isUser: false,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 sm:left-[calc(50%+280px)] lg:left-[calc(50%+320px)] sm:right-auto">
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-3 rounded-full bg-green-600 py-3 pl-4 pr-5 shadow-lg ring-4 ring-white/20 hover:bg-green-700 hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 dark:ring-slate-800/50"
          aria-label="Open chat"
        >
          <img
            src={imageSrc}
            alt=""
            className="h-10 w-10 shrink-0 object-contain"
            loading="lazy"
            decoding="async"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (target) target.style.display = 'none';
            }}
          />
          <span className="text-sm font-medium text-white whitespace-nowrap">Click for Chat</span>
        </button>
      </div>
    );
  }

  const chatContent = (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <img src={imageSrc} alt="" className="h-8 w-8 object-contain" />
          <span className="font-semibold text-slate-900 dark:text-white">Ribbit – MVP Simulator</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.isUser ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                m.isUser
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-slate-100'
              }`}
            >
              {m.isUser ? (
                m.text
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{m.text}</ReactMarkdown></div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-500 dark:bg-slate-700">
              Thinking…
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="shrink-0 border-t border-slate-200 p-3 dark:border-slate-700">
        {!userPlanData && (
          <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">
            Run a simulation to send inputs & outputs to Ribbit for accurate answers.
          </p>
        )}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. How was savings allocation calculated?"
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            disabled={isLoading}
          />
          <Button onClick={handleSend} disabled={isLoading || !inputValue.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );

  if (embedded) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-none border-0 bg-white dark:bg-slate-800">
        {chatContent}
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col w-[380px] max-w-[calc(100vw-2rem)] h-[480px] rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800 sm:left-[calc(50%+280px)] lg:left-[calc(50%+320px)] sm:right-auto">
      {chatContent}
    </div>
  );
}
