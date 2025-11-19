/**
 * Onboarding - Income Step
 * 
 * Step 2: Collect income information (per paycheck or per month).
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useOnboardingStore } from '@/lib/onboarding/store';
import type { PayFrequency } from '@/lib/onboarding/types';

export default function IncomePage() {
  const router = useRouter();
  const { income, setIncome, setCurrentStep } = useOnboardingStore();
  
  const [isPerPaycheck, setIsPerPaycheck] = useState(true);
  const [isTakeHomePay, setIsTakeHomePay] = useState(true); // true = take home (post-tax), false = gross (pre-tax)
  const [amount, setAmount] = useState<number>(income?.netIncome$ || income?.grossIncome$ || 0);
  const [payFrequency, setPayFrequency] = useState<PayFrequency>(
    income?.payFrequency || 'biweekly'
  );

  // Initialize from store if available
  useEffect(() => {
    if (income) {
      // Prefer netIncome$ if available, otherwise use grossIncome$
      setAmount(income.netIncome$ || income.grossIncome$ || 0);
      setPayFrequency(income.payFrequency);
      // If we have netIncome$, assume it's take home pay
      setIsTakeHomePay(!!income.netIncome$);
      // Determine if it's per paycheck based on existing data
      // For now, default to per paycheck
      setIsPerPaycheck(true);
    }
  }, [income]);

  const handleContinue = () => {
    if (amount > 0) {
      const annualAmount = isPerPaycheck
        ? calculateAnnualFromPaycheck(amount, payFrequency)
        : amount * 12;
      
      const incomeState = {
        // Store both gross and net based on what user selected
        grossIncome$: isTakeHomePay ? 0 : amount, // If user entered gross, store it
        netIncome$: isTakeHomePay ? amount : 0, // If user entered take home, store it
        payFrequency: isPerPaycheck ? payFrequency : 'monthly',
        // Calculate annual if needed
        annualSalary$: annualAmount,
        incomeSingle$: annualAmount,
      };
      
      setIncome(incomeState);
    }
    setCurrentStep('plaid');
    router.push('/onboarding/plaid');
  };

  const handleConnectBank = () => {
    setCurrentStep('plaid');
    router.push('/onboarding/plaid');
  };

  const handleSkip = () => {
    setCurrentStep('plaid');
    router.push('/onboarding/plaid');
  };

  return (
    <Card className="w-full">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl sm:text-3xl font-bold">
          What's your income?
        </CardTitle>
        <CardDescription className="text-base">
          Rough number is totally fine – you can refine this later.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Toggle: Gross Income / Take Home Pay */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Income type
          </label>
          <div className="flex rounded-lg border bg-slate-50 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setIsTakeHomePay(true)}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                isTakeHomePay
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Take Home Pay
              <span className="block text-xs font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                Post-tax
              </span>
            </button>
            <button
              type="button"
              onClick={() => setIsTakeHomePay(false)}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                !isTakeHomePay
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Gross Income
              <span className="block text-xs font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                Pre-tax
              </span>
            </button>
          </div>
        </div>

        {/* Toggle: Per paycheck / Per month */}
        <div className="flex rounded-lg border bg-slate-50 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setIsPerPaycheck(true)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              isPerPaycheck
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Per paycheck
          </button>
          <button
            type="button"
            onClick={() => setIsPerPaycheck(false)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              !isPerPaycheck
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Per month
          </button>
        </div>

        {/* Amount Input */}
        <div className="space-y-2">
          <label htmlFor="amount" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {isPerPaycheck 
              ? `${isTakeHomePay ? 'Take home' : 'Gross'} paycheck amount`
              : `${isTakeHomePay ? 'Take home' : 'Gross'} monthly amount`
            }
          </label>
          {isTakeHomePay && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              This is your income after taxes and deductions
            </p>
          )}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
            <input
              id="amount"
              type="number"
              value={amount || ''}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 pl-8 text-lg font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              min="0"
              step="0.01"
            />
          </div>
        </div>

        {/* Pay Frequency Select (only if per paycheck) */}
        {isPerPaycheck && (
          <div className="space-y-2">
            <label htmlFor="payFrequency" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              How often do you get paid?
            </label>
            <select
              id="payFrequency"
              value={payFrequency}
              onChange={(e) => setPayFrequency(e.target.value as PayFrequency)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Every 2 weeks</option>
              <option value="semimonthly">Twice a month</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 pt-4">
          <Button
            onClick={handleContinue}
            size="lg"
            className="w-full"
            disabled={amount <= 0}
          >
            Continue
          </Button>
          
          <Button
            onClick={handleConnectBank}
            variant="outline"
            size="lg"
            className="w-full"
          >
            I'm not sure → Connect my bank instead
          </Button>
          
          <Button
            onClick={handleSkip}
            variant="ghost"
            size="lg"
            className="w-full"
          >
            Skip for now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Calculate annual salary from paycheck amount and frequency
 */
function calculateAnnualFromPaycheck(amount: number, frequency: PayFrequency): number {
  switch (frequency) {
    case 'weekly':
      return amount * 52;
    case 'biweekly':
      return amount * 26;
    case 'semimonthly':
      return amount * 24;
    case 'monthly':
      return amount * 12;
    default:
      return amount * 12;
  }
}

