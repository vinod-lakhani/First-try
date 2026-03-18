/**
 * Savings Allocation Page
 *
 * Shown after user completes their full plan. Priority-based allocation:
 * "Where should your next dollar go?" — order > percentages.
 */

"use client";

import { Suspense, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Minus, Plus, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RibbitIcon } from "@/components/onboarding/RibbitIcon";
import { RibbitChat } from "@/components/onboarding/RibbitChat";
import type { SavingsAllocationScreenContext, PriorityBucket } from "@/lib/ribbit/types";
import {
  computeSavingsStackAllocation,
  getSuggestedDebtPayoff,
  type BucketId,
} from "@/lib/savingsStack/allocation";
import { getSavingsStackRecommendations } from "@/lib/savingsStack/recommendations";

const STEP = 50;

function formatMoney(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const DEFAULT_BUCKETS: { id: BucketId; label: string; layer: PriorityBucket["layer"]; status?: PriorityBucket["status"] }[] = [
  { id: "401k", label: "Employer 401k match", layer: "pre-tax", status: "complete" },
  { id: "hsa", label: "HSA", layer: "pre-tax", status: "complete" },
  { id: "ef", label: "Emergency fund", layer: "protection", status: "attention" },
  { id: "debt", label: "High-interest debt", layer: "protection", status: "attention" },
  { id: "roth", label: "Roth IRA", layer: "wealth", status: "growth" },
  { id: "brokerage", label: "Brokerage", layer: "wealth", status: "growth" },
  { id: "shortterm", label: "Short-term goals", layer: "flex" },
];

function getDefaultAllocation(
  monthlySavings: number,
  opts?: { monthlyInterest?: number; suggestedDebtPayoff?: number }
): Record<BucketId, number> {
  const suggestedDebtPayoff =
    opts?.suggestedDebtPayoff ?? (opts?.monthlyInterest && opts.monthlyInterest > 0 ? getSuggestedDebtPayoff(monthlySavings) : 0);
  return computeSavingsStackAllocation({
    monthlySavings,
    monthlyInterest: opts?.monthlyInterest ?? 0,
    suggestedDebtPayoff: suggestedDebtPayoff > 0 ? suggestedDebtPayoff : undefined,
  });
}

const SAVINGS_ALLOCATION_CHIPS = [
  { label: "Why is this the order?", question: "Why is this the order?" },
  { label: "Should I pay off debt first?", question: "Should I pay off debt first?" },
  { label: "Do I need an emergency fund first?", question: "Do I need an emergency fund first?" },
  { label: "Can I invest more instead?", question: "Can I invest more instead?" },
];

function SavingsAllocationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const savingsParam = searchParams.get("savings");
  const monthlySavings = savingsParam ? parseFloat(savingsParam) || 1362 : 1362;
  const monthlyInterestParam = searchParams.get("monthlyInterest");
  const suggestedDebtPayoffParam = searchParams.get("suggestedDebtPayoff");
  const payroll401kParam = searchParams.get("payroll401k");
  const payrollHsaParam = searchParams.get("payrollHsa");
  const monthlyInterest = monthlyInterestParam ? parseFloat(monthlyInterestParam) || 0 : 0;
  const suggestedDebtPayoff = suggestedDebtPayoffParam ? parseFloat(suggestedDebtPayoffParam) || 0 : 0;
  const payroll401k = payroll401kParam ? parseFloat(payroll401kParam) || 0 : 0;
  const payrollHsa = payrollHsaParam ? parseFloat(payrollHsaParam) || 0 : 0;
  const fromDebts = searchParams.get("fromDebts") === "1";
  const fromPayroll = searchParams.get("fromPayroll") === "1";
  const has401k = searchParams.get("has401k") === "1";
  const hasHsa = searchParams.get("hasHsa") === "1";
  const matchPct = searchParams.get("matchPct") ? parseFloat(searchParams.get("matchPct")!) || 0 : 0;
  const matchUpToPct = searchParams.get("matchUpToPct") ? parseFloat(searchParams.get("matchUpToPct")!) || 0 : 0;
  const annualIncomeParam = searchParams.get("annualIncome");
  const annualIncome = annualIncomeParam ? parseFloat(annualIncomeParam) || 96_000 : 96_000;
  const employee401k = searchParams.get("employee401k") ? parseFloat(searchParams.get("employee401k")!) || 0 : 0;

  const allocatableBuckets: BucketId[] = ["ef", "debt", "roth", "brokerage", "shortterm"];

  const recommendations = useMemo(
    () =>
      getSavingsStackRecommendations({
        monthlySavings,
        annualIncome,
        has401k,
        hasHsa,
        payroll401k,
        payrollHsa,
        employee401k,
        matchPct,
        matchUpToPct,
        hasHighAprDebt: fromDebts && (monthlyInterest > 0 || suggestedDebtPayoff > 0),
        fromPayroll,
        savings: String(monthlySavings),
        projected: searchParams.get("projected") ?? "2000000",
      }),
    [
      monthlySavings,
      annualIncome,
      has401k,
      hasHsa,
      payroll401k,
      payrollHsa,
      employee401k,
      matchPct,
      matchUpToPct,
      fromDebts,
      monthlyInterest,
      suggestedDebtPayoff,
      fromPayroll,
      searchParams,
    ]
  );

  const [allocations, setAllocations] = useState<Record<BucketId, number>>(() => {
    const base = getDefaultAllocation(monthlySavings, {
      monthlyInterest: monthlyInterest > 0 ? monthlyInterest : undefined,
      suggestedDebtPayoff: suggestedDebtPayoff > 0 ? suggestedDebtPayoff : undefined,
    });
    if (fromPayroll) {
      return { ...base, "401k": payroll401k, hsa: payrollHsa };
    }
    return base;
  });

  const totalAllocated = useMemo(
    () => allocatableBuckets.reduce((a, id) => a + allocations[id], 0),
    [allocations]
  );
  const remainder = monthlySavings - totalAllocated;

  const isReadOnlyBucket = (id: BucketId) => fromPayroll && (id === "401k" || id === "hsa");

  const adjustBucket = useCallback(
    (id: BucketId, delta: number) => {
      if (isReadOnlyBucket(id)) return;
      setAllocations((prev) => {
        const next = { ...prev };
        const newVal = Math.max(0, prev[id] + delta);
        const otherSum = allocatableBuckets
          .filter((k) => k !== id)
          .reduce((a, k) => a + prev[k], 0);
        const maxVal = Math.max(0, monthlySavings - otherSum);
        next[id] = Math.min(newVal, maxVal);
        return next;
      });
    },
    [monthlySavings]
  );

  const [ribbitOpen, setRibbitOpen] = useState(false);
  const [ribbitInitialQuestion, setRibbitInitialQuestion] = useState<string | null>(null);

  const bucketsForDisplay = useMemo(() => {
    const captureMatchRec = recommendations.find((r) => r.id === "capture-401k-match");
    const maxHsaRec = recommendations.find((r) => r.id === "max-hsa");
    return DEFAULT_BUCKETS.map((b) => {
      const id = b.id as BucketId;
      const label =
        fromPayroll && (id === "401k" || id === "hsa")
          ? id === "401k"
            ? "401k (from payroll)"
            : "HSA (from payroll)"
          : b.label;
      let status = b.status;
      if (id === "401k" && captureMatchRec) status = "attention";
      if (id === "hsa" && maxHsaRec) status = "attention";
      return { ...b, label, amount: allocations[id], status };
    });
  }, [allocations, fromPayroll, recommendations]);

  const ribbitScreenContext: SavingsAllocationScreenContext = useMemo(
    () => ({
      screen: "savings-allocation",
      onboardingStage: "plan",
      hasLinkedAccounts: false,
      source: "estimated_from_income",
      monthlySavings,
      buckets: bucketsForDisplay.map((b) => ({
        id: b.id,
        label: b.label,
        amount: b.amount,
        layer: b.layer,
        status: b.status,
      })),
      hasDebt: allocations.debt > 0,
      has401k: true,
      efFunded: false,
    }),
    [monthlySavings, bucketsForDisplay, allocations.debt]
  );

  const returnTo = searchParams.get("returnTo");

  const handleComplete = () => {
    const projectedParam = searchParams.get("projected") ?? "0";
    const q = new URLSearchParams({
      savings: String(monthlySavings),
      projected: projectedParam,
      savingsAllocation: "1",
    });
    if (fromDebts) q.set("debts", "1");
    if (fromPayroll) q.set("payroll", "1");
    if (fromDebts || fromPayroll) q.set("skipInsight", "1");
    if (returnTo === "income") {
      router.replace(`/app/income?${q.toString()}`);
    } else {
      router.replace(`/app?${q.toString()}`);
    }
  };

  const statusIcon = (status?: PriorityBucket["status"]) => {
    if (status === "complete") return "✅";
    if (status === "attention") return "⚠️";
    if (status === "growth") return "💡";
    return "";
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8">
      <Link
        href={
          returnTo === "income"
            ? `/app/income?savings=${monthlySavings}&projected=${searchParams.get("projected") ?? "0"}`
            : `/app?savings=${monthlySavings}&projected=${searchParams.get("projected") ?? "0"}`
        }
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        {returnTo === "income" ? "Back to income" : "Back to home"}
      </Link>

      {/* Header */}
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
        Optimize your savings plan
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
        Based on your accounts, here&apos;s how your savings should flow
      </p>

      {/* Ribbit summary */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50 p-4">
        <p className="text-sm text-slate-700 dark:text-slate-300">
          <RibbitIcon size="sm" className="mr-1.5 align-middle" />
          <strong>Ribbit:</strong> You&apos;re currently saving {formatMoney(monthlySavings)}/month. I&apos;ve
          applied the savings stack: EF → 401k match → HSA → debt → retirement → brokerage.
          {fromDebts && allocations.debt > 0 && (
            <> We&apos;ve suggested <strong>{formatMoney(allocations.debt)}/month</strong> toward debt payoff to reduce your interest cost faster.</>
          )}
          {fromPayroll && (payroll401k > 0 || payrollHsa > 0) && (
            <> Your 401k and HSA amounts are already set through payroll. Allocate your <strong>{formatMoney(monthlySavings)}/month</strong> post-tax savings below.</>
          )}
        </p>
      </div>

      {/* Savings Stack Recommendations */}
      {recommendations.length > 0 && (
        <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 dark:border-primary/30 dark:bg-primary/10 p-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
            Savings stack recommendations
          </h2>
          <ul className="space-y-3">
            {recommendations.map((rec) => (
              <li key={rec.id} className="flex flex-col gap-1">
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{rec.title}</span>
                <span className="text-xs text-slate-600 dark:text-slate-400">{rec.message}</span>
                {rec.actionHref && (
                  <Link
                    href={rec.actionHref}
                    className="text-xs font-medium text-primary hover:underline mt-0.5"
                  >
                    {rec.actionLabel}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {SAVINGS_ALLOCATION_CHIPS.map((chip) => (
          <button
            key={chip.question}
            type="button"
            onClick={() => {
              setRibbitInitialQuestion(chip.question);
              setRibbitOpen(true);
            }}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Priority stack */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">
          Your priority stack
        </p>
        <div className="space-y-4">
          {bucketsForDisplay.map((bucket, idx) => {
            const readOnly = isReadOnlyBucket(bucket.id as BucketId);
            return (
              <div
                key={bucket.id}
                className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 dark:border-slate-700 last:border-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400 w-5">
                    {idx + 1}.
                  </span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {bucket.label}
                  </span>
                  {readOnly && bucket.amount > 0 && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">(from payroll)</span>
                  )}
                  {statusIcon(bucket.status) && (
                    <span className="text-base" aria-hidden>
                      {statusIcon(bucket.status)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {readOnly ? (
                    <span className="w-16 text-right text-sm font-semibold text-slate-900 dark:text-white">
                      {formatMoney(bucket.amount)}
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => adjustBucket(bucket.id as BucketId, -STEP)}
                        className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
                        aria-label={`Decrease ${bucket.label}`}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-16 text-right text-sm font-semibold text-slate-900 dark:text-white">
                        {formatMoney(bucket.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => adjustBucket(bucket.id as BucketId, STEP)}
                        className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
                        aria-label={`Increase ${bucket.label}`}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {Math.abs(remainder) > 1 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">
            {remainder > 0
              ? `${formatMoney(remainder)} unallocated — add to a bucket above`
              : `${formatMoney(Math.abs(remainder))} over — reduce a bucket above`}
          </p>
        )}
      </div>

      <Button onClick={handleComplete} size="lg" className="w-full">
        {returnTo === "income" ? "Done — take me to income →" : "Done — take me to my plan →"}
      </Button>

      <RibbitChat
        screenContext={ribbitScreenContext}
        chips={SAVINGS_ALLOCATION_CHIPS}
        open={ribbitOpen}
        onOpenChange={setRibbitOpen}
        initialQuestion={ribbitInitialQuestion}
        onInitialQuestionSent={() => setRibbitInitialQuestion(null)}
      />
    </div>
  );
}

export default function SavingsAllocationPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading...</div>}>
      <SavingsAllocationContent />
    </Suspense>
  );
}
