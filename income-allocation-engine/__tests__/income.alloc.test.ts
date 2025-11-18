/**
 * Unit tests for Income Allocation Engine
 */

/// <reference types="vitest/globals" />

import { allocateIncome, round2, IncomeInputs } from '../lib/alloc/income';

describe('round2', () => {
  it('should round to 2 decimal places', () => {
    expect(round2(123.456)).toBe(123.46);
    expect(round2(123.454)).toBe(123.45);
    expect(round2(100.005)).toBe(100.01);
    expect(round2(100.004)).toBe(100.00);
  });
});

describe('allocateIncome', () => {
  describe('closes savings gap within shift limit', () => {
    it('should not shift when Wants is already below target (edge case)', () => {
      const inputs: IncomeInputs = {
        incomePeriod$: 4000,
        targets: { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 },
        actuals3m: { needsPct: 0.58, wantsPct: 0.25, savingsPct: 0.17 },
        shiftLimitPct: 0.04, // 4% = $160
      };
      
      const result = allocateIncome(inputs);
      
      // Target Savings = $800, Actual = $680, Gap = $120
      // Available Wants above target = $1000 - $1200 = -$200 (Wants is below target)
      // Max shift = min($120, $160, 0) = 0 (cannot shift from Wants when it's below target)
      // Should flag the shortfall but not adjust
      
      expect(result.savings$).toBe(680); // No change - cannot shift
      expect(result.wants$).toBe(1000); // No change
      expect(result.needs$).toBe(2320); // Stays at actual
      expect(result.notes.some(n => n.includes('below target due to Wants floor'))).toBe(true);
    });
    
    it('should shift from Wants to Savings when Wants is above target', () => {
      const inputs: IncomeInputs = {
        incomePeriod$: 4000,
        targets: { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 },
        actuals3m: { needsPct: 0.50, wantsPct: 0.35, savingsPct: 0.15 }, // Wants 35% above 30% target
        shiftLimitPct: 0.04, // 4% = $160
      };
      
      const result = allocateIncome(inputs);
      
      // Target Savings = $800, Actual = $600, Gap = $200
      // Available Wants above target = $1400 - $1200 = $200
      // Max shift = min($200, $160, $200) = $160
      // So should shift $160 from Wants to Savings
      
      expect(result.savings$).toBe(760); // $600 + $160
      expect(result.wants$).toBe(1240); // $1400 - $160
      expect(result.needs$).toBe(2000); // Stays at actual
      expect(result.notes.some(n => n.includes('shift from Wants→Savings'))).toBe(true);
    });
    
    it('should close gap fully when gap is smaller than shift limit', () => {
      const inputs: IncomeInputs = {
        incomePeriod$: 5000,
        targets: { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 },
        actuals3m: { needsPct: 0.50, wantsPct: 0.32, savingsPct: 0.18 },
        shiftLimitPct: 0.04, // 4% = $200
      };
      
      const result = allocateIncome(inputs);
      
      // Target Savings = $1000, Actual = $900, Gap = $100
      // Available Wants above target = $1600 - $1500 = $100
      // Max shift = min($100, $200, $100) = $100
      // Should close gap fully
      
      expect(result.savings$).toBe(1000); // $900 + $100
      expect(result.wants$).toBe(1500); // $1600 - $100
      expect(result.needs$).toBe(2500); // Stays at actual
      expect(result.notes.some(n => n.includes('shift from Wants→Savings'))).toBe(true);
      expect(result.notes.some(n => n.includes('below target'))).toBe(false);
    });
  });
  
  describe('partial shift with flagged shortfall', () => {
    it('should apply partial shift when shift limit is smaller than gap', () => {
      const inputs: IncomeInputs = {
        incomePeriod$: 4000,
        targets: { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 },
        actuals3m: { needsPct: 0.50, wantsPct: 0.35, savingsPct: 0.15 },
        shiftLimitPct: 0.03, // 3% = $120, smaller than $200 gap
      };
      
      const result = allocateIncome(inputs);
      
      // Target Savings = $800, Actual = $600, Gap = $200
      // Available Wants above target = $1400 - $1200 = $200
      // Max shift = min($200, $120, $200) = $120
      // Should shift $120, leaving $80 gap
      
      expect(result.savings$).toBe(720); // $600 + $120
      expect(result.wants$).toBe(1280); // $1400 - $120
      expect(result.notes.some(n => n.includes('below target due to Wants floor'))).toBe(true);
    });
    
    it('should flag shortfall when Wants is already at or below target', () => {
      const inputs: IncomeInputs = {
        incomePeriod$: 4000,
        targets: { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 },
        actuals3m: { needsPct: 0.58, wantsPct: 0.25, savingsPct: 0.17 },
        shiftLimitPct: 0.04,
      };
      
      const result = allocateIncome(inputs);
      
      // Target Savings = $800, Actual = $680, Gap = $120
      // Available Wants above target = $1000 - $1200 = -$200 (below target)
      // Max shift = min($120, $160, 0) = 0
      // Cannot shift, should flag
      
      expect(result.savings$).toBe(680); // No change
      expect(result.wants$).toBe(1000); // No change
      expect(result.needs$).toBe(2320); // No change
      expect(result.notes.some(n => n.includes('below target due to Wants floor'))).toBe(true);
    });
  });
  
  describe('no change when savings >= target', () => {
    it('should not adjust when savings equals target', () => {
      const inputs: IncomeInputs = {
        incomePeriod$: 4000,
        targets: { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 },
        actuals3m: { needsPct: 0.50, wantsPct: 0.30, savingsPct: 0.20 },
        shiftLimitPct: 0.04,
      };
      
      const result = allocateIncome(inputs);
      
      expect(result.savings$).toBe(800); // At target
      expect(result.wants$).toBe(1200);
      expect(result.needs$).toBe(2000);
      expect(result.notes.some(n => n.includes('at or above target'))).toBe(true);
    });
    
    it('should not adjust when savings exceeds target', () => {
      const inputs: IncomeInputs = {
        incomePeriod$: 4000,
        targets: { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 },
        actuals3m: { needsPct: 0.48, wantsPct: 0.30, savingsPct: 0.22 },
        shiftLimitPct: 0.04,
      };
      
      const result = allocateIncome(inputs);
      
      expect(result.savings$).toBe(880); // Above target ($800)
      expect(result.wants$).toBe(1200);
      expect(result.needs$).toBe(1920);
      expect(result.notes.some(n => n.includes('at or above target'))).toBe(true);
    });
  });
  
  describe('totals sum exactly to income', () => {
    it('should reconcile rounding to ensure exact sum', () => {
      const inputs: IncomeInputs = {
        incomePeriod$: 3333.33, // Tricky number that might cause rounding issues
        targets: { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 },
        actuals3m: { needsPct: 0.50, wantsPct: 0.32, savingsPct: 0.18 },
        shiftLimitPct: 0.04,
      };
      
      const result = allocateIncome(inputs);
      
      const total = round2(result.needs$ + result.wants$ + result.savings$);
      expect(total).toBe(3333.33);
    });
    
    it('should handle various income amounts and ensure exact sum', () => {
      const testCases = [
        { income: 1000, needs: 0.5, wants: 0.3, savings: 0.2 },
        { income: 2500.50, needs: 0.55, wants: 0.25, savings: 0.20 },
        { income: 10000, needs: 0.48, wants: 0.32, savings: 0.20 },
      ];
      
      testCases.forEach(({ income, needs, wants, savings }) => {
        const inputs: IncomeInputs = {
          incomePeriod$: income,
          targets: { needsPct: needs, wantsPct: wants, savingsPct: savings },
          actuals3m: { needsPct: needs, wantsPct: wants, savingsPct: savings },
          shiftLimitPct: 0.04,
        };
        
        const result = allocateIncome(inputs);
        const total = round2(result.needs$ + result.wants$ + result.savings$);
        expect(total).toBe(income);
      });
    });
  });
  
  describe('edge cases', () => {
    it('should throw error if target percentages do not sum to 1.0', () => {
      const inputs: IncomeInputs = {
        incomePeriod$: 4000,
        targets: { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.15 }, // Sums to 0.95
        actuals3m: { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 },
        shiftLimitPct: 0.04,
      };
      
      expect(() => allocateIncome(inputs)).toThrow('Target percentages must sum to 1.0');
    });
    
    it('should throw error if actual percentages do not sum to 1.0', () => {
      const inputs: IncomeInputs = {
        incomePeriod$: 4000,
        targets: { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 },
        actuals3m: { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.15 }, // Sums to 0.95
        shiftLimitPct: 0.04,
      };
      
      expect(() => allocateIncome(inputs)).toThrow('Actual percentages must sum to 1.0');
    });
    
    it('should use default shiftLimitPct of 0.04 when not provided', () => {
      const inputs: IncomeInputs = {
        incomePeriod$: 4000,
        targets: { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 },
        actuals3m: { needsPct: 0.50, wantsPct: 0.35, savingsPct: 0.15 },
        // shiftLimitPct not provided
      };
      
      const result = allocateIncome(inputs);
      
      // Should use 4% = $160 as shift limit
      // Gap = $200, Available = $200, Shift limit = $160
      // Should shift $160
      expect(result.savings$).toBe(760); // $600 + $160
      expect(result.wants$).toBe(1240); // $1400 - $160
    });
    
    it('should handle very small gaps (less than 1 cent)', () => {
      const inputs: IncomeInputs = {
        incomePeriod$: 4000,
        targets: { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 },
        actuals3m: { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.20001 }, // Savings slightly above target
        shiftLimitPct: 0.04,
      };
      
      const result = allocateIncome(inputs);
      
      // Should not adjust for tiny gap
      expect(result.savings$).toBeGreaterThanOrEqual(800);
      expect(result.notes.some(n => n.includes('at or above target'))).toBe(true);
    });
  });
});

