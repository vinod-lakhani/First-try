/**
 * Savings Plan Page
 *
 * Fourth step of onboarding - shows how savings could be allocated across
 * Cash, Retirement, and Investment stacks.
 */

"use client";

import { Suspense, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OnboardingProgress } from "@/components/onboarding/OnboardingProgress";
import { RibbitChat } from "@/components/onboarding/RibbitChat";
import type { SavingsScreenContext } from "@/lib/ribbit/types";

const PCT_STEP = 5;

const STACK_CONFIG = [
  { id: "cash" as const, label: "CASH", tagline: "Stay protected when life hits", color: "bg-slate-600" },
  { id: "retirement" as const, label: "RETIREMENT", tagline: "Grow tax-free long term", color: "bg-emerald-600" },
  { id: "investment" as const, label: "INVESTMENT", tagline: "Build flexible wealth", color: "bg-blue-600" },
];

const SAVINGS_CHIPS = [
  { label: "Why this split?", question: "Why this split?" },
  { label: "Should I invest more?", question: "Should I invest more?" },
  { label: "What if I have debt?", question: "What if I have debt?" },
];

type StackId = "cash" | "retirement" | "investment";

function SavingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const savingsParam = searchParams.get("savings");
  const monthlySavings = savingsParam ? parseFloat(savingsParam) || 800 : 800;
  const [ribbitOpen, setRibbitOpen] = useState(false);
  const [ribbitInitialQuestion, setRibbitInitialQuestion] = useState<string | null>(null);

  const [cashPct, setCashPct] = useState(40);
  const [retirementPct, setRetirementPct] = useState(40);
  const investmentPct = Math.max(0, 100 - cashPct - retirementPct);

  const adjustPct = useCallback((id: StackId, delta: number) => {
    if (id === "cash") {
      const actualDelta = delta > 0 ? Math.min(delta, retirementPct) : Math.max(delta, -cashPct);
      setCashPct((p) => p + actualDelta);
      setRetirementPct((p) => p - actualDelta);
    } else if (id === "retirement") {
      const actualDelta = delta > 0 ? Math.min(delta, cashPct) : Math.max(delta, -retirementPct);
      setRetirementPct((p) => p + actualDelta);
      setCashPct((p) => p - actualDelta);
    } else {
      const actualDelta = delta > 0 ? Math.min(delta, cashPct) : Math.max(delta, -investmentPct);
      setCashPct((p) => p - actualDelta);
    }
  }, [cashPct, retirementPct, investmentPct]);

  const stacksWithAmounts = useMemo(() => {
    const pcts = { cash: cashPct, retirement: retirementPct, investment: investmentPct };
    return STACK_CONFIG.map((s) => ({
      ...s,
      pct: pcts[s.id],
      amount: Math.round((monthlySavings * pcts[s.id]) / 100),
    }));
  }, [cashPct, retirementPct, investmentPct, monthlySavings]);

  const ribbitScreenContext: SavingsScreenContext = useMemo(
    () => ({
      screen: "savings",
      onboardingStage: "savings",
      hasLinkedAccounts: false,
      source: "estimated_from_income",
      monthlySavings,
      allocationModelName: "Simple starting allocation",
      buckets: stacksWithAmounts.map((s) => ({
        label: s.id,
        amount: s.amount,
        pct: s.pct,
        description: s.tagline,
      })),
      note: "Most people invest too early. Building a safety buffer first helps avoid pulling money out at the wrong time.",
    }),
    [monthlySavings, stacksWithAmounts]
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

      {/* Adjust if needed - Customize the mix */}
      <div className="mb-8 rounded-xl border-2 border-primary/20 bg-white p-5 dark:border-primary/30 dark:bg-slate-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
          Adjust if needed
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-5">
          Customize the mix between Cash, Retirement, and Investment to match your goals
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Your monthly savings of ${monthlySavings.toLocaleString("en-US")} is set from the income screen
        </p>
        {stacksWithAmounts.map((stack) => (
          <div key={stack.id} className="mb-6 last:mb-0">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{stack.label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{stack.tagline}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => adjustPct(stack.id, -PCT_STEP)}
                  className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-12 text-right text-sm font-semibold text-slate-900 dark:text-white">
                  {Math.round(stack.pct)}%
                </span>
                <button
                  type="button"
                  onClick={() => adjustPct(stack.id, PCT_STEP)}
                  className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
            <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className={`h-full rounded-full ${stack.color} transition-all duration-500`}
                style={{ width: `${stack.pct}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              ${stack.amount.toLocaleString("en-US")}/month
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
