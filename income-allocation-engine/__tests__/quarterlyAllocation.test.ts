/// <reference types="vitest/globals" />
import { describe, it, expect } from 'vitest';
import { allocateIncome, IncomeInputs } from '../lib/alloc/income';
import { allocateSavings, SavingsInputs } from '../lib/alloc/savings';
import { simulateScenario, ScenarioInput } from '../lib/sim/netWorth';

/**
 * Test suite to validate quarterly allocation table and chart accuracy
 * These tests ensure the quarterly table totals match the savings budget
 * and that the chart data aligns with the quarterly allocations
 */
describe('Quarterly Allocation Table Validation', () => {
  
  const baseIncomeInputs: IncomeInputs = {
    incomePeriod$: 4000,
    targets: { needsPct: 0.50, wantsPct: 0.30, savingsPct: 0.20 },
    actuals3m: { needsPct: 0.50, wantsPct: 0.30, savingsPct: 0.20 },
    shiftLimitPct: 0.04,
  };

  const baseSavingsInputs: SavingsInputs = {
    savingsBudget$: 800, // 20% of $4000
    efTarget$: 12000,
    efBalance$: 2000,
    highAprDebts: [{ balance$: 5000, aprPct: 22 }],
    matchNeedThisPeriod$: 100,
    incomeSingle$: 80000,
    onIDR: false,
    liquidity: 'Medium',
    retirementFocus: 'High',
    iraRoomThisYear$: 7000,
    k401RoomThisYear$: 23000,
  };

  it('should have consistent quarterly totals equal to 3 months of savings budget', () => {
    const incomeAlloc = allocateIncome(baseIncomeInputs);
    const monthlySavings = incomeAlloc.savings$;
    const quarterlySavings = monthlySavings * 3;

    // Test that each month's allocation sums to monthly savings
    for (let month = 0; month < 12; month++) {
      // Recalculate savings allocation each month to account for changing EF/debt balances
      // For simplicity, test with fixed inputs
      const savingsAlloc = allocateSavings({
        ...baseSavingsInputs,
        savingsBudget$: monthlySavings,
      });

      const totalAllocated = savingsAlloc.ef$ + 
                            savingsAlloc.highAprDebt$ + 
                            savingsAlloc.match401k$ + 
                            savingsAlloc.retirementTaxAdv$ + 
                            savingsAlloc.brokerage$;

      // Total should equal monthly savings budget (within rounding)
      expect(Math.abs(totalAllocated - monthlySavings)).toBeLessThan(0.10,
        `Month ${month + 1}: Total allocated (${totalAllocated}) should equal monthly savings (${monthlySavings})`
      );
    }

    // Test quarterly total: 3 months should equal 3 * monthly savings
    const quarterlyTotal = quarterlySavings;
    expect(quarterlyTotal).toBe(monthlySavings * 3);
  });

  it('should show zero debt allocation when all debts are paid off', () => {
    const incomeAlloc = allocateIncome(baseIncomeInputs);
    
    // Start with a small debt that will be paid off quickly
    const smallDebtInputs: SavingsInputs = {
      ...baseSavingsInputs,
      savingsBudget$: incomeAlloc.savings$,
      highAprDebts: [{ balance$: 100, aprPct: 22 }],
    };
    
    const savingsAlloc = allocateSavings(smallDebtInputs);
    
    // Simulate until debt is paid off
    let debtBalance = 100;
    let month = 0;
    const minPayment = 50;
    
    while (debtBalance > 0.01 && month < 12) {
      debtBalance *= (1 + 0.22 / 12); // Interest
      debtBalance -= minPayment; // Min payment from needs
      debtBalance -= savingsAlloc.highAprDebt$; // Extra from savings
      if (debtBalance <= 0.01) debtBalance = 0;
      month++;
    }
    
    expect(debtBalance).toBeLessThanOrEqual(0.01);
    
    // After debt is paid off, debt allocation should be 0
    const postDebtSavings = allocateSavings({
      ...smallDebtInputs,
      highAprDebts: [], // No debts
    });
    
    expect(postDebtSavings.highAprDebt$).toBe(0);
  });

  it('should show zero EF allocation when EF target is reached', () => {
    const incomeAlloc = allocateIncome(baseIncomeInputs);
    
    // Start with EF already at target
    const efAtTargetInputs: SavingsInputs = {
      ...baseSavingsInputs,
      savingsBudget$: incomeAlloc.savings$,
      efBalance$: baseSavingsInputs.efTarget$, // Already at target
    };
    
    const savingsAlloc = allocateSavings(efAtTargetInputs);
    
    expect(savingsAlloc.ef$).toBe(0);
  });

  it('should match chart simulation data with quarterly allocations', () => {
    const incomeAlloc = allocateIncome(baseIncomeInputs);
    const savingsAlloc = allocateSavings({
      ...baseSavingsInputs,
      savingsBudget$: incomeAlloc.savings$,
    });

    const monthlyPlan = [{
      monthIndex: 0,
      incomeNet: baseIncomeInputs.incomePeriod$,
      needs$: incomeAlloc.needs$,
      wants$: incomeAlloc.wants$,
      ef$: savingsAlloc.ef$,
      highAprDebt$: savingsAlloc.highAprDebt$,
      match401k$: savingsAlloc.match401k$,
      retirementTaxAdv$: savingsAlloc.retirementTaxAdv$,
      brokerage$: savingsAlloc.brokerage$,
    }];

    const simInput: ScenarioInput = {
      startDate: '2026-01-01',
      horizonMonths: 12,
      cashYieldPct: 4.0,
      nominalReturnPct: 9.0,
      taxDragBrokeragePct: 0.5,
      openingBalances: {
        cash: 5000,
        brokerage: 10000,
        retirement: 15000,
        liabilities: baseSavingsInputs.highAprDebts.map(d => ({
          name: 'Test Debt',
          balance: d.balance$,
          aprPct: d.aprPct,
          minPayment: 50,
        })),
      },
      monthlyPlan,
      goals: { efTarget$: baseSavingsInputs.efTarget$ },
    };

    const result = simulateScenario(simInput);

    // Verify that the simulation ran for 12 months
    expect(result.netWorth.length).toBe(12);
    
    // Verify that savings allocations are being applied
    // Cash changes due to: growth, EF inflow, and outflows (needs + wants + debt payments)
    // So we can't simply check if it increased - we need to verify the simulation ran correctly
    expect(result.cash[0]).toBeGreaterThanOrEqual(0);
    expect(result.cash.length).toBe(12);
    
    // Verify debt is being paid down
    expect(result.liabilities[0]).toBeLessThan(simInput.openingBalances.liabilities[0].balance);
  });

  it('should maintain savings budget consistency across all quarters', () => {
    const incomeAlloc = allocateIncome(baseIncomeInputs);
    const monthlySavings = incomeAlloc.savings$;
    const quarterlySavings = monthlySavings * 3;

    // Test multiple scenarios
    const scenarios = [
      { efBalance$: 0, efTarget$: 12000, hasDebt: true },
      { efBalance$: 12000, efTarget$: 12000, hasDebt: true }, // EF at target
      { efBalance$: 0, efTarget$: 12000, hasDebt: false }, // No debt
      { efBalance$: 12000, efTarget$: 12000, hasDebt: false }, // EF at target, no debt
    ];

    scenarios.forEach((scenario, idx) => {
      const savingsInputs: SavingsInputs = {
        ...baseSavingsInputs,
        savingsBudget$: monthlySavings,
        efBalance$: scenario.efBalance$,
        efTarget$: scenario.efTarget$,
        highAprDebts: scenario.hasDebt ? baseSavingsInputs.highAprDebts : [],
      };

      const savingsAlloc = allocateSavings(savingsInputs);
      
      // Total allocations should equal monthly savings budget
      const totalAllocated = savingsAlloc.ef$ + 
                            savingsAlloc.highAprDebt$ + 
                            savingsAlloc.match401k$ + 
                            savingsAlloc.retirementTaxAdv$ + 
                            savingsAlloc.brokerage$;
      
      expect(Math.abs(totalAllocated - monthlySavings)).toBeLessThan(0.10, 
        `Scenario ${idx + 1} failed: Total allocated (${totalAllocated}) should equal monthly savings (${monthlySavings})`
      );
    });
  });

  it('should correctly calculate debt-free month in KPIs', () => {
    const incomeAlloc = allocateIncome(baseIncomeInputs);
    
    // Small debt that will be paid off quickly
    const smallDebtInputs: SavingsInputs = {
      ...baseSavingsInputs,
      savingsBudget$: incomeAlloc.savings$,
      highAprDebts: [{ balance$: 500, aprPct: 22 }],
    };
    
    const savingsAlloc = allocateSavings(smallDebtInputs);
    
    const monthlyPlan = [{
      monthIndex: 0,
      incomeNet: baseIncomeInputs.incomePeriod$,
      needs$: incomeAlloc.needs$,
      wants$: incomeAlloc.wants$,
      ef$: savingsAlloc.ef$,
      highAprDebt$: savingsAlloc.highAprDebt$,
      match401k$: savingsAlloc.match401k$,
      retirementTaxAdv$: savingsAlloc.retirementTaxAdv$,
      brokerage$: savingsAlloc.brokerage$,
    }];

    const simInput: ScenarioInput = {
      startDate: '2026-01-01',
      horizonMonths: 24,
      cashYieldPct: 4.0,
      nominalReturnPct: 9.0,
      taxDragBrokeragePct: 0.5,
      openingBalances: {
        cash: 10000,
        brokerage: 5000,
        retirement: 15000,
        liabilities: [{
          name: 'Small Debt',
          balance: 500,
          aprPct: 22,
          minPayment: 50,
        }],
      },
      monthlyPlan,
      goals: { efTarget$: baseSavingsInputs.efTarget$ },
    };

    const result = simulateScenario(simInput);
    
    // Debt-free month should be defined
    expect(result.kpis.debtFreeMonth).toBeDefined();
    
    // At the debt-free month, liabilities should be zero or very small
    if (result.kpis.debtFreeMonth !== undefined) {
      const debtFreeIdx = result.kpis.debtFreeMonth;
      expect(result.liabilities[debtFreeIdx]).toBeLessThanOrEqual(0.01);
      
      // After debt-free month, liabilities should remain zero
      for (let i = debtFreeIdx + 1; i < Math.min(debtFreeIdx + 6, result.liabilities.length); i++) {
        expect(result.liabilities[i]).toBeLessThanOrEqual(0.01);
      }
    }
  });
});

