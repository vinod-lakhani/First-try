/**
 * Pre-Plaid Consent Page
 * 
 * Consent screen before connecting financial accounts via Plaid.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Shield, AlertCircle, CheckCircle2, ShieldCheck, Lock, Building } from 'lucide-react';
import Link from 'next/link';
import { TOS_VERSION, PRIVACY_POLICY_VERSION } from '@/lib/legal/constants';

export default function PlaidConsentPage() {
  const router = useRouter();
  const [consentChecked, setConsentChecked] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAgreeAndConnect = async () => {
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
        consentType: 'pre_plaid' as const,
        tosVersion: TOS_VERSION,
        ppVersion: PRIVACY_POLICY_VERSION,
        createdAt: new Date().toISOString(),
      };
      
      if (typeof window !== 'undefined') {
        localStorage.setItem(`weleap_consent_${userId}_pre_plaid`, JSON.stringify(consentData));
      }

      // Try to record consent via API (but don't block on failure in development)
      try {
        const response = await fetch('/api/consent/pre-plaid', {
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

      // Always redirect to Plaid connection page
      router.push('/onboarding/plaid');
    } catch (error) {
      console.error('Error in handleAgreeAndConnect:', error);
      setIsProcessing(false);
      // Still redirect even on error (unless it's a navigation error)
      if (error instanceof Error && error.message !== 'Navigation cancelled') {
        router.push('/onboarding/plaid');
      }
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col items-center justify-center px-4 py-6">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
            <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold">
            Before we connect your accounts
          </CardTitle>
          <CardDescription className="text-base">
            We connect your accounts using Plaid — a trusted service used by apps like Venmo, Robinhood, Coinbase, and Chime. WeLeap never sees or stores your bank username or password.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Plaid Trust Block */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
              Why Plaid?
            </h3>
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <Building className="h-5 w-5 text-slate-600 dark:text-slate-400 shrink-0 mt-0.5" />
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Plaid securely connects to over 12,000 banks and credit unions.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-slate-600 dark:text-slate-400 shrink-0 mt-0.5" />
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Tens of millions of people use Plaid to link their accounts.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-slate-600 dark:text-slate-400 shrink-0 mt-0.5" />
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Your data is encrypted end-to-end, and you stay in control.
                </p>
              </div>
            </div>
          </div>

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

          {/* Security Explanation Link */}
          <div className="text-center text-xs text-slate-500 dark:text-slate-400">
            Curious how your data is protected?{' '}
            <Link href="/security" className="underline hover:text-slate-700 dark:hover:text-slate-300">
              Learn more
            </Link>
            .
          </div>

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
              onClick={() => {
                handleAgreeAndConnect();
              }}
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
                  Agree & Continue with Plaid
                </>
              )}
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

