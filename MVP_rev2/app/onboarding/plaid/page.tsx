/**
 * Onboarding - Plaid Connection Step
 * 
 * Step 3: Connect bank account via Plaid (mocked).
 */

'use client';

import { useState } from 'react';
import type { MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { connectWithPlaidAndUpdateStore } from '@/lib/plaid/connect';
import { Wallet, PieChart, Sparkles, PiggyBank, TrendingUp } from 'lucide-react';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';

export default function PlaidPage() {
  const router = useRouter();
  const store = useOnboardingStore();
  const { setCurrentStep } = store;

  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async (e?: MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    setIsConnecting(true);
    try {
      await connectWithPlaidAndUpdateStore(store);
      setCurrentStep('education-loading');
      router.push('/onboarding/education-loading');
    } catch (error) {
      console.error('Plaid connection error:', error);
      setIsConnecting(false);
      // In a real app, show error message
    }
  };

  const handleSkip = (e?: MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    store.setPlaidConnected(false);
    setCurrentStep('boost');
    router.push('/onboarding/boost');
  };

  return (
    <Card className="w-full">
      <CardHeader className="space-y-2">
        {/* Progress Bar */}
        <div className="pb-2">
          <OnboardingProgress />
        </div>
        <CardTitle className="text-2xl sm:text-3xl font-bold">
          See your real financial picture in seconds.
        </CardTitle>
        <CardDescription className="text-base">
          Connect your accounts so Ribbit can learn how you earn, spend, and save — and build a plan that actually fits your life.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Benefits */}
        <div className="space-y-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
          <div className="flex items-start gap-3">
            <TrendingUp className="mt-1 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                Real income, not just guesses
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                We look at your deposits to estimate your true monthly income.
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <PieChart className="mt-1 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                Smart spending breakdown
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                We group your transactions into 'needs' and 'wants' so you can see where your money really goes.
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Sparkles className="mt-1 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                Your first money plan
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Ribbit uses your data to build a starting plan tailored to you.
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <PiggyBank className="mt-1 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                Find your savings potential
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                See how small tweaks today can grow into big progress over time.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-4">
          <Button
            onClick={handleConnect}
            size="lg"
            className="w-full"
            disabled={isConnecting}
          >
            {isConnecting ? 'Connecting...' : 'Connect with Plaid'}
          </Button>
          
          <Button
            onClick={handleSkip}
            variant="ghost"
            size="lg"
            className="w-full"
            disabled={isConnecting}
          >
            Skip for now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

