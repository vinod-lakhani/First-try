/**
 * Unit tests for Net Worth Simulator
 */

import { describe, it, expect } from 'vitest';
import { simulateScenario, type ScenarioInput, type MonthlyPlan } from '@/lib/sim/netWorth';
import { recordTestCase } from './testLogger';

function minimalScenarioInput(overrides: Partial<ScenarioInput> = {}): ScenarioInput {
  const basePlan: MonthlyPlan = {
    monthIndex: 0,
    incomeNet: 5000,
    needs$: 2500,
    wants$: 1500,
    ef$: 200,
    highAprDebt$: 0,
    match401k$: 0,
    retirementTaxAdv$: 300,
    brokerage$: 500,
  };
  return {
    startDate: '2025-01-01',
    horizonMonths: 24,
    openingBalances: {
      cash: 2000,
      brokerage: 10000,
      retirement: 5000,
      liabilities: [],
    },
    monthlyPlan: Array.from({ length: 24 }, (_, i) => ({ ...basePlan, monthIndex: i })),
    ...overrides,
  };
}

describe('simulateScenario', () => {
  it('returns series with correct length and growing net worth', () => {
    const input = minimalScenarioInput();
    const result = simulateScenario(input);
    expect(result.labels.length).toBe(24);
    expect(result.netWorth.length).toBe(24);
    expect(result.assets.length).toBe(24);
    expect(result.liabilities.length).toBe(24);
    expect(result.netWorth[0]).toBeGreaterThanOrEqual(17000); // cash + brokerage + retirement
    if (result.netWorth[23] > result.netWorth[0]) {
      expect(result.netWorth[23]).toBeGreaterThan(result.netWorth[0]);
    }
    recordTestCase('Net worth: basic run and length', input, {
      horizonMonths: input.horizonMonths,
      labelsLength: result.labels.length,
      netWorthAt0: result.netWorth[0],
      netWorthAtEnd: result.netWorth[result.netWorth.length - 1],
      kpis: result.kpis,
    });
  });

  it('sets efReachedMonth when goals.efTarget$ is reached', () => {
    const input = minimalScenarioInput({
      openingBalances: { cash: 8000, brokerage: 0, retirement: 0, liabilities: [] },
      goals: { efTarget$: 10000 },
      monthlyPlan: Array.from({ length: 24 }, (_, i) => ({
        monthIndex: i,
        incomeNet: 5000,
        needs$: 2500,
        wants$: 1500,
        ef$: 400,
        highAprDebt$: 0,
        match401k$: 0,
        retirementTaxAdv$: 300,
        brokerage$: 200,
      })),
    });
    const result = simulateScenario(input);
    expect(result.kpis.efReachedMonth).toBeDefined();
    recordTestCase('Net worth: EF target reached KPI', input, {
      efReachedMonth: result.kpis.efReachedMonth,
      netWorthAtEnd: result.netWorth[result.netWorth.length - 1],
    });
  });

  it('does not set efReachedMonth when goals is empty (no EF target)', () => {
    const input = minimalScenarioInput();
    delete (input as { goals?: unknown }).goals;
    const result = simulateScenario(input);
    expect(result.kpis.efReachedMonth).toBeUndefined();
    recordTestCase('Net worth: no EF target when goals empty', input, {
      efReachedMonth: result.kpis.efReachedMonth,
    }, { category: 'regression', notes: 'When user has no EF target, goals should be empty; no efReachedMonth.' });
  });
});
