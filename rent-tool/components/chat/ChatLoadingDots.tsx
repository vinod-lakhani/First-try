/**
 * Shared loading indicator for chat — matches FinancialSidekick.
 * Animated bouncing dots shown while the assistant is "thinking".
 */

'use client';

interface ChatLoadingDotsProps {
  /** Optional additional wrapper classes (e.g. for bubble styling) */
  className?: string;
}

export function ChatLoadingDots({ className = '' }: ChatLoadingDotsProps) {
  return (
    <div
      className={`flex space-x-1 ${className}`.trim()}
      aria-label="Thinking"
    >
      <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
      <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
      <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
    </div>
  );
}
