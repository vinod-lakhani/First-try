"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DistributionSection } from "@/components/income/DistributionSection";
import { SavingsBarsSection } from "@/components/income/SavingsBarsSection";
import { IncomeAllocationDonut } from "@/components/charts/IncomeAllocationDonut";
import { RibbitChat } from "@/components/onboarding/RibbitChat";
import type { IncomeScreenContext } from "@/lib/ribbit/types";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

// Mock data - 50/30/20 allocation
const MOCK_MONTHLY_TAKE_HOME = 6810;
const MOCK_GROSS_INCOME = 8500;
const MOCK_NEEDS = 3405;
const MOCK_WANTS = 2043;
const MOCK_SAVINGS = 1362;
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

export default function IncomePage() {
  const [ribbitOpen, setRibbitOpen] = useState(false);
  const [ribbitInitialQuestion, setRibbitInitialQuestion] = useState<string | null>(null);

  const handleRibbitChipClick = (question: string) => {
    setRibbitInitialQuestion(question);
    setRibbitOpen(true);
  };

  const needsPct = (MOCK_NEEDS / MOCK_MONTHLY_TAKE_HOME) * 100;
  const wantsPct = (MOCK_WANTS / MOCK_MONTHLY_TAKE_HOME) * 100;
  const savingsPct = (MOCK_SAVINGS / MOCK_MONTHLY_TAKE_HOME) * 100;

  const ribbitScreenContext: IncomeScreenContext = useMemo(
    () => ({
      screen: "income",
      onboardingStage: "income",
      hasLinkedAccounts: false,
      source: "estimated_from_income",
      monthlyIncome: MOCK_MONTHLY_TAKE_HOME,
      needsAmount: MOCK_NEEDS,
      needsPct: Math.round(needsPct * 10) / 10,
      wantsAmount: MOCK_WANTS,
      wantsPct: Math.round(wantsPct * 10) / 10,
      savingsAmount: MOCK_SAVINGS,
      savingsPct: Math.round(savingsPct * 10) / 10,
      modelName: "50/30/20",
    }),
    [needsPct, wantsPct, savingsPct]
  );

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <div className="space-y-6">
        {/* Income Allocation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Income Allocation</CardTitle>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Based on {formatCurrency(MOCK_MONTHLY_TAKE_HOME)}/month take-home
            </p>
          </CardHeader>
          <CardContent>
            <IncomeAllocationDonut
              needs={MOCK_NEEDS}
              wants={MOCK_WANTS}
              savings={MOCK_SAVINGS}
              total={MOCK_MONTHLY_TAKE_HOME}
              size={200}
            />
            <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-orange-500" aria-hidden />
                <span>
                  <span className="font-medium">Needs</span> {formatCurrency(MOCK_NEEDS)} ({Math.round(needsPct)}%)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-blue-500" aria-hidden />
                <span>
                  <span className="font-medium">Wants</span> {formatCurrency(MOCK_WANTS)} ({Math.round(wantsPct)}%)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-green-600" aria-hidden />
                <span>
                  <span className="font-medium">Post-Tax Savings</span> {formatCurrency(MOCK_SAVINGS)} ({Math.round(savingsPct)}%)
                </span>
              </div>
            </div>
            <Link
              href={`/app/adjust-plan?income=${MOCK_MONTHLY_TAKE_HOME}&targetSavings=${MOCK_SAVINGS}&currentSavings=${MOCK_SAVINGS}&returnTo=income`}
              className="mt-4 flex w-full items-center justify-center gap-2"
            >
              <Button variant="outline" size="sm" className="w-full">
                <Pencil className="h-3.5 w-3.5" />
                Edit income allocation
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Take Home Pay Estimation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Take Home Pay Estimation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Take Home Pay /month</p>
                <p className="text-lg font-semibold">{formatCurrency(MOCK_MONTHLY_TAKE_HOME)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Gross Income /month</p>
                <p className="text-lg font-semibold">{formatCurrency(MOCK_GROSS_INCOME)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Tax /month</p>
                <p className="text-lg font-semibold">-{formatCurrency(1200)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Deductions /month</p>
                <p className="text-lg font-semibold">-{formatCurrency(490)}</p>
              </div>
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
              total={MOCK_NEEDS}
              items={MOCK_NEEDS_BREAKDOWN}
              colorTheme="orange"
              sectionType="needs"
              totalIncome={MOCK_MONTHLY_TAKE_HOME}
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
              total={MOCK_WANTS}
              items={MOCK_WANTS_BREAKDOWN}
              colorTheme="blue"
              sectionType="wants"
              totalIncome={MOCK_MONTHLY_TAKE_HOME}
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
              totalSavings={MOCK_SAVINGS}
              preTaxItems={MOCK_PRE_TAX_ITEMS}
              postTaxItems={MOCK_POST_TAX_ITEMS.filter((i) => i.amount > 0)}
            />
            <Link
              href={`/onboarding/savings-allocation?savings=${MOCK_SAVINGS}&projected=2000000&returnTo=income`}
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
