/**
 * Shared chat markdown renderer — matches FinancialSidekick format.
 * Use in SavingsChatPanel, IncomePlanChatCard, and other embedded chats for consistent formatting.
 * Uses non-breaking space before bold values so "Label: $X" doesn't wrap between label and number.
 */

'use client';

import ReactMarkdown from 'react-markdown';

// Keep label and value on same line: "Label: **$8,680**" or "Needs: **$2,868**" → insert nbsp before bold value
const NBSP = '\u00A0';
function preventLabelValueBreak(text: string): string {
  return text.replace(/:\s*\*\*([^*]+)\*\*/g, `:${NBSP}**$1**`);
}

const markdownComponents = {
  h2: ({ ...props }: React.ComponentPropsWithoutRef<'h2'>) => (
    <h2 className="text-base font-semibold mt-3 mb-2 first:mt-0 text-slate-900 dark:text-slate-100" {...props} />
  ),
  h3: ({ ...props }: React.ComponentPropsWithoutRef<'h3'>) => (
    <h3 className="text-sm font-semibold mt-2 mb-1.5 first:mt-0 text-slate-900 dark:text-slate-100" {...props} />
  ),
  p: ({ ...props }: React.ComponentPropsWithoutRef<'p'>) => (
    <p className="mb-1.5 last:mb-0 text-slate-900 dark:text-slate-100 leading-relaxed" {...props} />
  ),
  ul: ({ ...props }: React.ComponentPropsWithoutRef<'ul'>) => (
    <ul className="list-disc list-inside my-1.5 space-y-0.5 ml-2 text-slate-900 dark:text-slate-100" {...props} />
  ),
  ol: ({ ...props }: React.ComponentPropsWithoutRef<'ol'>) => (
    <ol className="list-decimal list-inside my-1.5 space-y-0.5 ml-2 text-slate-900 dark:text-slate-100" {...props} />
  ),
  li: ({ ...props }: React.ComponentPropsWithoutRef<'li'>) => (
    <li className="ml-2 text-slate-900 dark:text-slate-100" {...props} />
  ),
  strong: ({ ...props }: React.ComponentPropsWithoutRef<'strong'>) => (
    <strong className="font-semibold text-slate-900 dark:text-slate-100" {...props} />
  ),
  table: ({ ...props }: React.ComponentPropsWithoutRef<'table'>) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full border-collapse text-xs" {...props} />
    </div>
  ),
  thead: ({ ...props }: React.ComponentPropsWithoutRef<'thead'>) => (
    <thead className="border-b border-slate-300 dark:border-slate-600" {...props} />
  ),
  tbody: ({ ...props }: React.ComponentPropsWithoutRef<'tbody'>) => <tbody {...props} />,
  tr: ({ ...props }: React.ComponentPropsWithoutRef<'tr'>) => (
    <tr className="border-b border-slate-300 dark:border-slate-600" {...props} />
  ),
  th: ({ ...props }: React.ComponentPropsWithoutRef<'th'>) => (
    <th className="px-2 py-1 text-left font-semibold text-slate-900 dark:text-slate-100" {...props} />
  ),
  td: ({ ...props }: React.ComponentPropsWithoutRef<'td'>) => (
    <td className="px-2 py-1 text-slate-900 dark:text-slate-100" {...props} />
  ),
};

export interface ChatMarkdownProps {
  children: string;
  /** Optional size: 'sm' (sidekick default) or 'base' */
  size?: 'sm' | 'base';
}

export function ChatMarkdown({ children, size = 'sm' }: ChatMarkdownProps) {
  const processed = typeof children === 'string' ? preventLabelValueBreak(children) : children;
  return (
    <div className={`markdown-content ${size === 'base' ? 'text-base' : 'text-sm'}`}>
      <ReactMarkdown components={markdownComponents}>{processed}</ReactMarkdown>
    </div>
  );
}
