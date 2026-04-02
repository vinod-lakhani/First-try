"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Lightbulb, BarChart3, Rocket } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getPostConnectFlowData, type AllocationRow } from "@/lib/postPlaid/postConnectFlowData";
import { computeSavingsInsight } from "@/lib/postPlaid/savingsInsight";

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function StatusCell({ row }: { row: AllocationRow }) {
  if (row.status === "on-track") {
    return (
      <span className="text-slate-600 dark:text-slate-400">
        <span className="text-emerald-600 dark:text-emerald-400">✓</span> {row.statusLabel}
      </span>
    );
  }
  if (row.status === "above") {
    return (
      <span className="text-slate-600 dark:text-slate-400">
        <span className="text-slate-500 dark:text-slate-500">*</span> +{row.statusLabel}
      </span>
    );
  }
  return (
    <span className="text-slate-600 dark:text-slate-400">
      <span className="text-slate-500 dark:text-slate-500">−</span> {row.statusLabel}
    </span>
  );
}

type PostConnectThreeCardFlowProps = {
  annualIncomeGross?: number;
  onComplete: () => void;
};

export function PostConnectThreeCardFlow({ annualIncomeGross, onComplete }: PostConnectThreeCardFlowProps) {
  const data = useMemo(() => getPostConnectFlowData(annualIncomeGross), [annualIncomeGross]);
  const [step, setStep] = useState<0 | 1 | 2>(0);

  const leap = data.leap.options[0];
  const monthlyIncomeForInsight = data.momentOfTruth.actualDeposits;
  const savingsInsight = computeSavingsInsight(monthlyIncomeForInsight);
  const adjustPlanHref = savingsInsight
    ? `/app/adjust-plan?income=${monthlyIncomeForInsight}&targetSavings=${savingsInsight.recommendedSavings}&currentSavings=${savingsInsight.currentSavings}`
    : `/app/adjust-plan?income=${monthlyIncomeForInsight}`;

  const { momentOfTruth, verdict } = data;

  return (
    <div className="text-left">
      {step === 0 && (
        <div>
          <div className="mb-4 flex items-start gap-2">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-lg dark:bg-amber-900/40">
              <Lightbulb className="h-4 w-4 text-amber-800 dark:text-amber-200" aria-hidden />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Your real take-home looks different
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Now that your accounts are connected, we can see what actually lands in your bank.
              </p>
            </div>
          </div>

          <div className="mb-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-600 dark:bg-slate-800/50">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Estimated take-home</span>
              <span className="font-medium tabular-nums text-slate-900 dark:text-white">
                {formatMoney(momentOfTruth.estimatedTakeHome)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Actual deposits</span>
              <span className="font-medium tabular-nums text-slate-900 dark:text-white">
                {formatMoney(momentOfTruth.actualDeposits)}
              </span>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            The difference usually comes from taxes, benefits, or pre-tax savings. We&apos;ll refine this with you.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            From here, we&apos;ll base your plan on real cash flow — so it actually fits.
          </p>

          <button type="button" onClick={() => setStep(1)} className={buttonVariants({ size: "lg", className: "mt-6 w-full" })}>
            Continue
          </button>
        </div>
      )}

      {step === 1 && (
        <div>
          <div className="mb-4 flex items-start gap-2">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
              <BarChart3 className="h-4 w-4 text-slate-700 dark:text-slate-200" aria-hidden />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Here&apos;s how your plan holds up
              </h2>
            </div>
          </div>

          <div
            className="mb-4 rounded-xl border border-amber-200/80 bg-amber-50/60 px-4 py-3 dark:border-amber-800/50 dark:bg-amber-950/30"
            role="status"
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              {verdict.verdictIcon === "warning" ? (
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              ) : null}
              {verdict.verdictTitle}
            </p>
          </div>

          <div className="mb-4 space-y-2.5 text-sm">
            {verdict.rows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[minmax(0,4.5rem)_2.75rem_1fr] items-baseline gap-x-2 gap-y-1"
              >
                <span className="text-slate-600 dark:text-slate-400">{row.label}</span>
                <span className="tabular-nums text-slate-900 dark:text-white">{row.actualPct}%</span>
                <StatusCell row={row} />
              </div>
            ))}
          </div>

          <div className="my-4 border-t border-slate-200 dark:border-slate-600" />

          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{verdict.summary}</p>

          <button type="button" onClick={() => setStep(2)} className={buttonVariants({ size: "lg", className: "mt-6 w-full" })}>
            See how to fix this
          </button>
        </div>
      )}

      {step === 2 && leap && (
        <div>
          <div className="mb-4 flex items-start gap-2">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-lg">
              <Rocket className="h-4 w-4 text-primary" aria-hidden />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your next best move</h2>
              <p className="mt-2 text-base font-medium text-slate-800 dark:text-slate-200">{leap.shiftSummary}</p>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 dark:border-slate-600 dark:bg-slate-800/50">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Today</p>
              <p className="text-slate-700 dark:text-slate-300">Savings: {leap.today.savingsPct}%</p>
              <p className="text-slate-700 dark:text-slate-300">Wants: {leap.today.wantsPct}%</p>
            </div>
            <div className="rounded-xl border-2 border-primary/25 bg-primary/5 px-3 py-3 dark:border-primary/35 dark:bg-primary/10">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-primary">After this change</p>
              <p className="font-medium text-slate-900 dark:text-white">Savings: {leap.after.savingsPct}%</p>
              <p className="font-medium text-slate-900 dark:text-white">Wants: {leap.after.wantsPct}%</p>
            </div>
          </div>

          <p className="text-center text-sm font-medium text-slate-800 dark:text-slate-200">
            +{formatMoney(leap.yearlyImpactDollars)} more toward your future this year
          </p>

          <div className="mt-6 flex flex-col gap-2">
            <Link href={adjustPlanHref} onClick={onComplete} className={buttonVariants({ size: "lg", className: "w-full" })}>
              Apply this change
            </Link>
            <button
              type="button"
              onClick={onComplete}
              className="w-full rounded-full border-2 border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              Not now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
