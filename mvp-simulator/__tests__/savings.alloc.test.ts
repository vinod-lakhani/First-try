/**
 * Unit tests for Savings Allocation Engine
 */

import { describe, it, expect } from 'vitest';
import { allocateSavings, type SavingsInputs } from '@/lib/alloc/savings';
import { recordTestCase } from './testLogger';

function minimalSavingsInput(overrides: Partial<SavingsInputs> = {}): SavingsInputs {
  return {
    savingsBudget$: 1000,
    efTarget$: 6000,
    efBalance$: 2000,
    highAprDebts: [],
    matchNeedThisPeriod$: 0,
    incomeSingle$: 60000,
    ...overrides,
  };
}

describe('allocateSavings', () => {
  describe('EF allocation', () => {
    it('allocates to EF up to cap when EF target > 0', () => {
      const inputs = minimalSavingsInput({
        savingsBudget$: 1000,
        efTarget$: 5000,
        efBalance$: 0,
      });
      const result = allocateSavings(inputs);
      // EF gap = 5000, cap = 40% of 1000 = 400, so ef$ = 400
      expect(result.ef$).toBe(400);
      expect(result.notes.some((n) => n.includes('emergency fund'))).toBe(true);
      recordTestCase('Savings alloc: EF allocation when target > 0', inputs, {
        ef$: result.ef$,
        highAprDebt$: result.highAprDebt$,
        match401k$: result.match401k$,
        notes: result.notes,
      });
    });

    it('allocates zero to EF when efTarget$ is 0 (no EF target)', () => {
      const inputs = minimalSavingsInput({
        savingsBudget$: 1000,
        efTarget$: 0,
        efBalance$: 0,
      });
      const result = allocateSavings(inputs);
      expect(result.ef$).toBe(0);
      expect(result.notes.some((n) => n.includes('EF gap partially filled'))).toBe(false);
      recordTestCase('Savings alloc: zero EF when target 0', inputs, {
        ef$: result.ef$,
        notes: result.notes,
      }, { category: 'regression', notes: 'EF target 0 must not show EF gap or allocate to EF.' });
    });
  });

  describe('401(k) match', () => {
    it('allocates to match first when match need present', () => {
      const inputs = minimalSavingsInput({
        savingsBudget$: 800,
        matchNeedThisPeriod$: 400,
      });
      const result = allocateSavings(inputs);
      expect(result.match401k$).toBe(400);
      expect(result.notes.some((n) => n.includes('401(k)') && n.includes('match'))).toBe(true);
      recordTestCase('Savings alloc: 401k match first', inputs, {
        match401k$: result.match401k$,
        ef$: result.ef$,
        notes: result.notes,
      });
    });
  });

  describe('high-APR debt', () => {
    it('allocates to high-APR debt when present', () => {
      const inputs = minimalSavingsInput({
        savingsBudget$: 1200,
        efTarget$: 0,
        efBalance$: 0,
        highAprDebts: [{ balance$: 5000, aprPct: 18 }],
      });
      const result = allocateSavings(inputs);
      expect(result.highAprDebt$).toBeGreaterThan(0);
      recordTestCase('Savings alloc: high-APR debt', inputs, {
        highAprDebt$: result.highAprDebt$,
        ef$: result.ef$,
        notes: result.notes,
      });
    });
  });

  describe('routing and totals', () => {
    it('returns valid routing (Roth or Traditional401k)', () => {
      const inputs = minimalSavingsInput();
      const result = allocateSavings(inputs);
      expect(['Roth', 'Traditional401k']).toContain(result.routing.acctType);
      expect(result.routing.splitRetirePct + result.routing.splitBrokerPct).toBeCloseTo(1, 5);
      recordTestCase('Savings alloc: routing and split', inputs, {
        routing: result.routing,
        retirementTaxAdv$: result.retirementTaxAdv$,
        brokerage$: result.brokerage$,
      });
    });
  });
});
