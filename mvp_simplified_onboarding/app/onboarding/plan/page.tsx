/**
 * Plan Page
 *
 * Fifth step of onboarding - net worth projection and growth summary.
 */

"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { OnboardingProgress } from "@/components/onboarding/OnboardingProgress";
import { NetWorthChart } from "@/components/charts/NetWorthChart";
import { projectNetWorth } from "@/lib/sim/projectNetWorth";

function formatMoney(n: number, compact = false) {
  if (compact && n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (compact && n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function PlanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const savingsParam = searchParams.get("savings");
  const monthlySavings = savingsParam ? parseFloat(savingsParam) || 1362 : 1362;

  const { labels, netWorth } = projectNetWorth(monthlySavings, 30, 8);
  const projected30Y = netWorth[netWorth.length - 1] ?? 0;
  const at1Y = netWorth[12] ?? 0;
  const at5Y = netWorth[60] ?? 0;
  const at10Y = netWorth[120] ?? 0;

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
      <div className="mb-8">
        <NetWorthChart labels={labels} netWorth={netWorth} height={220} />
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
      <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-1">
          💡 Small monthly decisions compound massively
        </p>
        <p className="text-sm text-amber-800 dark:text-amber-300">
          Your ${monthlySavings.toLocaleString("en-US")}/month becomes over{" "}
          {formatMoney(projected30Y, true)} over time
        </p>
      </div>

      <Button onClick={handleSeeFirstMove} size="lg" className="w-full">
        See my first move →
      </Button>
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
