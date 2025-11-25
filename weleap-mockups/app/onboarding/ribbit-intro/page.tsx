/**
 * Ribbit Introduction Page
 * 
 * First step of onboarding flow - introduces Ribbit as the financial sidekick.
 */

'use client';

import { useRouter } from 'next/navigation';
import RibbitIntro from '@/components/onboarding/RibbitIntro';
import { useOnboardingStore } from '@/lib/onboarding/store';

export default function RibbitIntroPage() {
  const router = useRouter();
  const { resetOnboarding, setCurrentStep } = useOnboardingStore();

  const handlePrimaryClick = () => {
    // Initialize onboarding if not already started
    // Use setTimeout to defer reset to avoid blocking navigation
    setTimeout(() => {
      resetOnboarding();
      setCurrentStep('income');
    }, 0);
    router.push('/onboarding/income');
  };

  const handleSecondaryClick = () => {
    // Navigate back to home
    router.push('/');
  };

  return (
    <RibbitIntro
      onPrimaryClick={handlePrimaryClick}
      onSecondaryClick={handleSecondaryClick}
    />
  );
}

