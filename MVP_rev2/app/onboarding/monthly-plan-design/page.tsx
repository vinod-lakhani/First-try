/**
 * Monthly Plan Design (Onboarding) — replaced with Savings Helper (Income Plan).
 *
 * Shows the Income Plan in FIRST_TIME state. Once the user confirms
 * "Use this as my plan", we persist and navigate to payroll-contributions.
 */

'use client';

import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { IncomePlanContent } from '@/app/app/tools/savings-helper/IncomePlanContent';

export default function MonthlyPlanDesignPage() {
  const router = useRouter();
  const { setCurrentStep } = useOnboardingStore();

  const handleConfirmPlan = () => {
    setCurrentStep('payroll-contributions');
    router.push('/onboarding/payroll-contributions');
  };

  const handleContinueToNextStep = () => {
    setCurrentStep('payroll-contributions');
    router.push('/onboarding/payroll-contributions');
  };

  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <OnboardingProgress />
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-slate-600 dark:text-slate-400">Loading income plan...</p>
            </CardContent>
          </Card>
        </div>
      }
    >
      <div className="space-y-4">
        <OnboardingProgress />
        <IncomePlanContent
          hideScenario
          backHref="/onboarding/monthly-plan-current"
          onConfirmPlan={handleConfirmPlan}
          onContinueToNextStep={handleContinueToNextStep}
        />
      </div>
    </Suspense>
  );
}
