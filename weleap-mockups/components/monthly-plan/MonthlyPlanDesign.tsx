/**
 * Monthly Plan Design - Editable view for designing monthly plan
 * 
 * Allows user to adjust income, needs, and wants with sliders.
 */

'use client';

import { useState, useMemo, useEffect } from 'react';
import type { MouseEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Wallet, Home, Sparkles, PiggyBank } from 'lucide-react';
import { OnboardingChat } from '@/components/onboarding/OnboardingChat';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { useOnboardingStore } from '@/lib/onboarding/store';

export type MonthlyPlanDesignProps = {
  // Current (actual) values for reference
  currentIncome: number;
  currentNeeds: number;
  currentWants: number;
  // Recommended starting values for the plan (can initialize state from these)
  recommendedIncome?: number;
  recommendedNeeds?: number;
  recommendedWants?: number;
  onSave?: (plan: {
    income: number;
    needs: number;
    wants: number;
    savings: number;
  }) => void;
};

const MonthlyPlanDesign: React.FC<MonthlyPlanDesignProps> = ({
  currentIncome,
  currentNeeds,
  currentWants,
  recommendedIncome,
  recommendedNeeds,
  recommendedWants,
  onSave,
}) => {
  const store = useOnboardingStore();
  const [income, setIncome] = useState(recommendedIncome ?? currentIncome);
  const [needs, setNeeds] = useState(recommendedNeeds ?? currentNeeds);
  const [wants, setWants] = useState(recommendedWants ?? currentWants);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Debug: Log when dialog state changes
  useEffect(() => {
    console.log('[MonthlyPlanDesign] showConfirmDialog state:', showConfirmDialog);
  }, [showConfirmDialog]);

  // Derived values
  const expenses = needs + wants;
  const savings = income - expenses;
  const currentExpenses = currentNeeds + currentWants;
  const currentSavings = currentIncome - currentExpenses;

  const incomePercent = (value: number) => (income > 0 ? (value / income) * 100 : 0);
  const currentIncomePercent = (value: number) => (currentIncome > 0 ? (value / currentIncome) * 100 : 0);

  // Income slider range: 50% to 150% of current
  const incomeMin = Math.max(0, currentIncome * 0.5);
  const incomeMax = currentIncome * 1.5;
  const incomeStep = 100;

  // Needs/Wants sliders: 0 to income
  const needsMax = income;
  const wantsMax = income;

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatPercent = (percent: number) => {
    return `${percent.toFixed(1)}%`;
  };

  const handleIncomeChange = (value: number[]) => {
    const newIncome = value[0];
    setIncome(newIncome);
    // If needs + wants would exceed new income, scale them down proportionally
    const totalExpenses = needs + wants;
    if (totalExpenses > newIncome) {
      const scaleFactor = newIncome / totalExpenses;
      setNeeds(needs * scaleFactor);
      setWants(wants * scaleFactor);
    }
  };

  const handleNeedsChange = (value: number[]) => {
    const newNeeds = Math.min(value[0], income - wants); // Ensure needs + wants <= income
    setNeeds(newNeeds);
  };

  const handleWantsChange = (value: number[]) => {
    const newWants = Math.min(value[0], income - needs); // Ensure needs + wants <= income
    setWants(newWants);
  };

  const handleReset = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIncome(recommendedIncome ?? currentIncome);
    setNeeds(recommendedNeeds ?? currentNeeds);
    setWants(recommendedWants ?? currentWants);
  };

  const handleSave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Show confirmation dialog instead of immediately saving
    console.log('[MonthlyPlanDesign] handleSave called, showing confirmation dialog');
    setShowConfirmDialog(true);
  };

  const handleConfirmSave = () => {
    try {
      // Calculate percentages
      const needsPct = income > 0 ? needs / income : 0;
      const wantsPct = income > 0 ? wants / income : 0;
      const savingsPct = income > 0 ? savings / income : 0;

      // Update risk constraints (targets and actuals3m) so savings plan uses updated data
      const savedDistribution = {
        needsPct,
        wantsPct,
        savingsPct,
      };

      if (store.riskConstraints) {
        // Update both targets and actuals3m to the same values
        // Set bypassWantsFloor=true to preserve exact values without normalization
        store.updateRiskConstraints({
          targets: savedDistribution,
          actuals3m: savedDistribution, // Set to match targets so engine returns as-is
          bypassWantsFloor: true, // Preserve exact values
        });
      } else {
        // If riskConstraints doesn't exist, create it with the saved distribution
        store.setRiskConstraints({
          targets: savedDistribution,
          actuals3m: savedDistribution, // Set to match targets so engine returns as-is
          shiftLimitPct: 0.04,
          bypassWantsFloor: true, // Preserve exact values
        });
      }

      // Clear the initial paycheck plan to force recalculation
      store.setInitialPaycheckPlan(undefined as any);

      // Now call the original onSave callback
      onSave?.({ income, needs, wants, savings });
      setShowConfirmDialog(false);
    } catch (error) {
      console.error('[MonthlyPlanDesign] Error in handleConfirmSave:', error);
      setShowConfirmDialog(false);
    }
  };

  const handleCancelSave = () => {
    setShowConfirmDialog(false);
  };

  // Calculate current reference positions for sliders (as percentages of slider max)
  const currentNeedsPercent = needsMax > 0 ? (currentNeeds / needsMax) * 100 : 0;
  const currentWantsPercent = wantsMax > 0 ? (currentWants / wantsMax) * 100 : 0;

  return (
    <div className="min-h-screen bg-background flex items-start justify-center">
      <div className="w-full max-w-md sm:max-w-lg lg:max-w-xl px-4 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-6">
        {/* Progress Bar */}
        <div className="mb-2">
          <OnboardingProgress />
        </div>
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-center text-slate-900 dark:text-white">
            Allocate Income to Savings
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
            Here&apos;s the plan Ribbit suggests based on your current spending. You can tweak the big levers — income, needs, and wants — and we&apos;ll update your savings automatically.
          </p>
        </div>

        {/* Current vs Plan Summary Bar */}
        <Card className="rounded-xl border p-4 bg-slate-50 dark:bg-slate-800">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Current</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-700 dark:text-slate-300">Income:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(currentIncome)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-700 dark:text-slate-300">Expenses:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(currentExpenses)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-700 dark:text-slate-300">Savings:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(currentSavings)}</span>
              </div>
            </div>
            <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Plan</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-700 dark:text-slate-300">Income:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(income)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-700 dark:text-slate-300">Expenses:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(expenses)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-700 dark:text-slate-300">Savings:</span>
                <span className={`font-semibold ${savings >= currentSavings ? 'text-green-600 dark:text-green-400' : 'text-slate-900 dark:text-white'}`}>
                  {formatCurrency(savings)}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Income (Editable) */}
        <Card className="rounded-2xl border p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
              <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Income</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Current: {formatCurrency(currentIncome)}
              </p>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-slate-900 dark:text-white">
                {formatCurrency(income)} / month
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {formatPercent(currentIncomePercent(income))}
              </span>
            </div>
            
            <div className="relative">
              <Slider
                value={[income]}
                onValueChange={handleIncomeChange}
                min={incomeMin}
                max={incomeMax}
                step={incomeStep}
                className="w-full"
              />
            </div>
          </div>
        </Card>

        {/* Expenses Section */}
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Expenses</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {formatCurrency(expenses)} / month
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {formatPercent(incomePercent(expenses))} of income
            </p>
          </div>

          {/* Needs Slider */}
          <Card className="rounded-xl border p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                <Home className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Needs</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Current: {formatCurrency(currentNeeds)} ({formatPercent(currentIncomePercent(currentNeeds))} of income)
                </p>
              </div>
            </div>
            
              <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(needs)}
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {formatPercent(incomePercent(needs))}
                </span>
              </div>
              
              <div className="relative py-3">
                <Slider
                  value={[needs]}
                  onValueChange={handleNeedsChange}
                  min={0}
                  max={needsMax}
                  step={50}
                  className="w-full"
                />
                {/* Current reference marker */}
                {currentNeeds > 0 && currentNeeds <= needsMax && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 pointer-events-none z-10"
                    style={{ left: `${Math.min(Math.max((currentNeeds / needsMax) * 100, 1), 99)}%` }}
                  >
                    <div className="relative">
                      <div className="w-0.5 h-6 bg-slate-400 border-l-2 border-dashed"></div>
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-slate-500 whitespace-nowrap">
                        Current
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Wants Slider */}
          <Card className="rounded-xl border p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center shrink-0">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Wants</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Current: {formatCurrency(currentWants)} ({formatPercent(currentIncomePercent(currentWants))} of income)
                </p>
              </div>
            </div>
            
              <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(wants)}
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {formatPercent(incomePercent(wants))}
                </span>
              </div>
              
              <div className="relative py-3">
                <Slider
                  value={[wants]}
                  onValueChange={handleWantsChange}
                  min={0}
                  max={wantsMax}
                  step={50}
                  className="w-full"
                />
                {/* Current reference marker */}
                {currentWants > 0 && currentWants <= wantsMax && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 pointer-events-none z-10"
                    style={{ left: `${Math.min(Math.max((currentWants / wantsMax) * 100, 1), 99)}%` }}
                  >
                    <div className="relative">
                      <div className="w-0.5 h-6 bg-slate-400 border-l-2 border-dashed"></div>
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-slate-500 whitespace-nowrap">
                        Current
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Savings (Auto-calculated) */}
        <Card className="rounded-2xl border p-4">
          <div className="flex items-start gap-3">
            <div className="mt-1 h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center shrink-0">
              <PiggyBank className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Savings</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {formatCurrency(savings)} / month
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                ({formatPercent(incomePercent(savings))} of income)
              </p>
              {savings !== currentSavings && (
                <p className={`text-xs mt-1 ${savings > currentSavings ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {savings > currentSavings ? '+' : ''}{formatCurrency(savings - currentSavings)} vs your current savings
                </p>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Savings go up when income rises or expenses fall, and vice versa. Our goal is to help you grow savings without making your life miserable.
              </p>
            </div>
          </div>
        </Card>

        {/* Plan Notes (Optional) */}
        {savings > currentSavings && (
          <Card className="rounded-xl border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20 p-3">
            <p className="text-sm text-green-800 dark:text-green-200">
              ✓ Savings at or above target.
            </p>
          </Card>
        )}

        {/* CTA Buttons */}
        <div className="space-y-3 pt-4">
          <Button 
            onClick={handleSave} 
            size="lg" 
            className="w-full"
            disabled={showConfirmDialog}
          >
            {showConfirmDialog ? 'Reviewing Changes...' : 'Allocate my savings'}
          </Button>
          {!showConfirmDialog && (
            <Button
              variant="ghost"
              size="lg"
              className="w-full"
              onClick={handleReset}
            >
              Reset to Recommended
            </Button>
          )}
        </div>

        {/* Confirmation Dialog */}
        {showConfirmDialog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={(e) => {
            // Close dialog if clicking on backdrop
            if (e.target === e.currentTarget) {
              handleCancelSave();
            }
          }}>
            <Card className="w-full max-w-md z-[101]" onClick={(e) => e.stopPropagation()}>
              <CardHeader>
                <CardTitle className="text-xl">Confirm Changes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Please review the changes before applying them to your plan:
                </p>
                
                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                  {/* Needs */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Needs:</span>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(currentNeeds)} → {formatCurrency(needs)}
                      </span>
                      <span className="ml-2 text-xs text-slate-500">
                        ({formatPercent((needs / income) * 100)})
                      </span>
                    </div>
                  </div>
                  
                  {/* Wants */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Wants:</span>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(currentWants)} → {formatCurrency(wants)}
                      </span>
                      <span className="ml-2 text-xs text-slate-500">
                        ({formatPercent((wants / income) * 100)})
                      </span>
                    </div>
                  </div>
                  
                  {/* Savings */}
                  <div className="flex items-center justify-between border-t border-slate-300 pt-2 dark:border-slate-600">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">Savings:</span>
                    <div className="text-right">
                      <span className={`text-sm font-semibold ${savings >= (currentIncome - currentNeeds - currentWants) ? 'text-green-600 dark:text-green-400' : 'text-slate-900 dark:text-white'}`}>
                        {formatCurrency(currentIncome - currentNeeds - currentWants)} → {formatCurrency(savings)}
                      </span>
                      <span className="ml-2 text-xs text-slate-500">
                        ({formatPercent((savings / income) * 100)})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={handleCancelSave}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConfirmSave}
                    className="flex-1"
                  >
                    Confirm & Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Floating Ribbit Chat Button */}
        <OnboardingChat context="monthly-plan-design" />
      </div>
    </div>
  );
};

export default MonthlyPlanDesign;

