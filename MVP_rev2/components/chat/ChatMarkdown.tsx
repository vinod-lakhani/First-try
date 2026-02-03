/**
 * Shared chat markdown renderer — matches FinancialSidekick format.
 * Fallback: only bold category titles (e.g. "Emergency Fund:", "High-APR Debt Payoff:"). Strip all **
 * so markdown never shows literally; amounts and body text stay plain.
 */

'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';

const NBSP = '\u00A0';
function preventLabelValueBreak(text: string): string {
  return text.replace(/:\s*\*\*([^*]+)\*\*/g, `:${NBSP}**$1**`);
}

function unwrapWholeCodeBlock(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return text;
  const firstLineEnd = trimmed.indexOf('\n');
  if (firstLineEnd === -1) return text;
  let afterFence = trimmed.slice(firstLineEnd + 1);
  const newlineClose = afterFence.indexOf('\n```');
  if (newlineClose !== -1) {
    afterFence = afterFence.slice(0, newlineClose);
  } else if (afterFence.endsWith('```')) {
    afterFence = afterFence.slice(0, -3);
  } else {
    return text;
  }
  return afterFence.trimEnd();
}

function unwrapInnerMarkdownCodeBlocks(text: string): string {
  return text.replace(/(^|\n)```(?:[a-z]*)\n([\s\S]*?)```(\n|$)/g, (_, before, inner, after) => {
    if (/\*\*/.test(inner)) return `${before}${inner}${after}`;
    return `${before}\`\`\`${inner}\`\`\`${after}`;
  });
}

function stripIndentedCodeBlockContainingBold(text: string): string {
  return text.replace(/^([ \t]{2,})(.*\*\*.*)$/gm, (_, _indent, rest) => rest);
}

function unwrapMarkdownCodeBlock(text: string): string {
  let out = unwrapWholeCodeBlock(text);
  out = unwrapInnerMarkdownCodeBlocks(out);
  out = stripIndentedCodeBlockContainingBold(out);
  return out;
}

// Normalize repeated or redundant labels so formatting is consistent.
function normalizeRedundantLabels(text: string): string {
  return text
    .replace(/Total Monthly Savings\s*-\s*Total Monthly Savings\s*:/gi, 'Total Monthly Savings:')
    .replace(/Monthly Allocations\s*-\s*Monthly Allocations\s*:/gi, 'Monthly Allocations:');
}

const strongClass = 'font-semibold text-slate-900 dark:text-slate-100';

/** Remove all ** so markdown never shows literally. */
function stripMarkdownBold(s: string): string {
  return s.replace(/\*\*/g, '');
}

/** List items: bold only the category title (e.g. "Emergency Fund:"). Strip ** everywhere so no literal **; rest is plain. */
function renderListItemContent(item: string): React.ReactNode {
  const labelMatch = item.match(/^([^:]+:)\s*([\s\S]*)$/);
  if (labelMatch) {
    const [, label, rest] = labelMatch;
    const labelClean = stripMarkdownBold(label.trim());
    const restTrimmed = rest.trim();
    if (restTrimmed.length > 0) {
      return (
        <>
          <strong className={strongClass}>{labelClean}</strong>
          {' '}
          {stripMarkdownBold(restTrimmed)}
        </>
      );
    }
    return <strong className={strongClass}>{labelClean}</strong>;
  }
  return stripMarkdownBold(item);
}

/** Renders one block (no \n\n split): headers use first line only; rest is rendered as content. */
function renderBlock(block: string, keyPrefix: string): React.ReactNode {
  const trimmed = block.trim();
  if (trimmed.startsWith('### ')) {
    const after = trimmed.slice(4);
    const firstLineEnd = after.indexOf('\n');
    const headerText = firstLineEnd === -1 ? after : after.slice(0, firstLineEnd);
    const rest = firstLineEnd === -1 ? '' : after.slice(firstLineEnd + 1).trim();
    return (
      <React.Fragment key={keyPrefix}>
        <h3 className="text-sm font-semibold mt-2 mb-1.5 first:mt-0 text-slate-900 dark:text-slate-100">
          {stripMarkdownBold(headerText)}
        </h3>
        {rest ? renderWithBoldFallback(rest) : null}
      </React.Fragment>
    );
  }
  if (trimmed.startsWith('## ')) {
    const after = trimmed.slice(3);
    const firstLineEnd = after.indexOf('\n');
    const headerText = firstLineEnd === -1 ? after : after.slice(0, firstLineEnd);
    const rest = firstLineEnd === -1 ? '' : after.slice(firstLineEnd + 1).trim();
    return (
      <React.Fragment key={keyPrefix}>
        <h2 className="text-base font-semibold mt-3 mb-2 first:mt-0 text-slate-900 dark:text-slate-100">
          {stripMarkdownBold(headerText)}
        </h2>
        {rest ? renderWithBoldFallback(rest) : null}
      </React.Fragment>
    );
  }
  return null;
}

