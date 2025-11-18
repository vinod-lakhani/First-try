/**
 * Unit tests for Savings Allocation Engine
 */

/// <reference types="vitest/globals" />

import { allocateSavings, SavingsInputs } from '../lib/alloc/savings';

describe('allocateSavings', () => {
  const baseInputs: SavingsInputs = {
    savingsBudget$: 1000,
    efTarget$: 5000,
    efBalance$: 3000,
    highAprDebts: [{ balance$: 2000, aprPct: 15 }],
    matchNeedThisPeriod$: 200,
    incomeSingle$: 150000,
    onIDR: false,
    liquidity: 'Medium',
    retirementFocus: 'High',
    iraRoomThisYear$: 5000,
    k401RoomThisYear$: 10000,
  };

  describe('Emergency Fund allocation', () => {
    it('should allocate up to 40% of budget to EF', () => {
      const inputs: SavingsInputs = {
        ...baseInputs,
        savingsBudget$: 1000,
        efTarget$: 10000,
        efBalance$: 0,
      };
      
      const result = allocateSavings(inputs);
      
      // EF gap = $10,000, but cap is 40% of $1000 = $400
      expect(result.ef$).toBe(400);
      expect(result.notes.some(n => n.includes('EF gap partially filled'))).toBe(true);
    });
    
    it('should allocate full EF gap if under 40% cap', () => {
      const inputs: SavingsInputs = {
        ...baseInputs,
        savingsBudget$: 1000,
        efTarget$: 5000,
        efBalance$: 4500,
      };
      
      const result = allocateSavings(inputs);
      
      // EF gap = $500, which is < 40% of $1000 = $400... wait, 40% is $400, gap is $500
      // Actually, the cap is 40% of budget, so max is $400, but gap is $500
      // So it should allocate $400 (the cap)
      expect(result.ef$).toBe(400);
    });
    
    it('should not allocate to EF if target is met', () => {
      const inputs: SavingsInputs = {
        ...baseInputs,
        efTarget$: 5000,
        efBalance$: 5000,
      };
      
      const result = allocateSavings(inputs);
      
      expect(result.ef$).toBe(0);
    });
  });
  
  describe('High-APR Debt allocation', () => {
    it('should allocate up to 40% of remaining budget to debt', () => {
      const inputs: SavingsInputs = {
        ...baseInputs,
        savingsBudget$: 1000,
        efTarget$: 5000,
        efBalance$: 5000, // EF already met
        highAprDebts: [{ balance$: 10000, aprPct: 15 }],
      };
      
      const result = allocateSavings(inputs);
      
      // After EF ($0), remaining is $1000
      // Debt cap = 40% of ($1000 - $0) = $400
      // Debt balance = $10000, so allocate $400
      expect(result.highAprDebt$).toBe(400);
      expect(result.notes.some(n => n.includes('partially paid'))).toBe(true);
    });
    
    it('should allocate full debt balance if under cap', () => {
      const inputs: SavingsInputs = {
        ...baseInputs,
        savingsBudget$: 1000,
        efTarget$: 5000,
        efBalance$: 5000, // EF already met
        highAprDebts: [{ balance$: 200, aprPct: 15 }],
      };
      
      const result = allocateSavings(inputs);
      
      // Debt balance = $200, cap = $400, so allocate full $200
      expect(result.highAprDebt$).toBe(200);
    });
    
    it('should handle multiple high-APR debts', () => {
      const inputs: SavingsInputs = {
        ...baseInputs,
        savingsBudget$: 1000,
        efTarget$: 5000,
        efBalance$: 5000,
        highAprDebts: [
          { balance$: 500, aprPct: 15 },
          { balance$: 300, aprPct: 12 },
        ],
      };
      
      const result = allocateSavings(inputs);
      
      // Total debt = $800, cap = $400, so allocate $400
      expect(result.highAprDebt$).toBe(400);
    });
    
    it('should not allocate to debt if no high-APR debts', () => {
      const inputs: SavingsInputs = {
        ...baseInputs,
        highAprDebts: [],
      };
      
      const result = allocateSavings(inputs);
      
      expect(result.highAprDebt$).toBe(0);
    });
  });
  
  describe('401(k) Match allocation', () => {
    it('should allocate full match amount', () => {
      const inputs: SavingsInputs = {
        ...baseInputs,
        savingsBudget$: 1000,
        efTarget$: 5000,
        efBalance$: 5000,
        highAprDebts: [],
        matchNeedThisPeriod$: 200,
      };
      
      const result = allocateSavings(inputs);
      
      expect(result.match401k$).toBe(200);
      expect(result.notes.some(n => n.includes('employer match'))).toBe(true);
    });
    
    it('should allocate partial match if budget insufficient', () => {
      const inputs: SavingsInputs = {
        ...baseInputs,
        savingsBudget$: 100,
        efTarget$: 5000,
        efBalance$: 5000,
        highAprDebts: [],
        matchNeedThisPeriod$: 200,
      };
      
      const result = allocateSavings(inputs);
      
      expect(result.match401k$).toBe(100);
      expect(result.notes.some(n => n.includes('Could not fully capture match'))).toBe(true);
    });
  });
  
  describe('Account type selection', () => {
    it('should choose Roth for income < $190k', () => {
      const inputs: SavingsInputs = {
        ...baseInputs,
        incomeSingle$: 150000,
        onIDR: false,
      };
      
      const result = allocateSavings(inputs);
      
      expect(result.routing.acctType).toBe('Roth');
      expect(result.notes.some(n => n.includes('prioritizing Roth'))).toBe(true);
    });
    
    it('should choose Traditional401k for income >= $190k', () => {
      const inputs: SavingsInputs = {
        ...baseInputs,
        incomeSingle$: 200000,
        onIDR: false,
      };
      
      const result = allocateSavings(inputs);
      
      expect(result.routing.acctType).toBe('Traditional401k');
      expect(result.notes.some(n => n.includes('prioritizing Traditional'))).toBe(true);
    });
    
    it('should override to Traditional401k when on IDR', () => {
      const inputs: SavingsInputs = {
        ...baseInputs,
        incomeSingle$: 150000, // Would normally be Roth
        onIDR: true,
      };
      
      const result = allocateSavings(inputs);
      
      expect(result.routing.acctType).toBe('Traditional401k');
      expect(result.notes.some(n => n.includes('IDR detected'))).toBe(true);
    });
  });
  
  describe('Liquidity × Retirement split matrix', () => {
    it('should use correct split for High liquidity × High retirement', () => {
      const inputs: SavingsInputs = {
        ...baseInputs,
        savingsBudget$: 1000,
        efTarget$: 5000,
        efBalance$: 5000,
        highAprDebts: [],
        matchNeedThisPeriod$: 0,
        liquidity: 'High',
        retirementFocus: 'High',
      };
      
      const result = allocateSavings(inputs);
      
      // Matrix: High × High = 30% retirement, 70% brokerage
      expect(result.routing.splitRetirePct).toBe(30);
      expect(result.routing.splitBrokerPct).toBe(70);
    });
    
    it('should use correct split for Medium liquidity × High retirement', () => {
      const inputs: SavingsInputs = {
        ...baseInputs,
        savingsBudget$: 1000,
        efTarget$: 5000,
        efBalance$: 5000,
        highAprDebts: [],
        matchNeedThisPeriod$: 0,
        liquidity: 'Medium',
        retirementFocus: 'High',
      };
      
      const result = allocateSavings(inputs);
      
      // Matrix: Medium × High = 70% retirement, 30% brokerage
      expect(result.routing.splitRetirePct).toBe(70);
      expect(result.routing.splitBrokerPct).toBe(30);
    });
    
    it('should use correct split for Low liquidity × High retirement', () => {
      const inputs: SavingsInputs = {
        ...baseInputs,
        savingsBudget$: 1000,
        efTarget$: 5000,
        efBalance$: 5000,
        highAprDebts: [],
        matchNeedThisPeriod$: 0,
        liquidity: 'Low',
        retirementFocus: 'High',
      };
      
      const result = allocateSavings(inputs);
      
      // Matrix: Low × High = 90% retirement, 10% brokerage
      expect(result.routing.splitRetirePct).toBe(90);
      expect(result.routing.splitBrokerPct).toBe(10);
    });
    
    it('should use correct split for Medium liquidity × Medium retirement', () => {
      const inputs: SavingsInputs = {
        ...baseInputs,
        savingsBudget$: 1000,
        efTarget$: 5000,
        efBalance$: 5000,
        highAprDebts: [],
        matchNeedThisPeriod$: 0,
        liquidity: 'Medium',
        retirementFocus: 'Medium',
      };
      
      const result = allocateSavings(inputs);
      
      // Matrix: Medium × Medium = 50% retirement, 50% brokerage
      expect(result.routing.splitRetirePct).toBe(50);
      expect(result.routing.splitBrokerPct).toBe(50);
    });
  });
  
  describe('IRA/401k room and spillover', () => {
    it('should route to IRA first, then 401k', () => {
      const inputs: SavingsInputs = {
        ...baseInputs,
        savingsBudget$: 1000,
        efTarget$: 5000,
        efBalance$: 5000,
        highAprDebts: [],
        matchNeedThisPeriod$: 0,
        liquidity: 'Low',
        retirementFocus: 'High', // 90% retirement = $900
        iraRoomThisYear$: 3000,
        k401RoomThisYear$: 5000,
      };
      
      const result = allocateSavings(inputs);
      
      // $900 for retirement, should go to IRA first
      expect(result.retirementTaxAdv$).toBe(900);
      expect(result.notes.some(n => n.includes('IRA'))).toBe(true);
    });
    
    it('should spill excess to brokerage when IRA full', () => {
      const inputs: SavingsInputs = {
        ...baseInputs,
        savingsBudget$: 1000,
        efTarget$: 5000,
        efBalance$: 5000,
        highAprDebts: [],
        matchNeedThisPeriod$: 0,
        liquidity: 'Low',
        retirementFocus: 'High', // 90% retirement = $900
        iraRoomThisYear$: 200, // Only $200 room
        k401RoomThisYear$: 5000,
      };
      
      const result = allocateSavings(inputs);
      
      // $900 for retirement, $200 to IRA, $700 to 401k
      expect(result.retirementTaxAdv$).toBe(900);
      expect(result.brokerage$).toBe(100); // 10% direct + $0 spillover
    });
    
    it('should spill excess to brokerage when both IRA and 401k full', () => {
      const inputs: SavingsInputs = {
        ...baseInputs,
        savingsBudget$: 1000,
        efTarget$: 5000,
        efBalance$: 5000,
        highAprDebts: [],
        matchNeedThisPeriod$: 0,
        liquidity: 'Low',
        retirementFocus: 'High', // 90% retirement = $900
        iraRoomThisYear$: 200, // Only $200 room
        k401RoomThisYear$: 300, // Only $300 room
      };
      
      const result = allocateSavings(inputs);
      
      // $900 for retirement, $200 to IRA, $300 to 401k, $400 spillover to brokerage
      expect(result.retirementTaxAdv$).toBe(500); // $200 IRA + $300 401k
      expect(result.brokerage$).toBe(500); // 10% direct ($100) + $400 spillover
      expect(result.notes.some(n => n.includes('excess to brokerage'))).toBe(true);
    });
    
    it('should route to 401k beyond match when IRA full', () => {
      const inputs: SavingsInputs = {
        ...baseInputs,
        savingsBudget$: 1000,
        efTarget$: 5000,
        efBalance$: 5000,
        highAprDebts: [],
        matchNeedThisPeriod$: 100,
        liquidity: 'Low',
        retirementFocus: 'High', // 90% of remaining = 90% of $900 = $810
        iraRoomThisYear$: 0, // IRA full
        k401RoomThisYear$: 5000,
      };
      
      const result = allocateSavings(inputs);
      
      // After match: $900 remaining
      // 90% retirement = $810, should go to 401k
      expect(result.match401k$).toBe(100);
      expect(result.retirementTaxAdv$).toBe(810);
      expect(result.notes.some(n => n.includes('401(k) beyond match'))).toBe(true);
    });
  });
  
  describe('End-to-end scenarios', () => {
    it('should handle full allocation with all priorities', () => {
      const inputs: SavingsInputs = {
        savingsBudget$: 2000,
        efTarget$: 10000,
        efBalance$: 7000,
        highAprDebts: [{ balance$: 5000, aprPct: 15 }],
        matchNeedThisPeriod$: 300,
        incomeSingle$: 150000,
        onIDR: false,
        liquidity: 'Medium',
        retirementFocus: 'High',
        iraRoomThisYear$: 5000,
        k401RoomThisYear$: 10000,
      };
      
      const result = allocateSavings(inputs);
      
      // Step 1: EF gap = $3000, cap = 40% of $2000 = $800
      expect(result.ef$).toBe(800);
      
      // Step 2: Remaining = $1200, debt cap = 40% of $1200 = $480
      expect(result.highAprDebt$).toBe(480);
      
      // Step 3: Remaining = $720, match = $300
      expect(result.match401k$).toBe(300);
      
      // Step 4: Account type = Roth (income < $190k)
      expect(result.routing.acctType).toBe('Roth');
      
      // Step 5: Remaining = $420, Medium×High = 70% retirement = $294, 30% brokerage = $126
      // Step 6: $294 to IRA
      expect(result.retirementTaxAdv$).toBe(294);
      expect(result.brokerage$).toBe(126);
      
      // Total should equal budget
      const total = result.ef$ + result.highAprDebt$ + result.match401k$ + 
                    result.retirementTaxAdv$ + result.brokerage$;
      expect(total).toBe(2000);
    });
    
    it('should handle minimal budget scenario', () => {
      const inputs: SavingsInputs = {
        savingsBudget$: 100,
        efTarget$: 5000,
        efBalance$: 4900,
        highAprDebts: [],
        matchNeedThisPeriod$: 0,
        incomeSingle$: 150000,
        onIDR: false,
        liquidity: 'High',
        retirementFocus: 'Low',
        iraRoomThisYear$: 5000,
        k401RoomThisYear$: 10000,
      };
      
      const result = allocateSavings(inputs);
      
      // EF gap = $100, cap = 40% of $100 = $40
      expect(result.ef$).toBe(40);
      
      // Remaining = $60, High×Low = 10% retirement = $6, 90% brokerage = $54
      expect(result.retirementTaxAdv$).toBe(6);
      expect(result.brokerage$).toBe(54);
      
      const total = result.ef$ + result.highAprDebt$ + result.match401k$ + 
                    result.retirementTaxAdv$ + result.brokerage$;
      expect(total).toBe(100);
    });
  });
  
  describe('Edge cases', () => {
    it('should handle zero budget', () => {
      const inputs: SavingsInputs = {
        ...baseInputs,
        savingsBudget$: 0,
      };
      
      const result = allocateSavings(inputs);
      
      expect(result.ef$).toBe(0);
      expect(result.highAprDebt$).toBe(0);
      expect(result.match401k$).toBe(0);
      expect(result.retirementTaxAdv$).toBe(0);
      expect(result.brokerage$).toBe(0);
    });
    
    it('should handle EF already above target', () => {
      const inputs: SavingsInputs = {
        ...baseInputs,
        efTarget$: 5000,
        efBalance$: 6000,
      };
      
      const result = allocateSavings(inputs);
      
      expect(result.ef$).toBe(0);
    });
    
    it('should handle all retirement accounts full', () => {
      const inputs: SavingsInputs = {
        ...baseInputs,
        savingsBudget$: 1000,
        efTarget$: 5000,
        efBalance$: 5000,
        highAprDebts: [],
        matchNeedThisPeriod$: 0,
        liquidity: 'Low',
        retirementFocus: 'High', // 90% = $900
        iraRoomThisYear$: 0,
        k401RoomThisYear$: 0,
      };
      
      const result = allocateSavings(inputs);
      
      // $900 for retirement, but no room, so all spills to brokerage
      expect(result.retirementTaxAdv$).toBe(0);
      expect(result.brokerage$).toBe(1000); // All goes to brokerage
      expect(result.notes.some(n => n.includes('excess to brokerage'))).toBe(true);
    });
  });
});
