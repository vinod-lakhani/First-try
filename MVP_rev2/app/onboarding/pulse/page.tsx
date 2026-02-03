/**
 * Onboarding - Pulse Preferences Step
 * 
 * Final step: Opt into weekly Pulse summaries and smart recommendation alerts.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useOnboardingStore } from '@/lib/onboarding/store';
import type { PulsePreferences } from '@/lib/onboarding/types';
import { CheckCircle2, Bell, Mail } from 'lucide-react';

export default function PulsePage() {
  const router = useRouter();
  const {
    pulsePreferences,
    setPulsePreferences,
    setComplete,
    setCurrentStep,
  } = useOnboardingStore();

  const [weeklyPulse, setWeeklyPulse] = useState(
    pulsePreferences?.enabled && pulsePreferences?.frequency === 'weekly'
  );
  const [smartAlerts, setSmartAlerts] = useState(
    pulsePreferences?.enabled && (pulsePreferences?.channels?.length ?? 0) > 0
  );

  const [isFinished, setIsFinished] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    if (pulsePreferences) {
      setWeeklyPulse(pulsePreferences.enabled && pulsePreferences.frequency === 'weekly');
      setSmartAlerts(pulsePreferences.enabled && (pulsePreferences.channels?.length ?? 0) > 0);
    }
  }, [pulsePreferences]);

  const handleSubmit = () => {
    const preferences: PulsePreferences = {
      enabled: Boolean(weeklyPulse || smartAlerts),
      frequency: weeklyPulse ? ('weekly' as const) : undefined,
      channels: smartAlerts ? (['email'] as const) : undefined,
    };

    setPulsePreferences(preferences);
    setComplete(true);
    setCurrentStep('complete');
    setIsFinished(true);
  };

  // Get full state for debug
  const fullState = useOnboardingStore.getState();

  if (isFinished) {
    return (
      <Card className="w-full">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold">
            You're all set!
          </CardTitle>
          <CardDescription className="text-base">
            Thank you for completing onboarding. Your personalized plan is ready.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-slate-50 p-6 text-center dark:bg-slate-800">
            <p className="text-lg font-medium text-slate-900 dark:text-white">
              What's next?
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              You'll receive your first Pulse summary and recommendations based on your plan.
            </p>
          </div>

          {/* Debug Dump */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Debug: Onboarding State
              </h3>
              <Button
                onClick={() => setShowDebug(!showDebug)}
                variant="ghost"
                size="sm"
              >
                {showDebug ? 'Hide' : 'Show'} JSON
              </Button>
            </div>
            {showDebug && (
              <div className="rounded-lg border bg-slate-900 p-4">
                <pre className="overflow-auto text-xs text-slate-100">
                  {JSON.stringify(fullState, null, 2)}
                </pre>
              </div>
            )}
          </div>

          <Button
            onClick={() => router.push('/app/home')}
            size="lg"
            className="w-full"
          >
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl sm:text-3xl font-bold">
          Stay in the loop
        </CardTitle>
        <CardDescription className="text-base">
          Choose how you'd like to receive updates and recommendations.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Weekly Pulse Toggle */}
        <div className="rounded-lg border bg-white p-6 dark:bg-slate-800">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Mail className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Weekly Pulse Summary
                </h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Get a weekly email with your financial snapshot, progress updates, and key insights.
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={weeklyPulse}
                onChange={(e) => setWeeklyPulse(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:bg-slate-700 dark:after:border-slate-600"></div>
            </label>
          </div>
        </div>

        {/* Smart Alerts Toggle */}
        <div className="rounded-lg border bg-white p-6 dark:bg-slate-800">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Bell className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Smart Recommendation Alerts
                </h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Receive timely alerts when we spot opportunities to optimize your plan or save money.
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={smartAlerts}
                onChange={(e) => setSmartAlerts(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:bg-slate-700 dark:after:border-slate-600"></div>
            </label>
          </div>
        </div>

        {/* Info Note */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Note:</strong> You can change these preferences anytime in your account settings.
          </p>
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <Button onClick={handleSubmit} size="lg" className="w-full">
            Complete Onboarding
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

