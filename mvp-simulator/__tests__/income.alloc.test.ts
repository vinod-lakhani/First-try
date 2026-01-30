/**
 * Unit tests for Income Allocation Engine
 */

import { describe, it, expect } from 'vitest';
import { allocateIncome, round2, type IncomeInputs } from '@/lib/alloc/income';
import { recordTestCase } from './testLogger';

describe('round2', () => {
  it('rounds to 2 decimal places', () => {
    expect(round2(123.456)).toBe(123.46);
    expect(round2(123.454)).toBe(123.45);
    expect(round2(100.005)).toBe(100.01);
  });
});

describe('allocateIncome', () => {
  describe('shift limit enforced (4%)', () => {
    it('shifts from Wants to Savings but caps at 4% of income', () => {
      const inputs: IncomeInputs = {
        incomePeriod$: 4000,
        targets: { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 },
        actuals3m: { needsPct: 0.5, wantsPct: 0.35, savingsPct: 0.15 },
        shiftLimitPct: 0.04, // 4% = $160 max
      };
      const result = allocateIncome(inputs);
      // Gap = $200; shift = min(200, 160) = $160
      expect(result.savings$).toBe(760);
      expect(result.wants$).toBe(1240);
      expect(result.needs$).toBe(2000);
      expect(result.needs$ + result.wants$ + result.savings$).toBe(4000);
      recordTestCase('Income alloc: shift capped at 4%', inputs, {
        needs$: result.needs$,
        wants$: result.wants$,
        savings$: result.savings$,
        sum: result.needs$ + result.wants$ + result.savings$,
        notes: result.notes,
      }, { notes: 'Shift limit 4% ($160) caps shift; gap of 5% remains.' });
    });
  });

  describe('no shift when Wants below target', () => {
    it('does not shift when Wants is already below target (Wants floor)', () => {
      const inputs: IncomeInputs = {
        incomePeriod$: 4000,
        targets: { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 },
        actuals3m: { needsPct: 0.58, wantsPct: 0.25, savingsPct: 0.17 },
        shiftLimitPct: 0.04,
      };
      const result = allocateIncome(inputs);
      expect(result.savings$).toBe(680);
      expect(result.wants$).toBe(1000);
      expect(result.notes.some((n) => n.includes('below target due to Wants floor'))).toBe(true);
      recordTestCase('Income alloc: no shift when Wants below target', inputs, {
        needs$: result.needs$,
        wants$: result.wants$,
        savings$: result.savings$,
        notes: result.notes,
      });
    });
  });

  describe('close gap fully when gap < shift limit', () => {
    it('closes savings gap fully when gap is smaller than shift limit', () => {
      const inputs: IncomeInputs = {
        incomePeriod$: 5000,
        targets: { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 },
        actuals3m: { needsPct: 0.5, wantsPct: 0.32, savingsPct: 0.18 },
        shiftLimitPct: 0.04, // 4% = $200
      };
      const result = allocateIncome(inputs);
      expect(result.savings$).toBe(1000);
      expect(result.wants$).toBe(1500);
      expect(result.needs$).toBe(2500);
      recordTestCase('Income alloc: gap closed fully within shift limit', inputs, {
        needs$: result.needs$,
        wants$: result.wants$,
        savings$: result.savings$,
        notes: result.notes,
      });
    });
  });

  describe('no change when savings at or above target', () => {
    it('does not adjust when savings equals target', () => {
      const inputs: IncomeInputs = {
        incomePeriod$: 4000,
        targets: { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 },
        actuals3m: { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 },
        shiftLimitPct: 0.04,
      };
      const result = allocateIncome(inputs);
      expect(result.savings$).toBe(800);
      expect(result.wants$).toBe(1200);
      expect(result.needs$).toBe(2000);
      recordTestCase('Income alloc: no change when at target', inputs, {
        needs$: result.needs$,
        wants$: result.wants$,
        savings$: result.savings$,
      });
    });
  });

  describe('totals sum to income', () => {
    it('reconciles rounding so needs + wants + savings = income', () => {
      const inputs: IncomeInputs = {
        incomePeriod$: 3333.33,
        targets: { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 },
        actuals3m: { needsPct: 0.5, wantsPct: 0.32, savingsPct: 0.18 },
        shiftLimitPct: 0.04,
      };
      const result = allocateIncome(inputs);
      const total = round2(result.needs$ + result.wants$ + result.savings$);
      expect(total).toBe(3333.33);
      recordTestCase('Income alloc: rounding sum to income', inputs, {
        needs$: result.needs$,
        wants$: result.wants$,
        savings$: result.savings$,
        sum: total,
      });
    });
  });
});
