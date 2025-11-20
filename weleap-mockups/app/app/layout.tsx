/**
 * App Layout
 * 
 * Main app shell with tab navigation and Financial Sidekick.
 * Checks onboarding completion status.
 */

'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { FinancialSidekick } from './components/FinancialSidekick';
import { LogDownloadButton } from './components/LogDownloadButton';
import { LoggerInit } from './components/LoggerInit';
import { Home, DollarSign, Rss, User } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isComplete } = useOnboardingStore();

  useEffect(() => {
    if (!isComplete) {
      // Redirect to onboarding if not completed
      router.push('/onboarding');
    }
  }, [isComplete, router]);

  // Show onboarding prompt if not complete
  if (!isComplete) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="space-y-4 text-center">
              <h2 className="text-xl font-semibold">Finish setting up your plan</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Complete onboarding to access your personalized financial plan.
              </p>
              <Button onClick={() => router.push('/onboarding')} className="w-full">
                Go to Onboarding
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tabs = [
    { href: '/app/home', label: 'Home', icon: Home },
    { href: '/app/income', label: 'Income', icon: DollarSign },
    { href: '/app/feed', label: 'Feed', icon: Rss },
    { href: '/app/profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top Bar - Just WeLeap Logo */}
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="container mx-auto flex h-14 items-center justify-center px-4">
          <h1 className="text-lg font-semibold">WeLeap</h1>
        </div>
      </header>

      {/* Tabs Navigation - Same on all pages */}
      <div className="border-b bg-background px-4 py-3">
        <nav className="mx-auto flex max-w-lg items-center justify-center gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* Financial Sidekick - Chat Bar at Bottom - Same on all pages */}
      <div className="border-t bg-background px-4 py-4">
        <div className="mx-auto max-w-lg">
          <FinancialSidekick inline={true} />
        </div>
      </div>

      {/* Logger Initialization - Must be client-side */}
      <LoggerInit />
      
      {/* Log Download Button - For debugging */}
      <LogDownloadButton />
    </div>
  );
}

