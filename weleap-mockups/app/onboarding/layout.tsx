/**
 * Onboarding Layout
 * 
 * Wraps all onboarding steps in a consistent layout with top bar and centered card.
 */

import Link from 'next/link';

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Top Bar */}
      <div className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur-sm dark:bg-slate-900/80">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-slate-900 dark:text-white">
              WeLeap
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <div className="mx-auto w-full max-w-lg">
          {children}
        </div>
      </div>
    </div>
  );
}

