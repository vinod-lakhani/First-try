/**
 * Income Allocation Page
 *
 * Third step of onboarding - 50/30/20 rule allocation with Needs, Wants, Savings.
 * Savings = Income - Needs - Wants (calculated as leftover).
 */

"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OnboardingProgress } from "@/components/onboarding/OnboardingProgress";

const STEP = 50;

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

export default function IncomePage() {
  const router = useRouter();

  // Default: $6810 income, 50% needs ($3405), 30% wants ($2043), 20% savings ($1362)
  const [income, setIncome] = useState(6810);
  const [needs, setNeeds] = useState(3405);
  const [wants, setWants] = useState(2043);

  // Savings = leftover
  const savings = useMemo(() => Math.max(0, income - needs - wants), [income, needs, wants]);

  // Subcategory state - distribute proportionally
  const [needsBreakdown, setNeedsBreakdown] = useState<Record<(typeof NEEDS_KEYS)[number], number>>(() => {
    const per = 3405 / NEEDS_KEYS.length;
    return NEEDS_KEYS.reduce((acc, k) => ({ ...acc, [k]: Math.round(per * 100) / 100 }), {} as Record<(typeof NEEDS_KEYS)[number], number>);
  });
  const [wantsBreakdown, setWantsBreakdown] = useState<Record<(typeof WANTS_KEYS)[number], number>>(() => {
    const per = 2043 / WANTS_KEYS.length;
    return WANTS_KEYS.reduce((acc, k) => ({ ...acc, [k]: Math.round(per * 100) / 100 }), {} as Record<(typeof WANTS_KEYS)[number], number>);
  });

  const [needsExpanded, setNeedsExpanded] = useState(false);
  const [wantsExpanded, setWantsExpanded] = useState(false);

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

  const inputBase = "w-24 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right text-slate-900 dark:bg-slate-800 dark:text-white";

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8">
      <OnboardingProgress currentStep="income" showClose />

      {/* Header - human, not technical */}
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
        Here&apos;s what your income looks like
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
        A simple breakdown of how your money flows each month
      </p>

      {/* Anchor Card - bar as hero */}
      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <p className="text-base font-semibold text-slate-900 dark:text-white mb-4">
          You bring in {formatMoney(income)}/month
        </p>
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
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{formatMoney(savings)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{income > 0 ? Math.round((savings / income) * 100) : 20}%</p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">Future you</p>
          </div>
        </div>
      </div>

      {/* Income */}
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
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            <Minus className="h-4 w-4" />
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
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            <Plus className="h-4 w-4" />
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
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800"
            >
              <Minus className="h-4 w-4" />
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
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
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
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800"
            >
              <Minus className="h-4 w-4" />
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
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
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
        See how to grow this →
      </Button>
    </div>
  );
}
