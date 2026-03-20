"use client";

import { Info } from "lucide-react";

type FeedSectionProps = {
  title: string;
  icon: React.ReactNode;
  showMoreLabel?: string;
  onShowMore?: () => void;
  infoAriaLabel?: string;
  children: React.ReactNode;
};

export function FeedSection({
  title,
  icon,
  showMoreLabel,
  onShowMore,
  infoAriaLabel = "More info",
  children,
}: FeedSectionProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/30 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 flex items-center">
            {icon}
          </span>
          <h2 className="font-semibold text-slate-900 dark:text-white truncate">
            {title}
          </h2>
          <button
            type="button"
            className="shrink-0 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            aria-label={infoAriaLabel}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>
        {showMoreLabel && onShowMore && (
          <button
            type="button"
            onClick={onShowMore}
            className="shrink-0 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
          >
            {showMoreLabel}
          </button>
        )}
      </div>
      <div className="p-4">
        {children}
      </div>
    </section>
  );
}
