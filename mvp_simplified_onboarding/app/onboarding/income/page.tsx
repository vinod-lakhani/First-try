/**
 * Income Allocation Page
 *
 * Third step of onboarding - 50/30/20 rule allocation with Needs, Wants, Savings.
 * Savings = Income - Needs - Wants (calculated as leftover).
 */

"use client";

import { Suspense, useState, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OnboardingProgress } from "@/components/onboarding/OnboardingProgress";
import { RibbitChat } from "@/components/onboarding/RibbitChat";
import type { IncomeScreenContext } from "@/lib/ribbit/types";
import { estimateMonthlyTakeHome } from "@/lib/income/estimateTakeHome";

const STEP = 50;
const DEFAULT_MONTHLY = 6810;

// Needs subcategories (from second image)
const NEEDS_KEYS = [
  "rent",
  "utilities",
  "groceries",
  "transportation",
  "debt",
  "other",
] as const;
const NEEDS_LABELS: Record<(typeof NEEDS_KEYS)[number], string> = {
  rent: "Rent/Housing",
  utilities: "Utilities",
  groceries: "Groceries",
  transportation: "Transportation",
  debt: "Debt Minimum Payments",
  other: "Other Needs",
};

// Wants subcategories
const WANTS_KEYS = [
  "giving",
  "entertainment",
  "shopping",
  "travel",
  "subscriptions",
  "other",
] as const;
const WANTS_LABELS: Record<(typeof WANTS_KEYS)[number], string> = {
  giving: "Giving",
  entertainment: "Entertainment",
  shopping: "Shopping",
  travel: "Travel",
  subscriptions: "Subscriptions",
  other: "Other Wants",
};

function formatMoney(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
}

function getInitialIncome(searchParams: ReturnType<typeof useSearchParams> | null): number {
  const annual = searchParams?.get("annualIncome");
  const parsed = annual ? parseInt(annual, 10) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) {
    return estimateMonthlyTakeHome(parsed);
  }
  return DEFAULT_MONTHLY;
}

function IncomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialIncome = useMemo(() => getInitialIncome(searchParams), [searchParams]);

  // Use estimated monthly from Connect screen, or default
  const [income, setIncome] = useState(initialIncome);
  const [needs, setNeeds] = useState(Math.round(initialIncome * 0.5));
  const [wants, setWants] = useState(Math.round(initialIncome * 0.3));

  // Savings = leftover
  const savings = useMemo(() => Math.max(0, income - needs - wants), [income, needs, wants]);

  // Subcategory state - distribute proportionally
  const [needsBreakdown, setNeedsBreakdown] = useState<Record<(typeof NEEDS_KEYS)[number], number>>(() => {
    const n = Math.round(initialIncome * 0.5);
    const per = n / NEEDS_KEYS.length;
    return NEEDS_KEYS.reduce((acc, k) => ({ ...acc, [k]: Math.round(per * 100) / 100 }), {} as Record<(typeof NEEDS_KEYS)[number], number>);
  });
  const [wantsBreakdown, setWantsBreakdown] = useState<Record<(typeof WANTS_KEYS)[number], number>>(() => {
    const w = Math.round(initialIncome * 0.3);
    const per = w / WANTS_KEYS.length;
    return WANTS_KEYS.reduce((acc, k) => ({ ...acc, [k]: Math.round(per * 100) / 100 }), {} as Record<(typeof WANTS_KEYS)[number], number>);
  });

  const [needsExpanded, setNeedsExpanded] = useState(false);
  const [wantsExpanded, setWantsExpanded] = useState(false);
  const [ribbitOpen, setRibbitOpen] = useState(false);
  const [ribbitInitialQuestion, setRibbitInitialQuestion] = useState<string | null>(null);

  const adjustNeeds = useCallback(
    (delta: number) => {
      const newNeeds = Math.max(0, Math.min(income - wants, needs + delta));
      setNeeds(newNeeds);
      const per = newNeeds / NEEDS_KEYS.length;
      setNeedsBreakdown(NEEDS_KEYS.reduce((acc, k) => ({ ...acc, [k]: Math.round(per * 100) / 100 }), {} as Record<(typeof NEEDS_KEYS)[number], number>));
    },
    [income, needs, wants]
  );
  const adjustWants = useCallback(
    (delta: number) => {
      const newWants = Math.max(0, Math.min(income - needs, wants + delta));
      setWants(newWants);
      const per = newWants / WANTS_KEYS.length;
      setWantsBreakdown(WANTS_KEYS.reduce((acc, k) => ({ ...acc, [k]: Math.round(per * 100) / 100 }), {} as Record<(typeof WANTS_KEYS)[number], number>));
    },
    [income, needs, wants]
  );

  const adjustIncome = useCallback((delta: number) => {
    setIncome((prev) => Math.max(0, prev + delta));
  }, []);

  const updateNeedsSub = useCallback((key: (typeof NEEDS_KEYS)[number], delta: number) => {
    setNeedsBreakdown((prev) => {
      const v = Math.max(0, prev[key] + delta);
      const next = { ...prev, [key]: v };
      setNeeds(NEEDS_KEYS.reduce((s, k) => s + next[k], 0));
      return next;
    });
  }, []);
  const updateWantsSub = useCallback((key: (typeof WANTS_KEYS)[number], delta: number) => {
    setWantsBreakdown((prev) => {
      const v = Math.max(0, prev[key] + delta);
      const next = { ...prev, [key]: v };
      setWants(WANTS_KEYS.reduce((s, k) => s + next[k], 0));
      return next;
    });
  }, []);

  const handleAllocate = () => {
    router.push(`/onboarding/savings?savings=${Math.round(savings)}`);
  };

  const ribbitScreenContext: IncomeScreenContext = useMemo(
    () => ({
      screen: "income",
      onboardingStage: "income",
      hasLinkedAccounts: false,
      source: "estimated_from_income",
      monthlyIncome: income,
      needsAmount: needs,
      needsPct: income > 0 ? Math.round((needs / income) * 100) : 50,
      wantsAmount: wants,
      wantsPct: income > 0 ? Math.round((wants / income) * 100) : 30,
      savingsAmount: savings,
      savingsPct: income > 0 ? Math.round((savings / income) * 100) : 20,
      modelName: "50/30/20 rule",
    }),
    [income, needs, wants, savings]
  );

  const inputBase = "w-24 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right text-slate-900 dark:bg-slate-800 dark:text-white";

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8">
      <OnboardingProgress currentStep="income" showClose />

      {/* Header - human, not technical */}
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
        Here&apos;s what your income looks like
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
        A simple breakdown of how your money flows each month
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
        This is a simple starting plan (50/30/20 rule)
      </p>

      {/* Anchor Card - bar as hero */}
      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <p className="text-base font-semibold text-slate-900 dark:text-white mb-2">
          Based on your income of {formatMoney(income)}/month
        </p>
        {searchParams?.get("annualIncome") && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
            Estimated take-home from your annual income (after taxes)
          </p>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Recommended split</p>
        <div className="flex h-12 w-full overflow-hidden rounded-lg mb-4">
          <div
            className="bg-orange-500 flex items-center justify-center text-xs font-medium text-white"
            style={{ width: `${income > 0 ? (needs / income) * 100 : 50}%`, minWidth: needs > 0 ? "50px" : 0 }}
          >
            {needs > 0 && `NEEDS`}
          </div>
          <div
            className="bg-blue-500 flex items-center justify-center text-xs font-medium text-white"
            style={{ width: `${income > 0 ? (wants / income) * 100 : 30}%`, minWidth: wants > 0 ? "50px" : 0 }}
          >
            {wants > 0 && `WANTS`}
          </div>
          <div
            className="bg-green-600 flex items-center justify-center text-xs font-medium text-white"
            style={{ width: `${income > 0 ? (savings / income) * 100 : 20}%`, minWidth: savings > 0 ? "50px" : 0 }}
          >
            {savings > 0 && `SAVINGS`}
          </div>
        </div>
        <div className="flex w-full">
          <div
            className="flex flex-col items-center justify-center text-center min-w-0"
            style={{ width: `${income > 0 ? (needs / income) * 100 : 50}%` }}
          >
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{formatMoney(needs)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{income > 0 ? Math.round((needs / income) * 100) : 50}%</p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">Rent, bills, essentials</p>
          </div>
          <div
            className="flex flex-col items-center justify-center text-center min-w-0"
            style={{ width: `${income > 0 ? (wants / income) * 100 : 30}%` }}
          >
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{formatMoney(wants)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{income > 0 ? Math.round((wants / income) * 100) : 30}%</p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">Lifestyle, dining, fun</p>
          </div>
          <div
            className="flex flex-col items-center justify-center text-center min-w-0"
            style={{ width: `${income > 0 ? (savings / income) * 100 : 20}%` }}
          >
            <p className="text-base font-bold text-green-600 dark:text-green-400">{formatMoney(savings)}</p>
            <p className="text-xs font-medium text-green-600 dark:text-green-400">{income > 0 ? Math.round((savings / income) * 100) : 20}%</p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">Future you</p>
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          Not sure about this?{" "}
          <button
            type="button"
            onClick={() => setRibbitOpen(true)}
            className="font-medium text-primary hover:underline"
          >
            Ask Ribbit
          </button>
        </p>
      </div>

      {/* Quick question chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { label: "Why 50/30/20?", question: "Why 50/30/20?" },
          { label: "Is this realistic for me?", question: "Is this realistic for me?" },
          { label: "What if my rent is higher?", question: "What if my rent is higher?" },
        ].map((chip) => (
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

      {/* Adjust if needed - Customize your numbers */}
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">Adjust if needed</p>
      <div className="mb-6 rounded-lg border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Customize your numbers</p>
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Income / month</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Your take-home pay after taxes and deductions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => adjustIncome(-STEP)}
            className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            <Minus className="h-3 w-3" />
          </button>
          <input
            type="number"
            value={income}
            onChange={(e) => setIncome(parseFloat(e.target.value) || 0)}
            className={inputBase}
          />
          <button
            type="button"
            onClick={() => adjustIncome(STEP)}
            className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>

        {/* Needs */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Needs</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => adjustNeeds(-STEP)}
                className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800"
              >
                <Minus className="h-3 w-3" />
              </button>
            <input
              type="number"
              value={needs}
              onChange={(e) => {
                const v = Math.max(0, Math.min(income - wants, parseFloat(e.target.value) || 0));
                setNeeds(v);
                const per = v / NEEDS_KEYS.length;
                setNeedsBreakdown(NEEDS_KEYS.reduce((acc, k) => ({ ...acc, [k]: Math.round(per * 100) / 100 }), {} as Record<(typeof NEEDS_KEYS)[number], number>));
              }}
              className={inputBase}
            />
            <button
              type="button"
              onClick={() => adjustNeeds(STEP)}
              className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setNeedsExpanded(!needsExpanded)}
          className="mt-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"
        >
          Needs breakdown {needsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {needsExpanded && (
          <div className="mt-3 space-y-2 pl-4 border-l-2 border-slate-200 dark:border-slate-700">
            {NEEDS_KEYS.map((k) => (
              <div key={k} className="flex items-center justify-between gap-2">
                <span className="text-sm text-slate-700 dark:text-slate-300">{NEEDS_LABELS[k]}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => updateNeedsSub(k, -25)}
                    className="flex h-7 w-7 items-center justify-center rounded border text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-16 text-right text-sm">{formatMoney(needsBreakdown[k])}</span>
                  <button
                    type="button"
                    onClick={() => updateNeedsSub(k, 25)}
                    className="flex h-7 w-7 items-center justify-center rounded border text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

        {/* Wants */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Wants</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => adjustWants(-STEP)}
                className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800"
              >
                <Minus className="h-3 w-3" />
              </button>
            <input
              type="number"
              value={wants}
              onChange={(e) => {
                const v = Math.max(0, Math.min(income - needs, parseFloat(e.target.value) || 0));
                setWants(v);
                const per = v / WANTS_KEYS.length;
                setWantsBreakdown(WANTS_KEYS.reduce((acc, k) => ({ ...acc, [k]: Math.round(per * 100) / 100 }), {} as Record<(typeof WANTS_KEYS)[number], number>));
              }}
              className={inputBase}
            />
            <button
              type="button"
              onClick={() => adjustWants(STEP)}
              className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setWantsExpanded(!wantsExpanded)}
          className="mt-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"
        >
          Wants breakdown {wantsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {wantsExpanded && (
          <div className="mt-3 space-y-2 pl-4 border-l-2 border-slate-200 dark:border-slate-700">
            {WANTS_KEYS.map((k) => (
              <div key={k} className="flex items-center justify-between gap-2">
                <span className="text-sm text-slate-700 dark:text-slate-300">{WANTS_LABELS[k]}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => updateWantsSub(k, -25)}
                    className="flex h-7 w-7 items-center justify-center rounded border text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-16 text-right text-sm">{formatMoney(wantsBreakdown[k])}</span>
                  <button
                    type="button"
                    onClick={() => updateWantsSub(k, 25)}
                    className="flex h-7 w-7 items-center justify-center rounded border text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>

      {/* Key Insight */}
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-1">
          💡 This is where most people get stuck
        </p>
        <p className="text-sm text-amber-800 dark:text-amber-300">
          They spend first and save what&apos;s left — instead of deciding their savings upfront.
        </p>
      </div>

      {/* Savings Highlight - bridge to next screen */}
      <div className="mb-6 rounded-xl border-2 border-primary/30 bg-primary/5 p-5 dark:bg-primary/10">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          You could be saving
        </p>
        <p className="text-2xl font-bold text-primary dark:text-primary">
          {formatMoney(savings)}/month
        </p>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
          That&apos;s what you have available to build wealth
        </p>
      </div>

      <Button onClick={handleAllocate} size="lg" className="w-full">
        How should I allocate my savings →
      </Button>

      <RibbitChat
        screenContext={ribbitScreenContext}
        chips={[
          { label: "Why 50/30/20?", question: "Why 50/30/20?" },
          { label: "Is this realistic for me?", question: "Is this realistic for me?" },
          { label: "What if my rent is higher?", question: "What if my rent is higher?" },
        ]}
        open={ribbitOpen}
        onOpenChange={setRibbitOpen}
        initialQuestion={ribbitInitialQuestion}
        onInitialQuestionSent={() => setRibbitInitialQuestion(null)}
      />
    </div>
  );
}

export default function IncomePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading...</div>}>
      <IncomeContent />
    </Suspense>
  );
}