/** Renders content: only category titles bold; strip all ** so markdown never shows. */
function renderWithBoldFallback(text: string): React.ReactNode {
  const paragraphs = text.trim().split(/\n\n+/);
  const pClass = 'mb-1.5 last:mb-0 text-slate-900 dark:text-slate-100 leading-relaxed';
  return (
    <>
      {paragraphs.map((para, pIdx) => {
        const trimmed = para.trim();
        if (trimmed.startsWith('### ')) {
          return <React.Fragment key={pIdx}>{renderBlock(trimmed, `block-${pIdx}`)}</React.Fragment>;
        }
        if (trimmed.startsWith('## ')) {
          return <React.Fragment key={pIdx}>{renderBlock(trimmed, `block-${pIdx}`)}</React.Fragment>;
        }
        const lines = trimmed.split(/\n/);
        const numberedItems = lines.filter((l) => /^\s*\d+\.\s+/.test(l));
        if (numberedItems.length >= 2) {
          const items = numberedItems.map((l) => l.replace(/^\s*\d+\.\s+/, ''));
          return (
            <ol key={pIdx} className="list-decimal list-inside my-2 space-y-2.5 ml-1 text-slate-900 dark:text-slate-100">
              {items.map((item, i) => (
                <li key={i} className="pl-1 leading-relaxed">
                  {renderListItemContent(item)}
                </li>
              ))}
            </ol>
          );
        }
        // Bullet list: - * or • (Unicode) so "• Proposed: ..." / "• Reason: ..." become list items with bold labels.
        const bulletItems = lines.filter((l) => /^\s*[-*]\s+/.test(l) || /^\s*[•]\s+/.test(l));
        if (bulletItems.length >= 2) {
          const items = bulletItems.map((l) => l.replace(/^\s*[-*•]\s+/, ''));
          return (
            <ul key={pIdx} className="list-disc list-inside my-2 space-y-2 ml-2 text-slate-900 dark:text-slate-100">
              {items.map((item, i) => (
                <li key={i} className="pl-1 leading-relaxed">
                  {renderListItemContent(item)}
                </li>
              ))}
            </ul>
          );
        }
        // Single-line "Label: content" → bold label only.
        const labelLineMatch = trimmed.match(/^([^:]+:)\s*([\s\S]*)$/);
        const useLabelStyle = labelLineMatch && labelLineMatch[2].trim().length > 0;
        // Multi-line block where each line is "Label: content" → bold each line's label (so Proposed:/Reason: all bold).
        const multiLineLabelLines = lines.filter((l) => /^[^:]+:\s*.+/.test(l.trim()));
        const useMultiLineLabels = lines.length >= 2 && multiLineLabelLines.length >= 2;
        return (
          <p key={pIdx} className={pClass}>
            {useLabelStyle && !useMultiLineLabels ? (
              <>
                <strong className={strongClass}>{stripMarkdownBold(labelLineMatch![1].trim())}</strong>
                {' '}
                {stripMarkdownBold(labelLineMatch![2].trim())}
              </>
            ) : useMultiLineLabels ? (
              lines.map((line, i) => {
                const t = line.trim();
                if (t.length === 0) return <br key={i} />;
                const m = t.match(/^([^:]+:)\s*(.*)$/);
                if (m) {
                  return (
                    <React.Fragment key={i}>
                      {i > 0 && <br />}
                      <strong className={strongClass}>{stripMarkdownBold(m[1])}</strong>
                      {' '}
                      {stripMarkdownBold(m[2])}
                    </React.Fragment>
                  );
                }
                return <React.Fragment key={i}>{i > 0 && <br />}{stripMarkdownBold(t)}</React.Fragment>;
              })
            ) : (
              para.split(/\n/).map((line, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <br />}
                  {stripMarkdownBold(line)}
                </React.Fragment>
              ))
            )}
          </p>
        );
      })}
    </>
  );
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
    <li className="ml-2 text-slate-900 dark:text-slate-100 [&>p]:inline [&>p]:m-0 [&>p]:leading-snug" {...props} />
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
  let processed: string = typeof children === 'string' ? children : '';
  if (typeof children === 'string') {
    processed = unwrapMarkdownCodeBlock(children);
    processed = preventLabelValueBreak(processed);
    processed = normalizeRedundantLabels(processed);
  }
  // If content contains **, use fallback renderer so bold always displays (avoids code-block/parser showing ** literally).
  const useBoldFallback = typeof processed === 'string' && processed.includes('**');
  return (
    <div className={`markdown-content ${size === 'base' ? 'text-base' : 'text-sm'}`}>
      {useBoldFallback ? (
        renderWithBoldFallback(processed)
      ) : (
        <ReactMarkdown components={markdownComponents}>{processed}</ReactMarkdown>
      )}
    </div>
  );
}
