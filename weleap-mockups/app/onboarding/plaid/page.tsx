/**
 * Onboarding - Plaid Connection Step
 * 
 * Step 3: Connect bank account via Plaid (mocked).
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { connectWithPlaidAndUpdateStore } from '@/lib/plaid/connect';
import { Shield, Zap, Lock } from 'lucide-react';

export default function PlaidPage() {
  const router = useRouter();
  const store = useOnboardingStore();
  const { setCurrentStep } = store;

  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await connectWithPlaidAndUpdateStore(store);
      setCurrentStep('monthly-plan');
      router.push('/onboarding/monthly-plan');
    } catch (error) {
      console.error('Plaid connection error:', error);
      setIsConnecting(false);
      // In a real app, show error message
    }
  };

  const handleSkip = () => {
    store.setPlaidConnected(false);
    setCurrentStep('boost');
    router.push('/onboarding/boost');
  };

  return (
    <Card className="w-full">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl sm:text-3xl font-bold">
          See your real numbers in seconds.
        </CardTitle>
        <CardDescription className="text-base">
          Connect your bank to get an accurate snapshot of your finances.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Benefits */}
        <div className="space-y-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
          <div className="flex items-start gap-3">
            <Zap className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium text-slate-900 dark:text-white">
                Automatic transaction tracking
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                We'll categorize your spending automatically
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium text-slate-900 dark:text-white">
                Bank-level security
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Your credentials are never stored on our servers
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium text-slate-900 dark:text-white">
                Read-only access
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                We can view your transactions but never move money
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

