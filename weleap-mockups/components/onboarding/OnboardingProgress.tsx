/**
 * Onboarding Progress Bar Component
 * 
 * Shows progress through the onboarding stages:
 * Welcome → Connect → Expenses → Income → Savings → Plan
 */

'use client';

import { usePathname, useRouter } from 'next/navigation';
import { CheckCircle2, Circle } from 'lucide-react';
import { useOnboardingStore } from '@/lib/onboarding/store';

// Check if we're in manual entry path (vs Plaid path)
const isManualEntryPath = (pathname: string, plaidConnected: boolean): boolean => {
  // If we're on consent or boost pages, definitely manual entry
  // Also set flag in localStorage so we remember on later pages
  if (
    pathname === '/onboarding/consent' ||
    pathname === '/onboarding/boost' ||
    pathname?.startsWith('/onboarding/boost/')
  ) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('weleap_onboarding_path', 'manual-entry');
    }
    return true;
  }
  
  // If we're on Plaid-specific pages, definitely Plaid path
  // Also set flag in localStorage
  if (
    pathname === '/onboarding/plaid-consent' ||
    pathname === '/onboarding/plaid' ||
    pathname === '/onboarding/education-loading'
  ) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('weleap_onboarding_path', 'plaid');
    }
    return false;
  }
  
  // For other pages (monthly-plan, savings-plan, etc.), check localStorage
  // to see which path was taken
  if (typeof window !== 'undefined') {
    const savedPath = localStorage.getItem('weleap_onboarding_path');
    if (savedPath === 'manual-entry') {
      return true;
    }
    if (savedPath === 'plaid') {
      return false;
    }
  }
  
  // If Plaid is connected, it's definitely Plaid path
  if (plaidConnected) {
    return false;
  }
  
  // Default to false (Connect) for income page until we know which path
  return false;
};

const getStages = (isManualEntry: boolean) => [
  { id: 'welcome', label: 'Welcome' },
  { id: isManualEntry ? 'enter-data' : 'connect', label: isManualEntry ? 'Enter Data' : 'Connect' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'income', label: 'Income' },
  { id: 'savings', label: 'Savings' },
  { id: 'plan', label: 'Plan' },
];

// Map route paths to stages
const getStageFromPath = (pathname: string, isManualEntry: boolean): string => {
  // Welcome
  if (pathname === '/onboarding/ribbit-intro') {
    return 'welcome';
  }
  
  // Connect or Enter Data stage (depends on path)
  if (isManualEntry) {
    // Manual entry path
    if (
      pathname === '/onboarding/income' ||
      pathname === '/onboarding/consent' ||
      pathname === '/onboarding/boost' ||
      pathname?.startsWith('/onboarding/boost/')
    ) {
      return 'enter-data';
    }
  } else {
    // Plaid path
    if (
      pathname === '/onboarding/income' ||
      pathname === '/onboarding/plaid-consent' ||
      pathname === '/onboarding/plaid' ||
      pathname === '/onboarding/education-loading'
    ) {
      return 'connect';
    }
  }
  
  // Expenses
  if (pathname === '/onboarding/monthly-plan-current' || pathname === '/onboarding/monthly-plan') {
    return 'expenses';
  }
  
  // Income
  if (pathname === '/onboarding/monthly-plan-design') {
    return 'income';
  }
  
  // Savings
  if (pathname === '/onboarding/payroll-contributions' || pathname === '/onboarding/savings-plan') {
    return 'savings';
  }
  
  // Plan
  if (pathname === '/onboarding/plan-final') {
    return 'plan';
  }
  
  // Default to welcome for unknown paths
  return 'welcome';
};

// Map stages to their default route paths
const getRouteForStage = (stageId: string, isManualEntry: boolean): string => {
  switch (stageId) {
    case 'welcome':
      return '/onboarding/ribbit-intro';
    case 'connect':
      return '/onboarding/income';
    case 'enter-data':
      return '/onboarding/boost';
    case 'expenses':
      return '/onboarding/monthly-plan-current';
    case 'income':
      return '/onboarding/monthly-plan-design';
    case 'savings':
      return '/onboarding/payroll-contributions';
    case 'plan':
      return '/onboarding/plan-final';
    default:
      return '/onboarding/ribbit-intro';
  }
};

export function OnboardingProgress() {
  const pathname = usePathname();
  const router = useRouter();
  const { plaidConnected } = useOnboardingStore();
  
  // Normalize pathname - remove basePath if present (for GitHub Pages)
  const normalizedPathname = pathname?.replace(/^\/First-try/, '') || pathname || '';
  
  const isManualEntry = isManualEntryPath(normalizedPathname, plaidConnected);
  const stages = getStages(isManualEntry);
  const currentStage = getStageFromPath(normalizedPathname, isManualEntry);
  const currentStageIndex = stages.findIndex((s) => s.id === currentStage);
  
  // Handle case where stage is not found (shouldn't happen, but be safe)
  const safeStageIndex = currentStageIndex >= 0 ? currentStageIndex : 0;

  const handleStageClick = (stageId: string, index: number) => {
    // Only allow navigation to completed stages or current stage
    // Don't allow navigation to future stages
    if (index > safeStageIndex) {
      return;
    }

    // Don't navigate if clicking the current stage
    if (stageId === currentStage) {
      return;
    }

    // Navigate to the default route for this stage
    const route = getRouteForStage(stageId, isManualEntry);
    router.push(route);
  };

  return (
    <div className="w-full py-2">
      {/* Progress Bar */}
      <div className="relative mb-4" style={{ minHeight: '80px' }}>
        {/* Connecting Line */}
        <div className="absolute left-0 top-5 h-0.5 w-full bg-slate-200 dark:bg-slate-700" />
        <div
          className="absolute left-0 top-5 h-0.5 bg-primary transition-all duration-300"
          style={{
            width: `${(safeStageIndex / (stages.length - 1)) * 100}%`,
          }}
        />
        
        {/* Stage Indicators */}
        <div className="relative flex items-center justify-between gap-1">
          {stages.map((stage, index) => {
            const isActive = index <= safeStageIndex;
            const isCurrent = stage.id === currentStage;
            const isClickable = isActive; // Only completed or current stages are clickable
            
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => handleStageClick(stage.id, index)}
                disabled={!isClickable}
                className={`flex flex-col items-center gap-1.5 transition-all flex-1 min-w-0 ${
                  isClickable
                    ? 'cursor-pointer hover:opacity-80'
                    : 'cursor-not-allowed opacity-50'
                }`}
                aria-label={`Go to ${stage.label} stage`}
              >
                {/* Icon */}
                <div
                  className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                    isActive
                      ? 'border-primary bg-primary text-white'
                      : 'border-slate-300 bg-white text-slate-400 dark:border-slate-600 dark:bg-slate-800'
                  }`}
                >
                  {isActive && index < safeStageIndex ? (
                    <CheckCircle2 className="h-6 w-6" />
                  ) : (
                    <Circle className={`h-6 w-6 ${isCurrent ? 'fill-current' : ''}`} />
                  )}
                </div>
                
                {/* Label */}
                <span
                  className={`text-xs font-medium transition-colors text-center break-words ${
                    isActive
                      ? 'text-slate-900 dark:text-white'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {stage.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
