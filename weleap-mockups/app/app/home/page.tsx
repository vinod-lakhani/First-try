/**
 * Home Tab
 * 
 * Monthly snapshot dashboard showing pulse, insights, net worth, and goals.
 */

'use client';

import { useMemo } from 'react';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { usePlanData } from '@/lib/onboarding/usePlanData';
import { buildHomeData } from '@/lib/home/buildHomeData';
import { HomeScreen } from '@/components/home/HomeScreen';
import { SidekickButton } from '@/components/common/SidekickButton';

export default function HomePage() {
  const state = useOnboardingStore();
  const planData = usePlanData();

  // Build home screen data
  const homeData = useMemo(() => {
    if (!planData) return null;
    try {
      return buildHomeData(planData, state);
    } catch (error) {
      console.error('[HomePage] Error building home data:', error);
      return null;
    }
  }, [planData, state]);

  if (!planData || !homeData) {
    return (
      <div className="flex min-h-[calc(100vh-73px)] flex-col">
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto w-full max-w-lg">
            <p className="text-center text-slate-600 dark:text-slate-400">
              Loading your monthly snapshot...
            </p>
          </div>
        </div>
        <SidekickButton />
      </div>
    );
  }

  return (
    <>
      <HomeScreen data={homeData} />
      <SidekickButton />
    </>
  );
}
