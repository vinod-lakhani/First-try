/**
 * WeLeap Consent Page
 * 
 * Consent screen for WeLeap Terms of Service and Privacy Policy.
 * This is shown when user selects manual entry on the income page.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Shield, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { TOS_VERSION, PRIVACY_POLICY_VERSION } from '@/lib/legal/constants';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';

export default function ConsentPage() {
  const router = useRouter();
  const { setCurrentStep } = useOnboardingStore();
  const [consentChecked, setConsentChecked] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAgreeAndContinue = async () => {
    if (!consentChecked) {
      console.log('Consent not checked');
      return;
    }

    setIsProcessing(true);

    try {
      // Record consent via API
      const userId = typeof window !== 'undefined' 
        ? localStorage.getItem('weleap_user_id') || 'current-user-id'
        : 'current-user-id';
      
      // Store consent locally first (until backend is fully implemented)
      const consentData = {
        id: Date.now().toString(),
        userId,
        consentType: 'weleap_consent' as const,
        tosVersion: TOS_VERSION,
        ppVersion: PRIVACY_POLICY_VERSION,
        createdAt: new Date().toISOString(),
      };
      
      if (typeof window !== 'undefined') {
        localStorage.setItem(`weleap_consent_${userId}_weleap`, JSON.stringify(consentData));
      }

      // Try to record consent via API (but don't block on failure in development)
      try {
        const response = await fetch('/api/consent/weleap', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            tosVersion: TOS_VERSION,
            ppVersion: PRIVACY_POLICY_VERSION,
          }),
        });

        if (!response.ok) {
          console.warn('API consent recording failed, but continuing with local storage');
        }
      } catch (apiError) {
        console.warn('API consent recording error (continuing anyway):', apiError);
      }

      // Continue with manual entry flow - go to boost hub
      setCurrentStep('boost');
      router.push('/onboarding/boost');
    } catch (error) {
      console.error('Error in handleAgreeAndContinue:', error);
      setIsProcessing(false);
      // Still redirect even on error (unless it's a navigation error)
      if (error instanceof Error && error.message !== 'Navigation cancelled') {
        setCurrentStep('boost');
        router.push('/onboarding/boost');
      }
    }
  };

  const handleSelectPlaid = () => {
    // Navigate to Plaid consent screen
    setCurrentStep('plaid-consent');
    router.push('/onboarding/plaid-consent');
  };

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col items-center justify-center px-4 py-6">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-2 text-center">
          {/* Progress Bar */}
          <div className="mb-4">
            <OnboardingProgress />
          </div>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold">
            Before we continue
          </CardTitle>
          <CardDescription className="text-base">
            Please review and agree to our Terms of Service and Privacy Policy to continue with WeLeap.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Information Box */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
              <p className="text-sm text-blue-900 dark:text-blue-200">
                Please confirm that you agree to our{' '}
                <Link href="/legal/terms" className="font-semibold underline hover:no-underline">
                  Terms of Service
                </Link>
                {' '}and{' '}
                <Link href="/legal/privacy" className="font-semibold underline hover:no-underline">
                  Privacy Policy
                </Link>
                {' '}to continue.
              </p>
            </div>
          </div>

          {/* Consent Checkbox */}
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-slate-300 text-primary focus:ring-2 focus:ring-primary"
            />
            <div className="flex-1">
              <p className="font-medium text-slate-900 dark:text-white">
                I agree to the Terms of Service and Privacy Policy
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                By checking this box, you acknowledge that you have read and agree to our Terms of Service and Privacy Policy.
              </p>
            </div>
          </label>

          {/* Links to Legal Documents */}
          <div className="flex justify-center gap-4 text-sm">
            <Link
              href="/legal/terms"
              className="text-primary hover:underline"
              target="_blank"
            >
              Terms of Service
            </Link>
            <span className="text-slate-400">·</span>
            <Link
              href="/legal/privacy"
              className="text-primary hover:underline"
              target="_blank"
            >
              Privacy Policy
            </Link>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-4">
            <Button
              onClick={handleAgreeAndContinue}
              size="lg"
              className="w-full"
              disabled={!consentChecked || isProcessing}
              type="button"
            >
              {isProcessing ? (
                <>Processing...</>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  Agree and continue
                </>
              )}
            </Button>

            <Button
              onClick={handleSelectPlaid}
              variant="outline"
              size="lg"
              className="w-full"
              disabled={isProcessing}
              type="button"
            >
              <ArrowRight className="mr-2 h-5 w-5" />
              Connect with Plaid instead
            </Button>

            <Button
              onClick={() => router.back()}
              variant="ghost"
              size="lg"
              className="w-full"
              disabled={isProcessing}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
