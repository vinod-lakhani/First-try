/**
 * Onboarding - Welcome Step
 * 
 * Step 1: Welcome screen that redirects to Ribbit introduction.
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WelcomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to Ribbit introduction page
    router.replace('/onboarding/ribbit-intro');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center text-slate-600 dark:text-slate-400">
        Loading...
      </div>
    </div>
  );
}

