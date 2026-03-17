/**
 * RibbitChat - Floating help button + bottom sheet chat
 *
 * Global behavior (all screens):
 * - Floating "Need help?" button bottom-right
 * - Opens as bottom sheet (60-70% height), background visible
 * - Default message when opened (no empty state)
 * - Chips for quick questions, optional text input for follow-up
 */

"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import Link from "next/link";
import { X, Send } from "lucide-react";
import Image from "next/image";
import type { RibbitScreenContext } from "@/lib/ribbit/types";

const DEFAULT_MESSAGE =
  "Hey — I can explain anything on this screen or help you adjust it.";

const markdownComponents: Parameters<typeof ReactMarkdown>[0]["components"] = {
  p: ({ children, ...props }) => (
    <p className="mb-2 last:mb-0 leading-relaxed" {...props}>
      {children}
    </p>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-semibold" {...props}>
      {children}
    </strong>
  ),
  ul: ({ children, ...props }) => (
    <ul className="my-2 pl-5 list-disc space-y-1" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="my-2 pl-5 list-decimal space-y-1" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="leading-relaxed" {...props}>
      {children}
    </li>
  ),
  a: ({ href, children }) => {
    if (href?.startsWith("/")) {
      return (
        <Link href={href} className="font-medium text-primary underline hover:text-primary/90">
          {children}
        </Link>
      );
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline hover:text-primary/90">
        {children}
      </a>
    );
  },
};

function ChatMarkdown({ text }: { text: string }) {
  return (
    <div className="text-sm">
      <ReactMarkdown components={markdownComponents}>{text}</ReactMarkdown>
    </div>
  );
}

export type RibbitMessage = {
  text: string;
  isUser: boolean;
};

export type RibbitChatProps = {
  /** Screen context with computed numbers - passed to API for contextual answers */
  screenContext: RibbitScreenContext;
  /** Quick question chips (label shown, question sent to API) - shown in sheet */
  chips?: { label: string; question: string }[];
  /** Controlled open state (for contextual hooks that open the chat) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** When opening with a question from a page chip, send this immediately */
  initialQuestion?: string | null;
  onInitialQuestionSent?: () => void;
};

export function RibbitChat({
  screenContext,
  chips = [],
  open: controlledOpen,
  onOpenChange,
  initialQuestion,
  onInitialQuestionSent,
}: RibbitChatProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined && onOpenChange;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange : setInternalOpen;
  const [messages, setMessages] = useState<RibbitMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSentQuestionRef = useRef<string | null>(null);

  // When sheet opens, show default message if no messages yet (skip when opening with a chip question)
  useEffect(() => {
    if (open && messages.length === 0 && !initialQuestion?.trim()) {
      setMessages([{ text: DEFAULT_MESSAGE, isUser: false }]);
    }
  }, [open, messages.length, initialQuestion]);

  // Reset when chat closes
  useEffect(() => {
    if (!open) {
      lastSentQuestionRef.current = null;
    }
  }, [open]);

  // When opening with initialQuestion (from page chip), send it immediately to the LLM
  useEffect(() => {
    const question = initialQuestion?.trim();
    if (!open || !question) return;
    if (lastSentQuestionRef.current === question) return; // Already sent this exact question
    lastSentQuestionRef.current = question;
    onInitialQuestionSent?.();
    // Send to API with screen context for contextual LLM response
    const sendInitialQuestion = async () => {
      setMessages([{ text: question, isUser: true }]);
      setLoading(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ text: question, isUser: true }],
            screenContext,
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        const reply = data.response ?? "I couldn't generate a response.";
        setMessages((prev) => [...prev, { text: reply, isUser: false }]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          { text: "Something went wrong. Please try again.", isUser: false },
        ]);
      } finally {
        setLoading(false);
      }
    };
    sendInitialQuestion();
  }, [open, initialQuestion, screenContext, onInitialQuestionSent]);

  // Focus input when sheet opens
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: RibbitMessage = { text: text.trim(), isUser: true };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const apiMessages = [...messages, userMsg];
      if (apiMessages.length === 1 && !apiMessages[0].isUser) {
        apiMessages.unshift({ text: DEFAULT_MESSAGE, isUser: false });
      }
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages.map((m) => ({ text: m.text, isUser: m.isUser })),
          screenContext,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const reply = data.response ?? "I couldn't generate a response.";
      setMessages((prev) => [...prev, { text: reply, isUser: false }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          text: "Something went wrong. Please try again.",
          isUser: false,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleChipClick = (question: string) => {
    sendMessage(question);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <>
      {/* Floating button - bottom-right of content tiles (not screen edge), stays visible when scrolling */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 z-[100] flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
          style={{ right: "max(1rem, calc(50vw - 16rem + 1rem))" }}
          aria-label="Need help? Ask Ribbit"
        >
          <Image src="/images/ribbit.png" alt="" width={20} height={20} className="shrink-0" aria-hidden />
          <span>Need help?</span>
        </button>
      )}

      {/* Bottom sheet overlay + panel - same width as content tiles */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-[110] bg-black/30 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            className="fixed inset-x-0 bottom-0 z-[110] flex h-[70dvh] min-h-[280px] max-h-[85dvh] flex-col rounded-t-2xl border border-b-0 border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:left-1/2 sm:right-auto sm:w-full sm:max-w-lg sm:-translate-x-1/2"
            role="dialog"
            aria-label="Ribbit chat"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Image src="/images/ribbit.png" alt="" width={24} height={24} className="shrink-0" aria-hidden />
                <span className="font-semibold text-slate-900 dark:text-white">
                  Ribbit
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Messages - min-h-0 needed for flex overflow on mobile */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-4">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${m.isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                        m.isUser
                          ? "bg-primary text-primary-foreground"
                          : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                      }`}
                    >
                      {m.isUser ? (
                        <p className="text-sm whitespace-pre-wrap">{m.text}</p>
                      ) : (
                        <ChatMarkdown text={m.text} />
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl bg-slate-100 px-4 py-2.5 dark:bg-slate-800">
                      <span className="text-sm text-slate-500">Thinking...</span>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </div>

            {/* Chips (when no user messages yet, or always show for quick access) */}
            {chips.length > 0 && (
              <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-700">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                  Quick questions
                </p>
                <div className="flex flex-wrap gap-2">
                  {chips.map((chip) => (
                    <button
                      key={chip.question}
                      type="button"
                      onClick={() => handleChipClick(chip.question)}
                      disabled={loading}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 disabled:opacity-50"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Text input - pb-safe for mobile home indicator */}
            <form
              onSubmit={handleSubmit}
              className="border-t border-slate-200 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-slate-700"
            >
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message..."
                  disabled={loading}
                  className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </>
  );
}
