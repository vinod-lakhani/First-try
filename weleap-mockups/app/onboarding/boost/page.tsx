/**
 * Onboarding - Boost Hub
 * 
 * Central hub for Phase 2 micro-flows to optimize the plan.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { CheckCircle2, Circle, Receipt, CreditCard, Target, Shield, AlertTriangle, X, Zap } from 'lucide-react';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';

interface BoostTile {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  isComplete: () => boolean;
}

export default function BoostHubPage() {
  const router = useRouter();
  const state = useOnboardingStore();
  const {
    plaidConnected,
    fixedExpenses,
    debts,
    assets,
    goals,
    safetyStrategy,
    riskConstraints,
    setCurrentStep,
  } = state;

  const [dismissedPlaidBanner, setDismissedPlaidBanner] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const showPlaidBanner = !plaidConnected && !dismissedPlaidBanner;

  const tiles: BoostTile[] = [
    {
      id: 'bills',
      title: 'Bills & Subscriptions',
      description: 'Review and manage your recurring expenses',
      href: '/onboarding/boost/bills',
      icon: <Receipt className="h-6 w-6" />,
      isComplete: () => fixedExpenses.length > 0,
    },
    {
      id: 'debts',
      title: 'Debts',
      description: 'Add and manage your debts',
      href: '/onboarding/boost/debts',
      icon: <CreditCard className="h-6 w-6" />,
      isComplete: () => debts.length > 0 && debts.some(d => d.balance$ > 0),
    },
    {
      id: 'assets-goals',
      title: 'Assets & Goals',
      description: 'Track assets and set financial goals',
      href: '/onboarding/boost/assets-goals',
      icon: <Target className="h-6 w-6" />,
      isComplete: () => assets.length > 0 || goals.length > 0,
    },
    {
      id: 'safety-strategy',
      title: 'Safety & Strategy',
      description: 'Set emergency fund target and debt strategy (Optional)',
      href: '/onboarding/boost/safety-strategy',
      icon: <Shield className="h-6 w-6" />,
      isComplete: () => !!safetyStrategy?.efTargetMonths && !!safetyStrategy?.debtPayoffStrategy,
    },
    {
      id: 'risk-constraints',
      title: 'Risk & Constraints',
      description: 'Set risk tolerance and financial constraints (Optional)',
      href: '/onboarding/boost/risk-constraints',
      icon: <AlertTriangle className="h-6 w-6" />,
      isComplete: () => !!riskConstraints?.riskScore1to5 && !!riskConstraints?.dominantTimeHorizon,
    },
  ];

  // Only count required tiles (exclude safety-strategy and risk-constraints)
  const requiredTiles = tiles.filter(t => t.id !== 'safety-strategy' && t.id !== 'risk-constraints');
  const completedCount = requiredTiles.filter(t => t.isComplete()).length;
  const allComplete = completedCount === requiredTiles.length;

  const handleConnectPlaid = () => {
    // Redirect to consent screen first
    router.push('/onboarding/plaid-consent');
  };

  const handleDismissBanner = () => {
    setDismissedPlaidBanner(true);
  };

  const handleContinue = () => {
    setCurrentStep('monthly-plan-current');
    router.push('/onboarding/monthly-plan-current');
  };

  return (
    <Card className="w-full">
      <CardHeader className="space-y-2">
        {/* Progress Bar */}
        <div className="pb-2">
          <OnboardingProgress />
        </div>
        <CardTitle className="text-2xl sm:text-3xl font-bold">
          Boost Your Plan
        </CardTitle>
        <CardDescription className="text-base">
          Complete these steps to optimize your personalized plan. ({completedCount}/{requiredTiles.length} required complete)
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Plaid Banner */}
        {showPlaidBanner && (
          <div className="rounded-lg border border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 p-4 dark:from-primary/10 dark:to-primary/20">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2 dark:bg-primary/20">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  Connect your bank to upgrade your plan.
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  We'll auto-detect your bills, debts, and balances so your plan is 100% tailored to you.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    onClick={handleConnectPlaid}
                    disabled={isConnecting}
                    size="sm"
                    className="bg-primary text-white hover:bg-primary/90"
                  >
                    {isConnecting ? 'Connecting...' : 'Connect with Plaid'}
                  </Button>
                  <Button
                    onClick={handleDismissBanner}
                    variant="ghost"
                    size="sm"
                    className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  >
                    Not now
                  </Button>
                </div>
              </div>
              <button
                onClick={handleDismissBanner}
                className="ml-2 shrink-0 rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                aria-label="Dismiss banner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Progress Indicator */}
        <div className="rounded-lg border bg-slate-50 p-4 dark:bg-slate-800">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Progress
            </span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {completedCount} / {tiles.length}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(completedCount / tiles.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Tiles Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {tiles.map((tile) => {
            const isComplete = tile.isComplete();
            return (
              <Link
                key={tile.id}
                href={tile.href}
                className="block"
              >
                <div
                  className={`rounded-lg border p-4 transition-all hover:border-primary hover:shadow-md ${
                    isComplete
                      ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                      : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`rounded-lg p-2 ${
                        isComplete
                          ? 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                      }`}
                    >
                      {tile.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-slate-900 dark:text-white">
                          {tile.title}
                        </h3>
                        {isComplete ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        ) : (
                          <Circle className="h-5 w-5 text-slate-400" />
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        {tile.description}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Continue Button */}
        <div className="pt-4">
          <Button
            onClick={handleContinue}
            size="lg"
            className="w-full"
          >
            See my expenses
          </Button>
          {!allComplete && (
            <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
              You can continue now, but completing all steps will give you the most accurate results.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

