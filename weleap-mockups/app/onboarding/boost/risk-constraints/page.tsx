/**
 * Onboarding - Risk & Constraints Micro-Flow
 * 
 * Phase 10: Set risk tolerance and financial constraints.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useOnboardingStore } from '@/lib/onboarding/store';
import type { RiskConstraints } from '@/lib/onboarding/types';
import { Save, AlertTriangle, Clock, DollarSign } from 'lucide-react';

const riskLabels = [
  { value: 1, label: 'Very Conservative', description: 'Minimal risk, prioritize safety' },
  { value: 2, label: 'Conservative', description: 'Low risk, stable growth' },
  { value: 3, label: 'Moderate', description: 'Balanced risk and return' },
  { value: 4, label: 'Aggressive', description: 'Higher risk for higher returns' },
  { value: 5, label: 'Very Aggressive', description: 'Maximum risk tolerance' },
];

const timeHorizonOptions = [
  { value: 'short' as const, label: 'Short Term', description: '0-3 years' },
  { value: 'medium' as const, label: 'Medium Term', description: '3-10 years' },
  { value: 'long' as const, label: 'Long Term', description: '10+ years' },
];

export default function RiskConstraintsPage() {
  const router = useRouter();
  const {
    riskConstraints,
    setRiskConstraints,
    updateRiskConstraints,
  } = useOnboardingStore();

  const [riskScore, setRiskScore] = useState<number>(
    riskConstraints?.riskScore1to5 || 3
  );
  const [timeHorizon, setTimeHorizon] = useState<RiskConstraints['dominantTimeHorizon']>(
    riskConstraints?.dominantTimeHorizon || 'medium'
  );
  const [minCheckingBuffer, setMinCheckingBuffer] = useState<number>(
    riskConstraints?.minCheckingBuffer$ || 0
  );
  const [minCashPct, setMinCashPct] = useState<number>(
    riskConstraints?.minCashPct || 0
  );

  useEffect(() => {
    if (riskConstraints) {
      setRiskScore(riskConstraints.riskScore1to5 || 3);
      setTimeHorizon(riskConstraints.dominantTimeHorizon || 'medium');
      setMinCheckingBuffer(riskConstraints.minCheckingBuffer$ || 0);
      setMinCashPct(riskConstraints.minCashPct || 0);
    }
  }, [riskConstraints]);

  const handleSave = () => {
    const constraints: RiskConstraints = {
      shiftLimitPct: riskConstraints?.shiftLimitPct || 0.04,
      targets: riskConstraints?.targets || {
        needsPct: 0.5,
        wantsPct: 0.3,
        savingsPct: 0.2,
      },
      actuals3m: riskConstraints?.actuals3m,
      assumptions: riskConstraints?.assumptions,
      riskScore1to5: riskScore,
      dominantTimeHorizon: timeHorizon,
      minCheckingBuffer$: minCheckingBuffer,
      minCashPct: minCashPct,
    };

    if (riskConstraints) {
      updateRiskConstraints(constraints);
    } else {
      setRiskConstraints(constraints);
    }

    router.push('/onboarding/boost');
  };

  const currentRiskLabel = riskLabels.find((r) => r.value === riskScore);

  return (
    <Card className="w-full">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl sm:text-3xl font-bold">
          Risk & Constraints
        </CardTitle>
        <CardDescription className="text-base">
          Set your risk tolerance and financial constraints for personalized recommendations.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Risk Score Card */}
        <div className="rounded-lg border bg-white p-6 dark:bg-slate-800">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Risk Tolerance
            </h3>
          </div>

          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {currentRiskLabel?.label || 'Moderate'}
              </span>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {riskScore}/5
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={riskScore}
              onChange={(e) => setRiskScore(parseInt(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 dark:bg-slate-700"
              style={{
                accentColor: '#3b82f6',
              }}
            />
            <div className="mt-2 flex justify-between text-xs text-slate-500">
              <span>Very Conservative</span>
              <span>Very Aggressive</span>
            </div>
            {currentRiskLabel && (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {currentRiskLabel.description}
              </p>
            )}
          </div>
        </div>

        {/* Time Horizon Card */}
        <div className="rounded-lg border bg-white p-6 dark:bg-slate-800">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Time Horizon
            </h3>
          </div>

          <div className="space-y-3">
            {timeHorizonOptions.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                  timeHorizon === option.value
                    ? 'border-primary bg-primary/5 dark:bg-primary/10'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="time-horizon"
                  value={option.value}
                  checked={timeHorizon === option.value}
                  onChange={() => setTimeHorizon(option.value)}
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

        {/* Constraints Card */}
        <div className="rounded-lg border bg-white p-6 dark:bg-slate-800">
          <div className="mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Financial Constraints
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Minimum Checking Buffer
              </label>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Keep at least this amount in checking at all times
              </p>
              <div className="relative mt-2">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-slate-500 sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={minCheckingBuffer || ''}
                  onChange={(e) =>
                    setMinCheckingBuffer(parseFloat(e.target.value) || 0)
                  }
                  placeholder="0.00"
                  className="block w-full rounded-md border-slate-300 pl-7 pr-3 py-2 text-sm focus:border-primary focus:ring-primary dark:bg-slate-700 dark:border-slate-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Minimum Cash Percentage
              </label>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Keep at least this percentage of assets in cash (0-100%)
              </p>
              <div className="mt-2">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {minCashPct}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={minCashPct}
                  onChange={(e) => setMinCashPct(parseInt(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 dark:bg-slate-700"
                  style={{
                    accentColor: '#3b82f6',
                  }}
                />
                <div className="mt-2 flex justify-between text-xs text-slate-500">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
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

