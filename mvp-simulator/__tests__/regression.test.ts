/**
 * Regression tests: known bugs and edge cases
 */

import { describe, it, expect } from 'vitest';
import { allocateIncome, type IncomeInputs } from '@/lib/alloc/income';
import { allocateSavings, type SavingsInputs } from '@/lib/alloc/savings';
import { buildFinalPlanData } from '@/lib/onboarding/plan';
import type { OnboardingState, PayFrequency } from '@/lib/onboarding/types';
import { recordTestCase } from './testLogger';

describe('Regression: shift limit 4%', () => {
  it('uses 4% cap when form sends shiftLimitPct 4 (whole number)', () => {
    const inputs: IncomeInputs = {
      incomePeriod$: 8000,
      targets: { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 },
      actuals3m: { needsPct: 0.6, wantsPct: 0.3, savingsPct: 0.1 },
      shiftLimitPct: 0.04, // decimal 4%
    };
    const result = allocateIncome(inputs);
    const shift$ = result.savings$ - 8000 * 0.1;
    const shiftPct = shift$ / 8000;
    expect(shiftPct).toBeLessThanOrEqual(0.0401);
    expect(shiftPct).toBeGreaterThanOrEqual(0.039);
    recordTestCase('Regression: shift limit 4% enforced', inputs, {
      savings$: result.savings$,
      shiftPct: shift$ / 8000,
      notes: result.notes,
    }, { category: 'regression', notes: 'Shift must be capped at 4%, not 5%.' });
  });
});

describe('Regression: EF target 0', () => {
  it('allocateSavings: efTarget$ 0 yields zero EF allocation', () => {
    const inputs: SavingsInputs = {
      savingsBudget$: 1000,
      efTarget$: 0,
      efBalance$: 5000,
      highAprDebts: [],
      matchNeedThisPeriod$: 0,
      incomeSingle$: 60000,
    };
    const result = allocateSavings(inputs);
    expect(result.ef$).toBe(0);
    expect(result.notes.some((n) => n.includes('9400') || n.includes('EF gap partially filled'))).toBe(false);
    recordTestCase('Regression: EF 0 no allocation', inputs, {
      ef$: result.ef$,
      notes: result.notes,
    }, { category: 'regression' });
  });

  it('buildFinalPlanData: efTargetMonths 0 yields EF target $0', () => {
    const state: OnboardingState = {
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
      riskConstraints: {
        shiftLimitPct: 4,
        targets: { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 },
        actuals3m: { needsPct: 0.6, wantsPct: 0.3, savingsPct: 0.1 },
      },
      safetyStrategy: {
        efTargetMonths: 0,
        efBalance$: 5000,
        liquidity: 'Medium',
        retirementFocus: 'High',
        onIDR: false,
      },
      payrollContributions: {},
    };
    const result = buildFinalPlanData(state);
    expect(result.emergencyFund.target).toBe(0);
    expect(result.emergencyFund.monthsTarget).toBe(0);
    recordTestCase('Regression: plan EF target 0 yields $0', state, {
      emergencyFund: result.emergencyFund,
    }, { category: 'regression', notes: 'User EF target 0 must not show $9400 or 3-month default.' });
  });
});
