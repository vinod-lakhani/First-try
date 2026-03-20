"use client";

import { Suspense, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DistributionSection } from "@/components/income/DistributionSection";
import { SavingsBarsSection } from "@/components/income/SavingsBarsSection";
import { IncomeAllocationDonut } from "@/components/charts/IncomeAllocationDonut";
import { RibbitChat } from "@/components/onboarding/RibbitChat";
import type { IncomeScreenContext } from "@/lib/ribbit/types";
import { estimateMonthlyTakeHome } from "@/lib/income/estimateTakeHome";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

// Default pay details - 50/30/20 allocation
const DEFAULT_GROSS = 8500;
const DEFAULT_TAX = 1200;
const DEFAULT_PRE_TAX_DEDUCTIONS = 490;
const MOCK_NEEDS_BREAKDOWN = [
  { label: "Rent", amount: 1850 },
  { label: "Utilities", amount: 320 },
  { label: "Groceries", amount: 580 },
  { label: "Transportation", amount: 420 },
  { label: "Debt Minimums", amount: 235 },
];
const MOCK_WANTS_BREAKDOWN = [
  { label: "Entertainment", amount: 420 },
  { label: "Dining Out", amount: 380 },
  { label: "Shopping", amount: 350 },
  { label: "Subscriptions", amount: 250 },
];
const MOCK_PRE_TAX_ITEMS = [
  { label: "Employer 401K", amount: 100 },
  { label: "Employee 401K", amount: 200 },
  { label: "Employer HSA", amount: 30 },
  { label: "Employee HSA", amount: 70 },
];
const MOCK_POST_TAX_ITEMS = [
  { label: "Emergency Fund", amount: 450 },
  { label: "Roth IRA", amount: 200 },
  { label: "Traditional IRA", amount: 0 },
  { label: "Brokerage", amount: 262 },
  { label: "Short-term Goals", amount: 50 },
];

/** Generic chips for Ribbit sheet when opened via floating button */
const RIBBIT_SHEET_CHIPS = [
  { label: "Why 50/30/20?", question: "Why 50/30/20?" },
  { label: "Is this realistic for me?", question: "Is this realistic for me?" },
  { label: "What if my rent is higher?", question: "What if my rent is higher?" },
];

function getInitialPayDetails(searchParams: ReturnType<typeof useSearchParams> | null) {
  const annual = searchParams?.get("annualIncome");
  const parsed = annual ? parseInt(annual, 10) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) {
    const monthlyGross = Math.round(parsed / 12);
    const takeHome = estimateMonthlyTakeHome(parsed);
    const withheld = monthlyGross - takeHome;
    // Rough split: ~71% tax, ~29% pre-tax deductions (typical)
    const tax = Math.round(withheld * 0.71);
    const preTaxDeductions = Math.round(withheld * 0.29);
    return { gross: monthlyGross, tax, preTaxDeductions };
  }
  return { gross: DEFAULT_GROSS, tax: DEFAULT_TAX, preTaxDeductions: DEFAULT_PRE_TAX_DEDUCTIONS };
}

