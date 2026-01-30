/**
 * Integration tests: full plan pipeline (buildFinalPlanData)
 */

import { describe, it, expect } from 'vitest';
import { buildFinalPlanData, type FinalPlanData } from '@/lib/onboarding/plan';
import type { OnboardingState, PayFrequency } from '@/lib/onboarding/types';
import { recordTestCase } from './testLogger';

function minimalOnboardingState(overrides: Partial<OnboardingState> = {}): OnboardingState {
  return {
    currentStep: 'plan-final',
    isComplete: false,
    plaidConnected: false,
    income: {
      grossIncome$: 0,
      netIncome$: 8000,
      payFrequency: 'monthly' as PayFrequency,
      annualSalary$: 96000,
      incomeSingle$: 96000,
    },
    fixedExpenses: [],
    debts: [],
    assets: [],
    goals: [],
    primaryGoal: 'emergency-fund',
    riskConstraints: {
      shiftLimitPct: 4, // whole number 4%
      targets: {
        needsPct: 0.5,
        wantsPct: 0.3,
        savingsPct: 0.2,
      },
      actuals3m: {
        needsPct: 0.6,
        wantsPct: 0.3,
        savingsPct: 0.1,
      },
    },
    safetyStrategy: {
      efTargetMonths: 3,
      efBalance$: 5000,
      liquidity: 'Medium',
      retirementFocus: 'High',
      onIDR: false,
      iraRoomThisYear$: 7000,
      k401RoomThisYear$: 23000,
    },
    payrollContributions: {
      has401k: true,
      hasEmployerMatch: 'yes' as const,
      employerMatchPct: 50,
      employerMatchCapPct: 6,
      currentlyContributing401k: 'no',
      hasHSA: true,
      hsaEligible: true,
      hsaCoverageType: 'self',
      currentlyContributingHSA: 'no',
    },
    ...overrides,
  };
}

describe('buildFinalPlanData', () => {
  it('runs full pipeline and returns valid FinalPlanData', () => {
    const state = minimalOnboardingState();
    const result = buildFinalPlanData(state);
    expect(result.paycheckAmount).toBe(8000);
    expect(result.paycheckCategories.length).toBeGreaterThan(0);
    expect(result.emergencyFund).toBeDefined();
    expect(result.emergencyFund.current).toBe(5000);
    expect(result.netWorthProjection.length).toBeGreaterThan(0);
    expect(result.netWorthChartData.labels.length).toBeGreaterThan(0);
    const totalAlloc =
      result.paycheckCategories.reduce((sum, c) => sum + c.amount, 0);
    expect(totalAlloc).toBeCloseTo(8000, 0);
    recordTestCase('Plan integration: full pipeline', state, {
      paycheckAmount: result.paycheckAmount,
      emergencyFund: result.emergencyFund,
      netWorthProjectionLength: result.netWorthProjection.length,
      totalCategoriesSum: totalAlloc,
    }, { category: 'integration' });
  });

  it('honors EF target 0 (no EF target dollar amount)', () => {
    const state = minimalOnboardingState({
      safetyStrategy: {
        efTargetMonths: 0,
        efBalance$: 5000,
        liquidity: 'Medium',
        retirementFocus: 'High',
        onIDR: false,
      },
    });
    const result = buildFinalPlanData(state);
    expect(result.emergencyFund.monthsTarget).toBe(0);
    expect(result.emergencyFund.target).toBe(0);
    recordTestCase('Plan integration: EF target 0', state, {
      emergencyFund: result.emergencyFund,
    }, { category: 'regression', notes: 'EF target 0 must yield target $0, not default 3 months.' });
  });
});
