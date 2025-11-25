/**
 * Education Loading Screen Component
 * 
 * Shows educational content about Needs, Wants, and Savings philosophy
 * while Plaid accounts sync in the background.
 */

'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Home, Sparkles, PiggyBank, HeartHandshake, Loader2 } from 'lucide-react';

export type EducationLoadingProps = {
  // Optional: show a completion state when parent knows Plaid sync is done
  isReady?: boolean;              // default: false
  onContinue?: () => void;        // called when user taps main button
};

const EducationLoading: React.FC<EducationLoadingProps> = ({
  isReady = false,
  onContinue,
}) => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top content is scrollable */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-6 py-8 space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
              Step 3 of 4
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-center text-slate-900 dark:text-white">
              While we set things up, here&apos;s how your plan works.
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
              Ribbit is syncing your accounts in the background. These are the basics we use to build your plan.
            </p>
          </div>

          {/* Syncing status */}
          <div className="flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            {!isReady ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Syncing your accounts with Plaid…</span>
              </>
            ) : (
              <span>Accounts synced with Plaid</span>
            )}
          </div>

          {/* Educational cards */}
          <div className="space-y-4">
            {/* Card 1 - Needs */}
            <Card className="rounded-2xl border p-4 space-y-2">
              <div className="flex items-start gap-3">
                <div className="mt-1 h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                  <Home className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    Needs: the must-pay stuff
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    These are the basics you can&apos;t skip — rent, groceries, minimum loan payments, essential bills. We try to keep this reasonable so your plan still feels livable.
                  </p>
                </div>
              </div>
            </Card>

            {/* Card 2 - Wants */}
            <Card className="rounded-2xl border p-4 space-y-2">
              <div className="flex items-start gap-3">
                <div className="mt-1 h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center shrink-0">
                  <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    Wants: the fun and flexible
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Dining out, shopping, travel, streaming — the things that make life enjoyable. We&apos;ll show you how much room you have for wants without derailing your goals.
                  </p>
                </div>
              </div>
            </Card>

            {/* Card 3 - Savings */}
            <Card className="rounded-2xl border p-4 space-y-2">
              <div className="flex items-start gap-3">
                <div className="mt-1 h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center shrink-0">
                  <PiggyBank className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    Savings: paying your future self
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Savings covers your emergency fund, extra debt paydown, and investing. This is the part of your plan that helps future-you feel safe and free.
                  </p>
                </div>
              </div>
            </Card>

            {/* Card 4 - Philosophy */}
            <Card className="rounded-2xl border p-4 space-y-2">
              <div className="flex items-start gap-3">
                <div className="mt-1 h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center shrink-0">
                  <HeartHandshake className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    Our philosophy: maximize savings, not misery
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Ribbit gently nudges your &apos;needs&apos; and &apos;wants&apos; so you can save more — but we never expect perfection. Small, consistent changes beat crash-diet budgeting every time.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>

      {/* Bottom CTA is sticky */}
      <footer className="border-t bg-background px-6 py-4">
        <div className="max-w-md mx-auto space-y-3">
          <Button
            className="w-full"
            size="lg"
            disabled={!isReady}
            onClick={isReady ? onContinue : undefined}
          >
            {isReady ? 'See my plan' : 'Still syncing…'}
          </Button>
          <p className="text-xs text-center text-slate-500 dark:text-slate-400">
            This usually takes less than a minute.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default EducationLoading;