function IncomeContent() {
  const searchParams = useSearchParams();
  const initialPay = useMemo(() => getInitialPayDetails(searchParams), [searchParams]);

  const [grossIncome, setGrossIncome] = useState(initialPay.gross);
  const [tax, setTax] = useState(initialPay.tax);
  const [preTaxDeductions, setPreTaxDeductions] = useState(initialPay.preTaxDeductions);
  const [editPayModalOpen, setEditPayModalOpen] = useState(false);
  const [ribbitOpen, setRibbitOpen] = useState(false);
  const [ribbitInitialQuestion, setRibbitInitialQuestion] = useState<string | null>(null);

  const takeHome = Math.max(0, grossIncome - tax - preTaxDeductions);
  const withheld = grossIncome - takeHome;

  // 50/30/20 allocation based on take-home
  const needs = Math.round(takeHome * 0.5);
  const wants = Math.round(takeHome * 0.3);
  const savings = Math.round(takeHome * 0.2);

  const handleRibbitChipClick = useCallback((question: string) => {
    setRibbitInitialQuestion(question);
    setRibbitOpen(true);
  }, []);

  const handleSavePayDetails = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setEditPayModalOpen(false);
    },
    []
  );

  const needsPct = takeHome > 0 ? (needs / takeHome) * 100 : 50;
  const wantsPct = takeHome > 0 ? (wants / takeHome) * 100 : 30;
  const savingsPct = takeHome > 0 ? (savings / takeHome) * 100 : 20;

  const ribbitScreenContext: IncomeScreenContext = useMemo(
    () => ({
      screen: "income",
      onboardingStage: "income",
      hasLinkedAccounts: false,
      source: "estimated_from_income",
      monthlyIncome: takeHome,
      needsAmount: needs,
      needsPct: Math.round(needsPct * 10) / 10,
      wantsAmount: wants,
      wantsPct: Math.round(wantsPct * 10) / 10,
      savingsAmount: savings,
      savingsPct: Math.round(savingsPct * 10) / 10,
      modelName: "50/30/20",
    }),
    [takeHome, needs, wants, savings, needsPct, wantsPct, savingsPct]
  );

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <div className="space-y-6">
        {/* Income Allocation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Income Allocation</CardTitle>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Based on {formatCurrency(takeHome)}/month take-home
            </p>
          </CardHeader>
          <CardContent>
            <IncomeAllocationDonut
              needs={needs}
              wants={wants}
              savings={savings}
              total={takeHome}
              size={200}
            />
            <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-orange-500" aria-hidden />
                <span>
                  <span className="font-medium">Needs</span> {formatCurrency(needs)} ({Math.round(needsPct)}%)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-blue-500" aria-hidden />
                <span>
                  <span className="font-medium">Wants</span> {formatCurrency(wants)} ({Math.round(wantsPct)}%)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-green-600" aria-hidden />
                <span>
                  <span className="font-medium">Post-Tax Savings</span> {formatCurrency(savings)} ({Math.round(savingsPct)}%)
                </span>
              </div>
            </div>
            <Link
              href={`/app/adjust-plan?income=${takeHome}&targetSavings=${savings}&currentSavings=${savings}&returnTo=income`}
              className="mt-4 flex w-full items-center justify-center gap-2"
            >
              <Button variant="outline" size="sm" className="w-full">
                <Pencil className="h-3.5 w-3.5" />
                Edit income allocation
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Take-home pay card - matches design: header, two columns, details, Edit link */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
              Take-home pay
            </CardTitle>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-normal">
              Monthly estimate
            </p>
          </CardHeader>
          <CardContent className="space-y-0">
            {/* Two-column summary */}
            <div className="flex border-t border-slate-200 dark:border-slate-700">
              <div className="flex-1 py-4 pr-4 border-r border-slate-200 dark:border-slate-700">
                <p className="text-sm text-slate-500 dark:text-slate-400">Gross income</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">
                  {formatCurrency(grossIncome)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">per month</p>
              </div>
              <div className="flex-1 py-4 pl-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">Take-home</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">
                  {formatCurrency(takeHome)}
                </p>
                <p className="text-xs">
                  <span className="text-red-700 dark:text-red-400 font-medium">
                    {formatCurrency(-withheld)}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400"> withheld</span>
                </p>
              </div>
            </div>
            {/* Details rows */}
            <div className="border-t border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">
              <div className="flex justify-between items-center py-3">
                <span className="text-sm text-slate-900 dark:text-white">Tax (federal + state)</span>
                <span className="text-sm font-medium text-red-700 dark:text-red-400">
                  {formatCurrency(-tax)}
                </span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-sm text-slate-900 dark:text-white">Pre-tax deductions</span>
                <span className="text-sm font-medium text-red-700 dark:text-red-400">
                  {formatCurrency(-preTaxDeductions)}
                </span>
              </div>
            </div>
            {/* Edit link */}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-3 pb-1">
              <button
                type="button"
                onClick={() => setEditPayModalOpen(true)}
                className="w-full text-center text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Edit pay details
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Needs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Needs</CardTitle>
          </CardHeader>
          <CardContent>
            <DistributionSection
              title=""
              total={needs}
              items={MOCK_NEEDS_BREAKDOWN.map((item) => ({
                ...item,
                amount: Math.round((item.amount / 3405) * needs),
              }))}
              colorTheme="orange"
              sectionType="needs"
              totalIncome={takeHome}
              onChipClick={handleRibbitChipClick}
            />
          </CardContent>
        </Card>

        {/* Wants */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Wants</CardTitle>
          </CardHeader>
          <CardContent>
            <DistributionSection
              title=""
              total={wants}
              items={MOCK_WANTS_BREAKDOWN.map((item) => ({
                ...item,
                amount: Math.round((item.amount / 2043) * wants),
              }))}
              colorTheme="blue"
              sectionType="wants"
              totalIncome={takeHome}
              onChipClick={handleRibbitChipClick}
            />
          </CardContent>
        </Card>

        {/* Savings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Savings</CardTitle>
          </CardHeader>
          <CardContent>
            <SavingsBarsSection
              totalSavings={savings}
              preTaxItems={MOCK_PRE_TAX_ITEMS.map((item) => ({
                ...item,
                amount: Math.round((item.amount / 1362) * savings),
              }))}
              postTaxItems={MOCK_POST_TAX_ITEMS.filter((i) => i.amount > 0).map((item) => ({
                ...item,
                amount: Math.round((item.amount / 1362) * savings),
              }))}
            />
            <Link
              href={`/onboarding/savings-allocation?savings=${savings}&projected=2000000&returnTo=income`}
              className="mt-4 flex w-full items-center justify-center gap-2"
            >
              <Button variant="outline" size="sm" className="w-full">
                <Pencil className="h-3.5 w-3.5" />
                Edit savings
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Edit pay details modal */}
      {editPayModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-pay-modal-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-800">
            <h2 id="edit-pay-modal-title" className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              Edit pay details
            </h2>
            <form onSubmit={handleSavePayDetails} className="space-y-4">
              <div>
                <label htmlFor="gross" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Gross income (monthly)
                </label>
                <input
                  id="gross"
                  type="number"
                  min={0}
                  step={100}
                  value={grossIncome}
                  onChange={(e) => setGrossIncome(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="tax" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Tax (federal + state)
                </label>
                <input
                  id="tax"
                  type="number"
                  min={0}
                  step={50}
                  value={tax}
                  onChange={(e) => setTax(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="preTax" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Pre-tax deductions (401k, HSA, etc.)
                </label>
                <input
                  id="preTax"
                  type="number"
                  min={0}
                  step={50}
                  value={preTaxDeductions}
                  onChange={(e) => setPreTaxDeductions(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Take-home: {formatCurrency(Math.max(0, grossIncome - tax - preTaxDeductions))}/month
              </p>
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEditPayModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  Save
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <RibbitChat
        screenContext={ribbitScreenContext}
        chips={RIBBIT_SHEET_CHIPS}
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
    <Suspense fallback={<div className="mx-auto max-w-xl px-4 py-6 animate-pulse text-slate-500">Loading...</div>}>
      <IncomeContent />
    </Suspense>
  );
}
