/**
 * Plan Page
 *
 * Fifth step of onboarding - net worth projection and growth summary.
 */

"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { OnboardingProgress } from "@/components/onboarding/OnboardingProgress";
import { NetWorthChart } from "@/components/charts/NetWorthChart";
import { projectNetWorth } from "@/lib/sim/projectNetWorth";
import { RibbitChat } from "@/components/onboarding/RibbitChat";
import type { PlanScreenContext } from "@/lib/ribbit/types";

function formatMoney(n: number, compact = false) {
  if (compact && n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (compact && n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

const PLAN_CHIPS = [
  { label: "Is this realistic?", question: "Is this realistic?" },
  { label: "What assumptions are used?", question: "What assumptions are used?" },
  { label: "How do I reach this faster?", question: "How do I reach this faster?" },
  { label: "What should I do first?", question: "What should I do first?" },
];

function PlanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const savingsParam = searchParams.get("savings");
  const monthlySavings = savingsParam ? parseFloat(savingsParam) || 1362 : 1362;
  const [ribbitOpen, setRibbitOpen] = useState(false);
  const [ribbitInitialQuestion, setRibbitInitialQuestion] = useState<string | null>(null);

  const { labels, netWorth } = projectNetWorth(monthlySavings, 30, 8);
  const projected30Y = netWorth[netWorth.length - 1] ?? 0;
  const at1Y = netWorth[12] ?? 0;
  const at5Y = netWorth[60] ?? 0;
  const at10Y = netWorth[120] ?? 0;

  const ribbitScreenContext: PlanScreenContext = useMemo(
    () => ({
      screen: "plan",
      onboardingStage: "plan",
      hasLinkedAccounts: false,
      source: "estimated_from_income",
      monthlySavings,
      projectedNetWorth30Y: projected30Y,
      horizonYears: 30,
      milestones: {
        oneYear: at1Y,
        fiveYears: at5Y,
        tenYears: at10Y,
      },
      projectionAssumptionsLabel: "steady monthly saving and long-term market growth",
    }),
    [monthlySavings, projected30Y, at1Y, at5Y, at10Y]
  );

  const handleSeeFirstMove = () => {
    router.push("/");
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8">
      <OnboardingProgress currentStep="plan" showClose />

      {/* Header */}
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
        Here&apos;s where you&apos;re headed
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-8">
        Based on your income, this is how your money can grow over time
      </p>

      {/* Projected net worth */}
      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
          💰 Projected net worth
        </p>
        <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
          {formatMoney(projected30Y, false)}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          In ~30 years at your current pace
        </p>
      </div>

      {/* Net worth chart */}
      <div className="mb-6">
        <NetWorthChart labels={labels} netWorth={netWorth} height={220} />
      </div>

      {/* Quick question chips */}
      <div className="flex flex-wrap gap-2 mb-8">
        {PLAN_CHIPS.map((chip) => (
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

      {/* Growth table */}
      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">
          📊 Your growth
        </p>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">1 year</p>
            <p className="text-base font-semibold text-slate-900 dark:text-white">
              {formatMoney(at1Y, true)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">5 years</p>
            <p className="text-base font-semibold text-slate-900 dark:text-white">
              {formatMoney(at5Y, true)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">10 years</p>
            <p className="text-base font-semibold text-slate-900 dark:text-white">
              {formatMoney(at10Y, true)}
            </p>
          </div>
        </div>
      </div>

      {/* Insight */}
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-1">
          💡 Small monthly decisions compound massively
        </p>
        <p className="text-sm text-amber-800 dark:text-amber-300">
          Your ${monthlySavings.toLocaleString("en-US")}/month becomes over{" "}
          {formatMoney(projected30Y, true)} over time
        </p>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
        Want help getting there?{" "}
        <button
          type="button"
          onClick={() => setRibbitOpen(true)}
          className="font-medium text-primary hover:underline"
        >
          Ask Ribbit
        </button>
      </p>

      <Button onClick={handleSeeFirstMove} size="lg" className="w-full">
        See my first move →
      </Button>

      <RibbitChat
        screenContext={ribbitScreenContext}
        chips={PLAN_CHIPS}
        open={ribbitOpen}
        onOpenChange={setRibbitOpen}
        initialQuestion={ribbitInitialQuestion}
        onInitialQuestionSent={() => setRibbitInitialQuestion(null)}
      />
    </div>
  );
}

export default function PlanPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading...</div>}>
      <PlanContent />
    </Suspense>
  );
}
