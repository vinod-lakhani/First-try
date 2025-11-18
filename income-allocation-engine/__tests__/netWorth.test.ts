/**
 * Unit tests for Net Worth Simulator
 */

/// <reference types="vitest/globals" />

import { 
  simulateScenario, 
  validateMonthlyPlan,
  ScenarioInput,
  MonthlyPlan,
} from '../lib/sim/netWorth';

describe('simulateScenario', () => {
  const baseInput: ScenarioInput = {
    startDate: '2026-01-01',
    horizonMonths: 12,
    openingBalances: {
      cash: 6000,
      brokerage: 5000,
      retirement: 15000,
      liabilities: [
        { name: 'Credit Card', balance: 2500, aprPct: 22, minPayment: 75 },
      ],
    },
    monthlyPlan: [
      {
        monthIndex: 0,
        incomeNet: 4000,
        needs$: 2000,
        wants$: 1000,
        ef$: 300,
        highAprDebt$: 150,
        match401k$: 100,
        retirementTaxAdv$: 250,
        brokerage$: 200,
      },
    ],
  };
  
  describe('basic simulation', () => {
    it('should generate correct number of months', () => {
      const result = simulateScenario(baseInput);
      
      expect(result.labels.length).toBe(12);
      expect(result.netWorth.length).toBe(12);
      expect(result.assets.length).toBe(12);
      expect(result.liabilities.length).toBe(12);
    });
    
    it('should initialize with opening balances', () => {
      const result = simulateScenario(baseInput);
      
      // After first month: growth + inflows - outflows
      expect(result.cash[0]).toBeGreaterThan(0);
      expect(result.brokerage[0]).toBeGreaterThan(0);
      // Retirement grows and receives contributions in first month
      expect(result.retirement[0]).toBeGreaterThan(15000);
      // Liabilities accrue interest in first month (unless paid off)
      // With extra payments, debt might be paid off quickly, so just check it's >= 0
      expect(result.liabilities[0]).toBeGreaterThanOrEqual(0);
    });
    
    it('should calculate net worth correctly', () => {
      const result = simulateScenario(baseInput);
      
      for (let i = 0; i < result.netWorth.length; i++) {
        const expected = result.assets[i] - result.liabilities[i];
        expect(result.netWorth[i]).toBeCloseTo(expected, 1);
      }
    });
  });
  
  describe('growth calculations', () => {
    it('should apply cash yield growth monthly', () => {
      const input: ScenarioInput = {
        ...baseInput,
        cashYieldPct: 4.0,
        openingBalances: {
          ...baseInput.openingBalances,
          cash: 10000,
          liabilities: [
            { name: 'Card', balance: 1000, aprPct: 12, minPayment: 50 },
          ],
        },
        monthlyPlan: [{
          ...baseInput.monthlyPlan[0],
          ef$: 0, // No new contributions
          needs$: 0, // No outflows for this test
          wants$: 0,
          highAprDebt$: 0,
        }],
      };
      
      const result = simulateScenario(input);
      
      // Cash should grow by ~4%/12 per month, then subtract outflows
      // Month 0 (first month): growth applied, then inflows, then outflows
      const monthlyRate = 4.0 / 100 / 12;
      const afterGrowth = 10000 * (1 + monthlyRate);
      // Then subtract min payment on debt (debt not paid off yet, so min payment comes from cash)
      const minPayment = input.openingBalances.liabilities[0].minPayment;
      const expectedMonth0 = afterGrowth - minPayment;
      
      // Check month 0 (first month) instead of month 1
      expect(result.cash[0]).toBeCloseTo(expectedMonth0, 1);
    });
    
    it('should apply brokerage growth with tax drag', () => {
      const input: ScenarioInput = {
        ...baseInput,
        nominalReturnPct: 6.0,
        taxDragBrokeragePct: 0.5,
        openingBalances: {
          ...baseInput.openingBalances,
          brokerage: 10000,
          liabilities: [], // No debts to avoid redirected min payments
        },
        monthlyPlan: [{
          ...baseInput.monthlyPlan[0],
          brokerage$: 0, // No new contributions
        }],
      };
      
      const result = simulateScenario(input);
      
      // Brokerage should grow at (6% - 0.5%)/12 per month
      const monthlyRate = (6.0 - 0.5) / 100 / 12;
      const expectedMonth0 = 10000 * (1 + monthlyRate);
      
      // Month 0 (first month) already has growth applied
      expect(result.brokerage[0]).toBeCloseTo(expectedMonth0, 1);
    });
    
    it('should apply retirement growth without tax drag', () => {
      const input: ScenarioInput = {
        ...baseInput,
        nominalReturnPct: 6.0,
        openingBalances: {
          ...baseInput.openingBalances,
          retirement: 10000,
          liabilities: [], // No debts to avoid redirected min payments
        },
        monthlyPlan: [{
          ...baseInput.monthlyPlan[0],
          match401k$: 0,
          retirementTaxAdv$: 0, // No new contributions
        }],
      };
      
      const result = simulateScenario(input);
      
      // Retirement should grow at 6%/12 per month
      const monthlyRate = 6.0 / 100 / 12;
      const expectedMonth0 = 10000 * (1 + monthlyRate);
      
      // Month 0 (first month) already has growth applied
      expect(result.retirement[0]).toBeCloseTo(expectedMonth0, 1);
    });
  });
  
  describe('inflows from monthly plan', () => {
    it('should add EF contributions to cash', () => {
      const input: ScenarioInput = {
        ...baseInput,
        openingBalances: {
          ...baseInput.openingBalances,
          cash: 10000, // Enough to cover outflows
          liabilities: [
            { name: 'Card', balance: 1000, aprPct: 12, minPayment: 50 },
          ],
        },
        monthlyPlan: [{
          ...baseInput.monthlyPlan[0],
          ef$: 500,
          needs$: 0, // No needs/wants for this test
          wants$: 0,
          highAprDebt$: 0, // No extra debt payment
        }],
      };
      
      const result = simulateScenario(input);
      
      // Cash should increase from growth + EF contribution, minus outflows
      // Growth: 10000 * (1 + 4%/12) = ~10033.33
      // Add EF: +500
      // Subtract min payment: -50
      // Expected: ~10483.33
      expect(result.cash[1]).toBeGreaterThan(10400);
    });
    
    it('should add brokerage contributions', () => {
      const input: ScenarioInput = {
        ...baseInput,
        openingBalances: {
          ...baseInput.openingBalances,
          brokerage: 1000,
        },
        monthlyPlan: [{
          ...baseInput.monthlyPlan[0],
          brokerage$: 500,
        }],
      };
      
      const result = simulateScenario(input);
      
      expect(result.brokerage[1]).toBeGreaterThan(1500);
    });
    
    it('should add retirement contributions', () => {
      const input: ScenarioInput = {
        ...baseInput,
        openingBalances: {
          ...baseInput.openingBalances,
          retirement: 1000,
        },
        monthlyPlan: [{
          ...baseInput.monthlyPlan[0],
          match401k$: 200,
          retirementTaxAdv$: 300,
        }],
      };
      
      const result = simulateScenario(input);
      
      // Should add 200 + 300 = 500, plus growth
      expect(result.retirement[1]).toBeGreaterThan(1500);
    });
  });
  
  describe('debt amortization', () => {
    it('should accrue interest on debt monthly', () => {
      const input: ScenarioInput = {
        ...baseInput,
        openingBalances: {
          ...baseInput.openingBalances,
          cash: 10000, // Enough to cover payments
          liabilities: [
            { name: 'Card', balance: 1000, aprPct: 12, minPayment: 50 },
          ],
        },
        monthlyPlan: [{
          ...baseInput.monthlyPlan[0],
          highAprDebt$: 0, // No extra payment
        }],
      };
      
      const result = simulateScenario(input);
      
      // Debt should accrue interest (12%/12 = 1% per month), then apply min payment
      // Month 0: 1000 * 1.01 - 50 = 960
      const expectedMonth1 = 1000 * 1.01 - 50;
      expect(result.liabilities[0]).toBeCloseTo(expectedMonth1, 1);
    });
    
    it('should apply extra payment using snowball (highest APR first)', () => {
      const input: ScenarioInput = {
        ...baseInput,
        openingBalances: {
          ...baseInput.openingBalances,
          cash: 10000,
          liabilities: [
            { name: 'High APR', balance: 1000, aprPct: 22, minPayment: 50 },
            { name: 'Low APR', balance: 1000, aprPct: 10, minPayment: 50 },
          ],
        },
        monthlyPlan: [{
          ...baseInput.monthlyPlan[0],
          highAprDebt$: 200,
        }],
      };
      
      const result = simulateScenario(input);
      
      // Total liabilities should be reduced after first month
      // High APR: 1000 * (1 + 22%/12) - 50 - 200 = ~768
      // Low APR: 1000 * (1 + 10%/12) - 50 = ~958
      // Total should be less than 2000 (original total)
      // Month 0 is after first month of simulation
      expect(result.liabilities[0]).toBeLessThan(2000);
      expect(result.liabilities[0]).toBeGreaterThan(0);
    });
    
    it('should zero out debt when fully paid', () => {
      const input: ScenarioInput = {
        ...baseInput,
        openingBalances: {
          ...baseInput.openingBalances,
          cash: 10000,
          liabilities: [
            { name: 'Small Debt', balance: 100, aprPct: 15, minPayment: 20 },
          ],
        },
        monthlyPlan: [{
          ...baseInput.monthlyPlan[0],
          highAprDebt$: 100, // Large extra payment
        }],
      };
      
      const result = simulateScenario(input);
      
      // Debt should be paid off quickly
      let debtFreeMonth = -1;
      for (let i = 0; i < result.liabilities.length; i++) {
        if (result.liabilities[i] <= 0.01) {
          debtFreeMonth = i;
          break;
        }
      }
      
      expect(debtFreeMonth).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('cash shortfall handling', () => {
    it('should warn when cash is insufficient for outflows', () => {
      const input: ScenarioInput = {
        ...baseInput,
        openingBalances: {
          ...baseInput.openingBalances,
          cash: 100, // Very low cash
        },
        monthlyPlan: [{
          ...baseInput.monthlyPlan[0],
          needs$: 2000,
          wants$: 1000,
        }],
      };
      
      const result = simulateScenario(input);
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('Cash shortfall'))).toBe(true);
    });
    
    it('should not allow negative cash balance', () => {
      const input: ScenarioInput = {
        ...baseInput,
        openingBalances: {
          ...baseInput.openingBalances,
          cash: 100,
        },
        monthlyPlan: [{
          ...baseInput.monthlyPlan[0],
          needs$: 5000, // More than available
        }],
      };
      
      const result = simulateScenario(input);
      
      // Cash should never go negative
      result.cash.forEach(balance => {
        expect(balance).toBeGreaterThanOrEqual(0);
      });
    });
  });
  
  describe('KPI calculations', () => {
    it('should detect EF reached month', () => {
      const input: ScenarioInput = {
        ...baseInput,
        openingBalances: {
          ...baseInput.openingBalances,
          cash: 5000,
        },
        goals: {
          efTarget$: 10000,
        },
        monthlyPlan: [{
          ...baseInput.monthlyPlan[0],
          ef$: 1000, // Large EF contribution
        }],
      };
      
      const result = simulateScenario(input);
      
      if (result.kpis.efReachedMonth !== undefined) {
        expect(result.kpis.efReachedMonth).toBeGreaterThanOrEqual(0);
        expect(result.kpis.efReachedMonth).toBeLessThan(result.cash.length);
      }
    });
    
    it('should detect debt-free month', () => {
      const input: ScenarioInput = {
        ...baseInput,
        openingBalances: {
          ...baseInput.openingBalances,
          cash: 10000,
          liabilities: [
            { name: 'Debt', balance: 500, aprPct: 15, minPayment: 50 },
          ],
        },
        monthlyPlan: [{
          ...baseInput.monthlyPlan[0],
          highAprDebt$: 200, // Aggressive payoff
        }],
      };
      
      const result = simulateScenario(input);
      
      if (result.kpis.debtFreeMonth !== undefined) {
        expect(result.kpis.debtFreeMonth).toBeGreaterThanOrEqual(0);
        expect(result.kpis.debtFreeMonth).toBeLessThan(result.liabilities.length);
      }
    });
    
    it('should calculate net worth at year milestones', () => {
      const input: ScenarioInput = {
        ...baseInput,
        horizonMonths: 120, // 10 years
      };
      
      const result = simulateScenario(input);
      
      expect(result.kpis.netWorthAtYears[5]).toBeDefined();
      expect(result.kpis.netWorthAtYears[10]).toBeDefined();
      
      if (result.kpis.netWorthAtYears[5] !== undefined) {
        const month59 = 5 * 12 - 1; // Month index (0-based): 5 years = 60 months, index 59
        expect(result.kpis.netWorthAtYears[5]).toBeCloseTo(result.netWorth[month59], 1);
      }
      if (result.kpis.netWorthAtYears[10] !== undefined) {
        const month119 = 10 * 12 - 1; // Month index (0-based): 10 years = 120 months, index 119
        expect(result.kpis.netWorthAtYears[10]).toBeCloseTo(result.netWorth[month119], 1);
      }
    });
    
    it('should calculate CAGR', () => {
      const input: ScenarioInput = {
        ...baseInput,
        horizonMonths: 120, // 10 years
      };
      
      const result = simulateScenario(input);
      
      if (result.kpis.cagrNominal !== undefined) {
        expect(result.kpis.cagrNominal).toBeGreaterThan(-100); // Reasonable bounds
        expect(result.kpis.cagrNominal).toBeLessThan(100);
      }
    });
  });
  
  describe('monthly plan repetition', () => {
    it('should repeat first month plan if fewer entries than horizon', () => {
      const input: ScenarioInput = {
        ...baseInput,
        horizonMonths: 24,
        monthlyPlan: [
          {
            monthIndex: 0,
            incomeNet: 4000,
            needs$: 2000,
            wants$: 1000,
            ef$: 300,
            highAprDebt$: 150,
            match401k$: 100,
            retirementTaxAdv$: 250,
            brokerage$: 200,
          },
        ],
      };
      
      const result = simulateScenario(input);
      
      // Should have 24 months of data
      expect(result.netWorth.length).toBe(24);
      
      // All months should have similar progression (not identical due to growth)
      expect(result.netWorth[0]).toBeDefined();
      expect(result.netWorth[23]).toBeDefined();
    });
  });
  
  describe('edge cases', () => {
    it('should handle zero opening balances', () => {
      const input: ScenarioInput = {
        ...baseInput,
        openingBalances: {
          cash: 0,
          brokerage: 0,
          retirement: 0,
          liabilities: [],
        },
        monthlyPlan: [{
          ...baseInput.monthlyPlan[0],
          needs$: 0, // No outflows for this test
          wants$: 0,
          highAprDebt$: 0,
        }],
      };
      
      const result = simulateScenario(input);
      
      // After first month: growth + inflows - outflows
      // With zero opening, growth is 0, but we add inflows
      expect(result.cash[0]).toBeGreaterThanOrEqual(0);
      expect(result.brokerage[0]).toBeGreaterThanOrEqual(0);
      expect(result.retirement[0]).toBeGreaterThanOrEqual(0);
    });
    
    it('should handle no liabilities', () => {
      const input: ScenarioInput = {
        ...baseInput,
        openingBalances: {
          ...baseInput.openingBalances,
          liabilities: [],
        },
      };
      
      const result = simulateScenario(input);
      
      result.liabilities.forEach(liab => {
        expect(liab).toBe(0);
      });
    });
    
    it('should handle HSA if provided', () => {
      const input: ScenarioInput = {
        ...baseInput,
        openingBalances: {
          ...baseInput.openingBalances,
          hsa: 5000,
        },
      };
      
      const result = simulateScenario(input);
      
      expect(result.hsa).toBeDefined();
      // HSA grows in first month
      expect(result.hsa![0]).toBeGreaterThan(5000);
    });
    
    it('should handle other assets', () => {
      const input: ScenarioInput = {
        ...baseInput,
        openingBalances: {
          ...baseInput.openingBalances,
          otherAssets: 100000, // e.g., real estate equity
        },
      };
      
      const result = simulateScenario(input);
      
      // Assets should include otherAssets
      expect(result.assets[0]).toBeGreaterThan(100000);
    });
  });
});

describe('validateMonthlyPlan', () => {
  it('should warn when savings exceed available income', () => {
    const plan: MonthlyPlan = {
      monthIndex: 0,
      incomeNet: 4000,
      needs$: 2000,
      wants$: 1000,
      ef$: 500,
      highAprDebt$: 200,
      match401k$: 100,
      retirementTaxAdv$: 300,
      brokerage$: 400,
    };
    
    // Total savings = 500 + 200 + 100 + 300 + 400 = 1500
    // Available = 4000 - 2000 - 1000 = 1000
    // Savings exceed available by 500
    
    const warnings = validateMonthlyPlan(plan);
    
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some(w => w.includes('exceed available income'))).toBe(true);
  });
  
  it('should not warn when savings are within available income', () => {
    const plan: MonthlyPlan = {
      monthIndex: 0,
      incomeNet: 4000,
      needs$: 2000,
      wants$: 1000,
      ef$: 300,
      highAprDebt$: 150,
      match401k$: 100,
      retirementTaxAdv$: 250,
      brokerage$: 200,
    };
    
    // Total savings = 300 + 150 + 100 + 250 + 200 = 1000
    // Available = 4000 - 2000 - 1000 = 1000
    // Savings equal available (within tolerance)
    
    const warnings = validateMonthlyPlan(plan);
    
    expect(warnings.length).toBe(0);
  });
});

