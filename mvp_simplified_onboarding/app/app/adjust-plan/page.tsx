/**
 * Adjust Plan Page
 * Post-Plaid income allocation with pre-filled recommended values.
 * Returns user to home page after saving.
 */

"use client";

import { Suspense, useState, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Minus, Plus, ArrowLeft } from "lucide-react";
import { RibbitIcon } from "@/components/onboarding/RibbitIcon";
import { RibbitChat } from "@/components/onboarding/RibbitChat";
import type { AdjustPlanScreenContext } from "@/lib/ribbit/types";
import { Button } from "@/components/ui/button";
import { projectNetWorth } from "@/lib/sim/projectNetWorth";

const STEP = 50;
const DEFAULT_INCOME = 6810;

function formatMoney(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function getInitialValues(searchParams: ReturnType<typeof useSearchParams> | null) {
  const incomeParam = searchParams?.get("income");
  const targetSavingsParam = searchParams?.get("targetSavings");
  const currentSavingsParam = searchParams?.get("currentSavings");
  const income = incomeParam ? parseFloat(incomeParam) || DEFAULT_INCOME : DEFAULT_INCOME;
  const targetSavings = targetSavingsParam ? parseFloat(targetSavingsParam) : Math.round(income * 0.2);
  const currentSavings = currentSavingsParam ? parseFloat(currentSavingsParam) : Math.round(income * 0.2);
  const remaining = Math.max(0, income - targetSavings);
  const needs = Math.round(remaining * 0.625);
  const wants = Math.round(remaining * 0.375);
  return { income, targetSavings, currentSavings, needs, wants };
}

function StackedBar({
  label,
  needs,
  wants,
  savings,
  total,
  highlight,
}: {
  label: string;
  needs: number;
  wants: number;
  savings: number;
  total: number;
  highlight?: boolean;
}) {
  const needsPct = total > 0 ? (needs / total) * 100 : 50;
  const wantsPct = total > 0 ? (wants / total) * 100 : 30;
  const savingsPct = total > 0 ? (savings / total) * 100 : 20;
  return (
    <div className={highlight ? "rounded-lg border-2 border-primary/30 bg-primary/5 p-3 dark:border-primary/40 dark:bg-primary/10" : ""}>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{label}</p>
      <div className="flex h-8 w-full overflow-hidden rounded-lg">
        <div
          className="bg-orange-500 flex items-center justify-center text-xs font-medium text-white"
          style={{ width: `${needsPct}%`, minWidth: needsPct > 5 ? "20px" : 0 }}
        />
        <div
          className="bg-blue-500 flex items-center justify-center text-xs font-medium text-white"
          style={{ width: `${wantsPct}%`, minWidth: wantsPct > 5 ? "20px" : 0 }}
        />
        <div
          className="bg-green-600 flex items-center justify-center text-xs font-medium text-white"
          style={{ width: `${savingsPct}%`, minWidth: savingsPct > 5 ? "20px" : 0 }}
        />
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
        {formatMoney(needs)} / {formatMoney(wants)} / {formatMoney(savings)} ({Math.round(savingsPct)}% savings)
      </p>
    </div>
  );
}

function AdjustPlanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = useMemo(() => getInitialValues(searchParams), [searchParams]);

  const [income, setIncome] = useState(initial.income);
  const [needs, setNeeds] = useState(initial.needs);
  const [wants, setWants] = useState(initial.wants);
  const savings = useMemo(() => Math.max(0, income - needs - wants), [income, needs, wants]);

  // Three scenarios for stacked charts
  const past3MonthsSavings = initial.currentSavings;
  const past3MonthsRemaining = Math.max(0, income - past3MonthsSavings);
  const past3MonthsNeeds = Math.round(past3MonthsRemaining * 0.625);
  const past3MonthsWants = Math.round(past3MonthsRemaining * 0.375);

  const currentPlanNeeds = Math.round(income * 0.5);
  const currentPlanWants = Math.round(income * 0.3);
  const currentPlanSavings = Math.max(0, income - currentPlanNeeds - currentPlanWants);

  const recommendedSavings = initial.targetSavings;
  const recommendedRemaining = Math.max(0, income - recommendedSavings);
  const recommendedNeeds = Math.round(recommendedRemaining * 0.625);
  const recommendedWants = Math.round(recommendedRemaining * 0.375);

  const improvementAmount = Math.round(
    (projectNetWorth(recommendedSavings, 30).netWorth.slice(-1)[0] ?? 0) -
    (projectNetWorth(past3MonthsSavings, 30).netWorth.slice(-1)[0] ?? 0)
  );

  // Rates and deltas for Ribbit responses
  const past3MonthsRate = income > 0 ? Math.round((past3MonthsSavings / income) * 1000) / 10 : 0;
  const currentPlanRate = income > 0 ? Math.round((currentPlanSavings / income) * 1000) / 10 : 0;
  const recommendedRate = income > 0 ? Math.round((recommendedSavings / income) * 1000) / 10 : 0;
  const deltaNeeds = recommendedNeeds - past3MonthsNeeds;
  const deltaWants = recommendedWants - past3MonthsWants;
  const deltaSavings = recommendedSavings - past3MonthsSavings;

  const [ribbitOpen, setRibbitOpen] = useState(false);
  const [ribbitInitialQuestion, setRibbitInitialQuestion] = useState<string | null>(null);

  const adjustPlanChips = useMemo(
    () => [
      { label: "Why are you recommending this?", question: "Why are you recommending this change to my savings allocation? Use my past 3 months and recommended numbers." },
      { label: "What would I need to cut back on?", question: "What would I need to cut back on to hit the recommended savings rate? Be specific with dollar amounts." },
      { label: `Is ${recommendedRate}% realistic?`, question: `Is ${recommendedRate}% savings rate realistic for me given my past 3 months at ${past3MonthsRate}%?` },
    ],
    [recommendedRate, past3MonthsRate]
  );

  const adjustNeeds = useCallback(
    (delta: number) => {
      setNeeds((prev) => Math.max(0, Math.min(income - wants, prev + delta)));
    },
    [income, wants]
  );
  const adjustWants = useCallback(
    (delta: number) => {
      setWants((prev) => Math.max(0, Math.min(income - needs, prev + delta)));
    },
    [income, needs]
  );
  const adjustIncome = useCallback((delta: number) => {
    setIncome((prev) => Math.max(0, prev + delta));
  }, []);

  const handleSave = () => {
    const { netWorth } = projectNetWorth(savings, 30);
    const projected30Y = netWorth[netWorth.length - 1] ?? 2000000;
    router.push(`/app?savings=${Math.round(savings)}&projected=${Math.round(projected30Y)}`);
  };

  const needsPct = income > 0 ? (needs / income) * 100 : 50;
  const wantsPct = income > 0 ? (wants / income) * 100 : 30;
  const savingsPct = income > 0 ? (savings / income) * 100 : 20;

  const ribbitScreenContext: AdjustPlanScreenContext = useMemo(
    () => ({
      screen: "adjust-plan",
      onboardingStage: "plan",
      hasLinkedAccounts: true,
      source: "linked_accounts",
      monthlyIncome: income,
      past3MonthsAvgSavings: past3MonthsSavings,
      past3MonthsSavingsRate: past3MonthsRate,
      currentPlanSavings,
      currentPlanSavingsRate: currentPlanRate,
      recommendedSavings,
      recommendedSavingsRate: recommendedRate,
      improveNetWorth30Y: improvementAmount,
    }),
    [
      income,
      past3MonthsSavings,
      past3MonthsRate,
      currentPlanSavings,
      currentPlanRate,
      recommendedSavings,
      recommendedRate,
      improvementAmount,
    ]
  );

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <Link
        href="/app"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to home
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
        Update your income allocation
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
        Adjust your plan to reach your savings goal
      </p>

      {/* Three stacked charts */}
      <div className="mb-6 space-y-4">
        <StackedBar
          label="Past 3 months"
          needs={past3MonthsNeeds}
          wants={past3MonthsWants}
          savings={past3MonthsSavings}
          total={income}
        />
        <StackedBar
          label="Current plan"
          needs={currentPlanNeeds}
          wants={currentPlanWants}
          savings={currentPlanSavings}
          total={income}
        />
        <StackedBar
          label="Recommended"
          needs={recommendedNeeds}
          wants={recommendedWants}
          savings={recommendedSavings}
          total={income}
          highlight
        />
      </div>

      {/* Ribbit helper — chips open Ribbit screen */}
      <div className="mb-6">
        <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">
          <RibbitIcon size="sm" className="mr-1.5 align-middle" />
          <strong>Ribbit:</strong> I compared your last 3 months to your current plan and found a small change that improves your savings without changing your lifestyle too much.
        </p>
        <div className="flex flex-wrap gap-2">
          {adjustPlanChips.map((chip) => (
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
      </div>

      {/* Improve net worth by $X */}
      <div className="mb-6 rounded-xl border-2 border-primary/20 bg-primary/5 p-4 dark:border-primary/30 dark:bg-primary/10">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Improve net worth by {improvementAmount >= 1e6 ? `$${(improvementAmount / 1e6).toFixed(1)}M` : improvementAmount >= 1e3 ? `$${(improvementAmount / 1e3).toFixed(0)}K` : `$${improvementAmount}`} in 30 years
        </p>
      </div>

      {/* Allocation bar */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
          Based on {formatMoney(income)}/month take-home
        </p>
        <div className="flex h-10 w-full overflow-hidden rounded-lg mb-4">
          <div
            className="bg-orange-500 flex items-center justify-center text-xs font-medium text-white"
            style={{ width: `${needsPct}%`, minWidth: needsPct > 5 ? "40px" : 0 }}
          >
            {needsPct > 5 && "NEEDS"}
          </div>
          <div
            className="bg-blue-500 flex items-center justify-center text-xs font-medium text-white"
            style={{ width: `${wantsPct}%`, minWidth: wantsPct > 5 ? "40px" : 0 }}
          >
            {wantsPct > 5 && "WANTS"}
          </div>
          <div
            className="bg-green-600 flex items-center justify-center text-xs font-medium text-white"
            style={{ width: `${savingsPct}%`, minWidth: savingsPct > 5 ? "40px" : 0 }}
          >
            {savingsPct > 5 && "SAVINGS"}
          </div>
        </div>
        <div className="flex w-full text-center text-sm">
          <div style={{ width: `${needsPct}%` }} className="min-w-0">
            <p className="font-semibold">{formatMoney(needs)}</p>
            <p className="text-xs text-slate-500">{Math.round(needsPct)}%</p>
          </div>
          <div style={{ width: `${wantsPct}%` }} className="min-w-0">
            <p className="font-semibold">{formatMoney(wants)}</p>
            <p className="text-xs text-slate-500">{Math.round(wantsPct)}%</p>
          </div>
          <div style={{ width: `${savingsPct}%` }} className="min-w-0">
            <p className="font-semibold text-green-600">{formatMoney(savings)}</p>
            <p className="text-xs text-green-600">{Math.round(savingsPct)}%</p>
          </div>
        </div>
      </div>

      {/* Adjust controls */}
      <div className="mb-6 space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Income / month</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => adjustIncome(-STEP)}
              className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800"
            >
              <Minus className="h-3 w-3" />
            </button>
            <input
              type="number"
              value={income}
              onChange={(e) => setIncome(parseFloat(e.target.value) || 0)}
              className="w-28 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right dark:bg-slate-800 dark:text-white"
            />
            <button
              type="button"
              onClick={() => adjustIncome(STEP)}
              className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Needs</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => adjustNeeds(-STEP)}
              className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800"
            >
              <Minus className="h-3 w-3" />
            </button>
            <input
              type="number"
              value={needs}
              onChange={(e) => setNeeds(Math.max(0, Math.min(income - wants, parseFloat(e.target.value) || 0)))}
              className="w-28 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right dark:bg-slate-800 dark:text-white"
            />
            <button
              type="button"
              onClick={() => adjustNeeds(STEP)}
              className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Wants</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => adjustWants(-STEP)}
              className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800"
            >
              <Minus className="h-3 w-3" />
            </button>
            <input
              type="number"
              value={wants}
              onChange={(e) => setWants(Math.max(0, Math.min(income - needs, parseFloat(e.target.value) || 0)))}
              className="w-28 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right dark:bg-slate-800 dark:text-white"
            />
            <button
              type="button"
              onClick={() => adjustWants(STEP)}
              className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      <Button onClick={handleSave} size="lg" className="w-full">
        Save and return to home
      </Button>

      <RibbitChat
        screenContext={ribbitScreenContext}
        chips={adjustPlanChips}
        open={ribbitOpen}
        onOpenChange={setRibbitOpen}
        initialQuestion={ribbitInitialQuestion}
        onInitialQuestionSent={() => setRibbitInitialQuestion(null)}
      />
    </div>
  );
}

export default function AdjustPlanPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading...</div>}>
      <AdjustPlanContent />
    </Suspense>
  );
}
