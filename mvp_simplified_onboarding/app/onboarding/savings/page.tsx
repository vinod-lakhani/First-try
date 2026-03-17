/**
 * Savings Plan Page
 *
 * Fourth step of onboarding - shows how savings could be allocated across
 * Cash, Retirement, and Investment stacks.
 */

"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { OnboardingProgress } from "@/components/onboarding/OnboardingProgress";
import { RibbitChat } from "@/components/onboarding/RibbitChat";
import type { SavingsScreenContext } from "@/lib/ribbit/types";

const STACKS = [
  {
    id: "cash",
    label: "CASH",
    pct: 40,
    tagline: "Stay protected when life hits",
    color: "bg-slate-600",
  },
  {
    id: "retirement",
    label: "RETIREMENT",
    pct: 40,
    tagline: "Grow tax-free long term",
    color: "bg-emerald-600",
  },
  {
    id: "investment",
    label: "INVESTMENT",
    pct: 20,
    tagline: "Build flexible wealth",
    color: "bg-blue-600",
  },
] as const;

const SAVINGS_CHIPS = [
  { label: "Why this split?", question: "Why this split?" },
  { label: "Should I invest more?", question: "Should I invest more?" },
  { label: "What if I have debt?", question: "What if I have debt?" },
];

function SavingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const savingsParam = searchParams.get("savings");
  const monthlySavings = savingsParam ? parseFloat(savingsParam) || 800 : 800;
  const [ribbitOpen, setRibbitOpen] = useState(false);
  const [ribbitInitialQuestion, setRibbitInitialQuestion] = useState<string | null>(null);

  const stacksWithAmounts = STACKS.map((s) => ({
    ...s,
    amount: Math.round((monthlySavings * s.pct) / 100),
  }));

  const ribbitScreenContext: SavingsScreenContext = useMemo(
    () => ({
      screen: "savings",
      onboardingStage: "savings",
      hasLinkedAccounts: false,
      source: "estimated_from_income",
      monthlySavings,
      allocationModelName: "Simple starting allocation",
      buckets: [
        {
          label: "cash",
          amount: Math.round((monthlySavings * 40) / 100),
          pct: 40,
          description: "Stay protected when life hits",
        },
        {
          label: "retirement",
          amount: Math.round((monthlySavings * 40) / 100),
          pct: 40,
          description: "Grow tax-advantaged wealth over time",
        },
        {
          label: "investment",
          amount: Math.round((monthlySavings * 20) / 100),
          pct: 20,
          description: "Build flexible long-term wealth",
        },
      ],
      note: "Most people invest too early. Building a safety buffer first helps avoid pulling money out at the wrong time.",
    }),
    [monthlySavings]
  );

  const handleGetPlan = () => {
    router.push(`/onboarding/plan?savings=${monthlySavings}`);
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8">
      <OnboardingProgress currentStep="savings" showClose />

      {/* Title */}
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
        Here&apos;s how your ${monthlySavings.toLocaleString("en-US")} can work for you
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
        Where your savings goes matters more than how much you save
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
        Want help deciding this?{" "}
        <button
          type="button"
          onClick={() => setRibbitOpen(true)}
          className="font-medium text-primary hover:underline"
        >
          Ask Ribbit
        </button>
      </p>

      {/* Quick question chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {SAVINGS_CHIPS.map((chip) => (
          <button
            key={chip.question}
            type="button"
            onClick={() => {
              setRibbitInitialQuestion(chip.question);
              setRibbitOpen(true);
            }}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Three stacks as bars */}
      <div className="space-y-6 mb-8">
        {stacksWithAmounts.map((stack) => (
          <div key={stack.id}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wide">
                {stack.label}
              </span>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {stack.pct}% · ${stack.amount.toLocaleString("en-US")}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className={`h-full rounded-full ${stack.color} transition-all duration-500`}
                style={{ width: `${stack.pct}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
              {stack.tagline}
            </p>
          </div>
        ))}
      </div>

      {/* Tip box */}
      <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-1">
          💡 Most people invest too early
        </p>
        <p className="text-sm text-amber-800 dark:text-amber-300">
          Building a safety buffer first helps avoid pulling money out at the
          wrong time.
        </p>
      </div>

      {/* CTA */}
      <Button onClick={handleGetPlan} size="lg" className="w-full">
        Get my full financial plan →
      </Button>

      <RibbitChat
        screenContext={ribbitScreenContext}
        chips={SAVINGS_CHIPS}
        open={ribbitOpen}
        onOpenChange={setRibbitOpen}
        initialQuestion={ribbitInitialQuestion}
        onInitialQuestionSent={() => setRibbitInitialQuestion(null)}
      />
    </div>
  );
}

export default function SavingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading...</div>}>
      <SavingsContent />
    </Suspense>
  );
}
