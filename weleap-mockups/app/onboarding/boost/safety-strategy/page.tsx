/**
 * Onboarding - Safety & Strategy Micro-Flow
 * 
 * Phase 9: Set emergency fund target and debt payoff strategy.
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useOnboardingStore } from '@/lib/onboarding/store';
import type { SafetyStrategy } from '@/lib/onboarding/types';
import { Save, Shield, TrendingDown } from 'lucide-react';

const efTargetOptions = [
  { value: 1, label: '1-2 months', months: 1.5 },
  { value: 3, label: '3 months', months: 3 },
  { value: 4, label: '4-6 months', months: 5 },
  { value: 6, label: '6+ months', months: 6 },
];

const debtStrategyOptions = [
  {
    value: 'avalanche' as const,
    label: 'Avalanche Method',
    description: 'Pay highest APR first - saves the most money',
  },
  {
    value: 'snowball' as const,
    label: 'Snowball Method',
    description: 'Pay smallest balance first - quick wins',
  },
  {
    value: 'minimum_only' as const,
    label: 'Minimum Payments Only',
    description: 'Focus on other goals, pay minimums',
  },
];

export default function SafetyStrategyPage() {
  const router = useRouter();
  const {
    safetyStrategy,
    fixedExpenses,
    assets,
    setSafetyStrategy,
    updateSafetyStrategy,
  } = useOnboardingStore();

  const [efTargetMonths, setEfTargetMonths] = useState<number>(
    safetyStrategy?.efTargetMonths || 3
  );
  const [debtStrategy, setDebtStrategy] = useState<SafetyStrategy['debtPayoffStrategy']>(
    safetyStrategy?.debtPayoffStrategy || 'avalanche'
  );

  // Calculate current emergency fund from cash assets
  const currentEfBalance = useMemo(() => {
    return assets
      .filter((a) => a.type === 'cash')
      .reduce((sum, a) => sum + a.value$, 0);
  }, [assets]);

  // Estimate monthly basics from fixed expenses
  const monthlyBasics = useMemo(() => {
    return fixedExpenses
      .filter((e) => e.category === 'needs')
      .reduce((sum, e) => {
        let monthly = e.amount$;
        if (e.frequency === 'weekly') monthly = e.amount$ * 4.33;
        else if (e.frequency === 'biweekly') monthly = e.amount$ * 2.17;
        else if (e.frequency === 'semimonthly') monthly = e.amount$ * 2;
        else if (e.frequency === 'yearly') monthly = e.amount$ / 12;
        return sum + monthly;
      }, 0);
  }, [fixedExpenses]);

  const currentMonthsSaved = useMemo(() => {
    if (monthlyBasics === 0) return 0;
    return currentEfBalance / monthlyBasics;
  }, [currentEfBalance, monthlyBasics]);

  useEffect(() => {
    if (safetyStrategy) {
      setEfTargetMonths(safetyStrategy.efTargetMonths);
      setDebtStrategy(safetyStrategy.debtPayoffStrategy);
    }
  }, [safetyStrategy]);

  const handleSave = () => {
    const selectedOption = efTargetOptions.find((opt) => opt.value === efTargetMonths);
    const targetMonths = selectedOption?.months || efTargetMonths;

    const strategy: SafetyStrategy = {
      efTargetMonths: targetMonths,
      efBalance$: currentEfBalance,
      liquidity: safetyStrategy?.liquidity || 'Medium',
      retirementFocus: safetyStrategy?.retirementFocus || 'Medium',
      onIDR: safetyStrategy?.onIDR || false,
      debtPayoffStrategy: debtStrategy,
    };

    if (safetyStrategy) {
      updateSafetyStrategy(strategy);
    } else {
      setSafetyStrategy(strategy);
    }

    router.push('/onboarding/boost');
  };

  return (
    <Card className="w-full">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl sm:text-3xl font-bold">
          Safety & Strategy
        </CardTitle>
        <CardDescription className="text-base">
          Set your emergency fund target and debt payoff strategy.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Emergency Fund Card */}
        <div className="rounded-lg border bg-white p-6 dark:bg-slate-800">
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Emergency Fund Target
            </h3>
          </div>

          {monthlyBasics > 0 && (
            <div className="mb-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-700">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                You currently have about{' '}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {currentMonthsSaved.toFixed(1)} months
                </span>{' '}
                saved (${currentEfBalance.toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })} ÷ ${monthlyBasics.toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}/month)
              </p>
            </div>
          )}

          <div className="space-y-3">
            {efTargetOptions.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                  efTargetMonths === option.value
                    ? 'border-primary bg-primary/5 dark:bg-primary/10'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="ef-target"
                  value={option.value}
                  checked={efTargetMonths === option.value}
                  onChange={() => setEfTargetMonths(option.value)}
                  className="mt-1 h-4 w-4 text-primary focus:ring-primary"
                />
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {option.label}
                  </span>
                  {monthlyBasics > 0 && (
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      Target: ${(monthlyBasics * option.months).toLocaleString('en-US', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Debt Strategy Card */}
        <div className="rounded-lg border bg-white p-6 dark:bg-slate-800">
          <div className="mb-4 flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Debt Payoff Strategy
            </h3>
          </div>

          <div className="space-y-3">
            {debtStrategyOptions.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                  debtStrategy === option.value
                    ? 'border-primary bg-primary/5 dark:bg-primary/10'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="debt-strategy"
                  value={option.value}
                  checked={debtStrategy === option.value}
                  onChange={() => setDebtStrategy(option.value)}
                  className="mt-1 h-4 w-4 text-primary focus:ring-primary"
                />
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {option.label}
                  </span>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {option.description}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-4">
          <Button onClick={handleSave} size="lg" className="w-full">
            <Save className="mr-2 h-4 w-4" />
            Save & Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

