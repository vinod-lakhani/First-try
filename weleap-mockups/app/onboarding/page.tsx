/**
 * Onboarding - Welcome Step
 * 
 * Step 1: Welcome screen with value proposition and CTA.
 */

'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useOnboardingStore } from '@/lib/onboarding/store';

export default function WelcomePage() {
  const router = useRouter();
  const { resetOnboarding, setCurrentStep } = useOnboardingStore();

  const handleGetStarted = () => {
    // Initialize onboarding if not already started
    resetOnboarding();
    setCurrentStep('income');
    router.push('/onboarding/income');
  };

  return (
    <Card className="w-full">
      <CardHeader className="text-center space-y-4 pb-8">
        <CardTitle className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
          Own your future, one smart leap at a time.
        </CardTitle>
        <CardDescription className="text-base sm:text-lg text-slate-600 dark:text-slate-400">
          In the next 60 seconds, you'll get a personalized money snapshot and your first smart recommendation.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-0">
        <Button
          onClick={handleGetStarted}
          size="lg"
          className="w-full"
        >
          Get started
        </Button>
      </CardContent>
    </Card>
  );
}

