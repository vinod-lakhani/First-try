/**
 * Onboarding - Primary Goal Step
 * 
 * Step 5: Select primary financial goal and optional secondary goals.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useOnboardingStore } from '@/lib/onboarding/store';
import type { PrimaryGoal } from '@/lib/onboarding/types';
import { Target, TrendingUp, Shield, Home, HelpCircle } from 'lucide-react';

const goalOptions: Array<{
  value: PrimaryGoal;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'emergency-fund',
    label: 'Build Savings',
    description: 'Create a safety net for unexpected expenses',
    icon: <Shield className="h-5 w-5" />,
  },
  {
    value: 'debt-free',
    label: 'Pay Off Debt',
    description: 'Eliminate high-interest debt and become debt-free',
    icon: <TrendingUp className="h-5 w-5" />,
  },
  {
    value: 'retirement',
    label: 'Grow Investments',
    description: 'Build long-term wealth through retirement accounts',
    icon: <Target className="h-5 w-5" />,
  },
  {
    value: 'house-down-payment',
    label: 'Build Buffer',
    description: 'Save for a major purchase like a house down payment',
    icon: <Home className="h-5 w-5" />,
  },
  {
    value: 'other',
    label: "I'm Not Sure",
    description: 'Get personalized recommendations based on your situation',
    icon: <HelpCircle className="h-5 w-5" />,
  },
];

export default function GoalPage() {
  const router = useRouter();
  const { primaryGoal, goals, setPrimaryGoal, setGoals, setCurrentStep } = useOnboardingStore();

  const [selectedPrimary, setSelectedPrimary] = useState<PrimaryGoal | undefined>(primaryGoal);
  const [selectedSecondary, setSelectedSecondary] = useState<Set<PrimaryGoal>>(
    new Set(goals.filter(g => g.type !== primaryGoal).map(g => g.type))
  );

  const handleContinue = () => {
    if (!selectedPrimary) {
      // If no primary selected, default to "other"
      setSelectedPrimary('other');
    }

    const primary = selectedPrimary || 'other';
    setPrimaryGoal(primary);

    // Convert secondary selections to Goal objects
    const secondaryGoals = Array.from(selectedSecondary)
      .filter(goal => goal !== primary)
      .map((goal, idx) => ({
        id: `goal-${idx}`,
        type: goal,
        name: goalOptions.find(o => o.value === goal)?.label || goal,
        priority: idx + 2, // Primary is 1, secondaries start at 2
      }));

    setGoals([
      {
        id: 'goal-primary',
        type: primary,
        name: goalOptions.find(o => o.value === primary)?.label || primary,
        priority: 1,
      },
      ...secondaryGoals,
    ]);

    setCurrentStep('plan-preview');
    router.push('/onboarding/plan-preview');
  };

  const toggleSecondary = (goal: PrimaryGoal) => {
    const newSet = new Set(selectedSecondary);
    if (newSet.has(goal)) {
      newSet.delete(goal);
    } else {
      newSet.add(goal);
    }
    setSelectedSecondary(newSet);
  };

  return (
    <Card className="w-full">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl sm:text-3xl font-bold">
          What's your main financial goal?
        </CardTitle>
        <CardDescription className="text-base">
          Choose your primary focus. You can add secondary goals too.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Primary Goal Selection */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Primary Goal
          </h3>
          {goalOptions.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                selectedPrimary === option.value
                  ? 'border-primary bg-primary/5 dark:bg-primary/10'
                  : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600'
              }`}
            >
              <input
                type="radio"
                name="primary-goal"
                value={option.value}
                checked={selectedPrimary === option.value}
                onChange={() => setSelectedPrimary(option.value)}
                className="mt-1 h-4 w-4 text-primary focus:ring-primary"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-primary">{option.icon}</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {option.label}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {option.description}
                </p>
              </div>
            </label>
          ))}
        </div>

        {/* Secondary Goals (Optional) */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Secondary Goals (Optional)
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Select any additional goals you'd like to work toward.
          </p>
          <div className="space-y-2">
            {goalOptions
              .filter(opt => opt.value !== selectedPrimary)
              .map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                    selectedSecondary.has(option.value)
                      ? 'border-primary bg-primary/5 dark:bg-primary/10'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedSecondary.has(option.value)}
                    onChange={() => toggleSecondary(option.value)}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <span className="font-medium text-slate-900 dark:text-white">
                    {option.label}
                  </span>
                </label>
              ))}
          </div>
        </div>

        {/* Continue Button */}
        <div className="pt-4">
          <Button onClick={handleContinue} size="lg" className="w-full">
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

