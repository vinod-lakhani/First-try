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

export default function IncomePage() {
  const router = useRouter();
  const { income, setIncome, setCurrentStep } = useOnboardingStore();
  
  const [isTakeHomePay, setIsTakeHomePay] = useState(true); // true = take home (post-tax), false = gross (pre-tax)
  const [amount, setAmount] = useState<number>(income?.netIncome$ || income?.grossIncome$ || 0);

  // Initialize from store if available
  useEffect(() => {
    if (income) {
      // Prefer netIncome$ if available, otherwise use grossIncome$
      setAmount(income.netIncome$ || income.grossIncome$ || 0);
      // If we have netIncome$, assume it's take home pay
      setIsTakeHomePay(!!income.netIncome$);
    }
  }, [income]);

  const handleContinue = () => {
    if (amount > 0) {
      const monthlyAmount = amount;
      const annualAmount = monthlyAmount * 12;
      
      const incomeState = {
        // Store both gross and net based on what user selected
        grossIncome$: isTakeHomePay ? 0 : monthlyAmount, // If user entered gross, store it
        netIncome$: isTakeHomePay ? monthlyAmount : 0, // If user entered take home, store it
        payFrequency: 'monthly' as const,
        // Calculate annual if needed
        annualSalary$: annualAmount,
        incomeSingle$: annualAmount,
      };
      
      setIncome(incomeState);
    }
    setCurrentStep('plaid-consent');
    router.push('/onboarding/plaid-consent');
  };

  const handleConnectBank = () => {
    setCurrentStep('plaid-consent');
    router.push('/onboarding/plaid-consent');
  };

  const handleSkip = () => {
    setCurrentStep('plaid-consent');
    router.push('/onboarding/plaid-consent');
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

        {/* Amount Input */}
        <div className="space-y-2">
          <label htmlFor="amount" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {`${isTakeHomePay ? 'Take home' : 'Gross'} monthly amount`}
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

