"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { SavingsInsightResult } from "@/lib/postPlaid/savingsInsight";

function formatMoney(n: number, compact = false) {
  if (compact && n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (compact && n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

type SavingsAdjustmentInsightProps = {
  insight: SavingsInsightResult;
  adjustPlanHref: string;
};

export function SavingsAdjustmentInsight({ insight, adjustPlanHref }: SavingsAdjustmentInsightProps) {
  return (
    <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5 dark:border-primary/30 dark:bg-primary/10">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
        Boost your savings potential
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
        Based on your last 3 months of spending
      </p>

      {/* Current vs Recommended */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-800">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Current</p>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            {formatMoney(insight.currentSavings)}/mo
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {insight.currentRatePct}% savings rate
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
            → {formatMoney(insight.currentNetWorth30Y, true)} in 30 years
          </p>
        </div>
        <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3 dark:border-primary/40 dark:bg-primary/10">
          <p className="text-xs font-medium text-primary mb-1">Recommended</p>
          <p className="text-lg font-semibold text-primary">
            {formatMoney(insight.recommendedSavings)}/mo
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {insight.recommendedRatePct}% savings rate (+{insight.rateIncreasePct}%)
          </p>
          <p className="text-xs font-medium text-primary mt-1">
            → {formatMoney(insight.recommendedNetWorth30Y, true)} in 30 years
          </p>
        </div>
      </div>

      {/* Improvement highlight */}
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">
        +{formatMoney(insight.recommendedNetWorth30Y - insight.currentNetWorth30Y, true)} more in 30 years
        {insight.improvementPct > 0 && (
          <span className="text-primary ml-1">({insight.improvementPct}% improvement)</span>
        )}
      </p>

      <Link href={adjustPlanHref} className={buttonVariants({ size: "lg", className: "w-full" })}>
        Update your plan
      </Link>
    </div>
  );
}
