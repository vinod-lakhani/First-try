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

const STEP = 50;

function formatMoney(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

type BucketId = "401k" | "hsa" | "ef" | "debt" | "roth" | "brokerage" | "shortterm";

const DEFAULT_BUCKETS: { id: BucketId; label: string; layer: PriorityBucket["layer"]; status?: PriorityBucket["status"] }[] = [
  { id: "401k", label: "Employer 401k match", layer: "pre-tax", status: "complete" },
  { id: "hsa", label: "HSA", layer: "pre-tax", status: "complete" },
  { id: "ef", label: "Emergency fund", layer: "protection", status: "attention" },
  { id: "debt", label: "High-interest debt", layer: "protection", status: "attention" },
  { id: "roth", label: "Roth IRA", layer: "wealth", status: "growth" },
  { id: "brokerage", label: "Brokerage", layer: "wealth", status: "growth" },
  { id: "shortterm", label: "Short-term goals", layer: "flex" },
];

function getDefaultAllocation(total: number): Record<BucketId, number> {
  // Suggested split for $1,362: 401k 300, EF 400, Debt 250, Roth 250, Brokerage 162
  const base: Record<BucketId, number> =
    total >= 1200
      ? { "401k": 300, hsa: 0, ef: 400, debt: 250, roth: 250, brokerage: 162, shortterm: 0 }
      : {
          "401k": Math.round(total * 0.22),
          hsa: 0,
          ef: Math.round(total * 0.29),
          debt: Math.round(total * 0.18),
          roth: Math.round(total * 0.18),
          brokerage: Math.round(total * 0.13),
          shortterm: 0,
        };
  const sum = Object.values(base).reduce((a, b) => a + b, 0);
  const diff = total - sum;
  return { ...base, brokerage: base.brokerage + diff };
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

  const [allocations, setAllocations] = useState<Record<BucketId, number>>(() =>
    getDefaultAllocation(monthlySavings)
  );

  const totalAllocated = useMemo(
    () => Object.values(allocations).reduce((a, b) => a + b, 0),
    [allocations]
  );
  const remainder = monthlySavings - totalAllocated;

  const adjustBucket = useCallback(
    (id: BucketId, delta: number) => {
      setAllocations((prev) => {
        const next = { ...prev };
        const newVal = Math.max(0, prev[id] + delta);
        const otherSum = Object.entries(prev)
          .filter(([k]) => k !== id)
          .reduce((a, [, v]) => a + v, 0);
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
    return DEFAULT_BUCKETS.map((b) => ({
      ...b,
      amount: allocations[b.id as BucketId],
    }));
  }, [allocations]);

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
      hasDebt: true,
      has401k: true,
      efFunded: false,
    }),
    [monthlySavings, bucketsForDisplay]
  );

  const handleComplete = () => {
    const projectedParam = searchParams.get("projected") ?? "0";
    router.push(`/app?savings=${monthlySavings}&projected=${projectedParam}&savingsAllocation=1`);
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
        href={`/app?savings=${monthlySavings}&projected=${searchParams.get("projected") ?? "0"}`}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to home
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
          prioritized where each dollar should go based on your accounts and goals.
        </p>
      </div>

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
          {bucketsForDisplay.map((bucket, idx) => (
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
                {statusIcon(bucket.status) && (
                  <span className="text-base" aria-hidden>
                    {statusIcon(bucket.status)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
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
              </div>
            </div>
          ))}
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
        Done — take me to my plan →
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
