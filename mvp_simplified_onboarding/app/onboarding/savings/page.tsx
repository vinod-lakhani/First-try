/**
 * Savings Plan Page
 *
 * Fourth step of onboarding - shows how savings could be allocated across
 * Cash, Retirement, and Investment stacks.
 */

"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { OnboardingProgress } from "@/components/onboarding/OnboardingProgress";

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

function SavingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const savingsParam = searchParams.get("savings");
  const monthlySavings = savingsParam ? parseFloat(savingsParam) || 800 : 800;

  const stacksWithAmounts = STACKS.map((s) => ({
    ...s,
    amount: Math.round((monthlySavings * s.pct) / 100),
  }));

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
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-8">
        Where your savings goes matters more than how much you save
      </p>

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
