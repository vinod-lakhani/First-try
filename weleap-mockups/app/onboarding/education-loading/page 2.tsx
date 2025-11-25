/**
 * Education Loading Page
 * 
 * Page that displays educational content while Plaid accounts sync.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import EducationLoading from '@/components/onboarding/EducationLoading';

export default function EducationLoadingPage() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  // For now, simulate readiness with a timeout (you'll later replace this
  // with real Plaid/backend status)
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 6000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <EducationLoading
      isReady={isReady}
      onContinue={() => router.push('/onboarding/monthly-plan-current')}
    />
  );
}
