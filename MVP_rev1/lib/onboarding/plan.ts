/**
 * Plan Generation Helper
 * 
 * Wraps the income allocation engine to generate paycheck plans from onboarding state.
 */

import { allocateIncome, type IncomeInputs } from '@/lib/alloc/income';
import { allocateSavings, type SavingsInputs } from '@/lib/alloc/savings';
import { simulateScenario, simulateScenarioWithMonthlyDelta, type ScenarioInput, type MonthlyPlan as SimMonthlyPlan } from '@/lib/sim/netWorth';
import { calculatePreTaxSavings, calculateEmployerMatch, getGrossIncomeMonthly } from '@/lib/utils/savingsCalculations';
import type { OnboardingState, PaycheckPlan, PrimaryGoal, PayFrequency } from './types';

// Helper to round to 2 decimal places
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Generates an initial paycheck plan from onboarding state using the income allocation engine.
 * 
 * Falls back to default split if engine can't compute due to missing fields.
 */
export function generateInitialPaycheckPlanFromEngines(
  state: OnboardingState
): PaycheckPlan {
  const { income, riskConstraints, fixedExpenses } = state;

  // Validate we have minimum required data
  // Prefer netIncome$ (take home pay), but fall back to grossIncome$ if needed
  if (!income || (!income.netIncome$ && !income.grossIncome$)) {
    throw new Error('Income data is required to generate a plan');
  }

  // Use netIncome$ (take home pay) if available, otherwise use grossIncome$ as approximation
  const incomePeriod$ = income.netIncome$ || income.grossIncome$ || 0;
  
  // Get targets from riskConstraints or use defaults based on primary goal
  const defaultTargets = getDefaultTargetsForGoal(state.primaryGoal);
  let targets = riskConstraints?.targets || defaultTargets;
  
  // Normalize targets if they're in whole number format (e.g., 50, 30, 20) to decimals (0.5, 0.3, 0.2)
  const targetSum = targets.needsPct + targets.wantsPct + targets.savingsPct;
  if (Math.abs(targetSum - 100) < 1 && Math.abs(targetSum - 1.0) > 0.1) {
    // They're in whole number format, convert to decimals
    targets = {
      needsPct: targets.needsPct / 100,
      wantsPct: targets.wantsPct / 100,
      savingsPct: targets.savingsPct / 100,
    };
  }
  
  // Get shift limit from riskConstraints or use default
  // Convert from percentage (e.g., 4.0) to decimal (0.04) if needed
  let shiftLimitPct = riskConstraints?.shiftLimitPct ?? 0.04;
  if (shiftLimitPct > 1) {
    shiftLimitPct = shiftLimitPct / 100; // Convert 4.0 to 0.04
  }
  
  // Calculate actuals3m from riskConstraints if available, otherwise from fixedExpenses
  let actuals3m = riskConstraints?.actuals3m;
  console.log('[Paycheck Plan] Initial actuals3m from riskConstraints:', actuals3m);
  
  // Normalize actuals3m if they're in whole number format
  if (actuals3m) {
    const actualsSum = actuals3m.needsPct + actuals3m.wantsPct + actuals3m.savingsPct;
    if (Math.abs(actualsSum - 100) < 1 && Math.abs(actualsSum - 1.0) > 0.1) {
      // They're in whole number format, convert to decimals
      actuals3m = {
        needsPct: actuals3m.needsPct / 100,
        wantsPct: actuals3m.wantsPct / 100,
        savingsPct: actuals3m.savingsPct / 100,
      };
    }
  }
  
  if (!actuals3m) {
    try {
      console.log('[Paycheck Plan] Calculating actuals from expenses...', {
        fixedExpensesCount: fixedExpenses.length,
        incomePeriod$,
        targets,
      });
        actuals3m = calculateActualsFromExpenses(
          fixedExpenses,
          incomePeriod$,
          targets,
          income.payFrequency,
          state.debts
        );
      console.log('[Paycheck Plan] Calculated actuals3m from expenses:', actuals3m);
    } catch (error) {
      // If calculation fails, use targets as baseline
      console.warn('Failed to calculate actuals from expenses, using targets:', error);
      actuals3m = targets;
      console.log('[Paycheck Plan] Using targets as actuals3m fallback:', actuals3m);
    }
  }

  // Ensure actuals3m sums to 1.0 (required by engine)
  const actualsSum = actuals3m.needsPct + actuals3m.wantsPct + actuals3m.savingsPct;
  if (Math.abs(actualsSum - 1.0) > 0.001) {
    // Normalize to sum to 1.0
    actuals3m = {
      needsPct: actuals3m.needsPct / actualsSum,
      wantsPct: actuals3m.wantsPct / actualsSum,
      savingsPct: actuals3m.savingsPct / actualsSum,
    };
  }
  
  console.log('[Paycheck Plan] Final values being passed to income allocation engine:', {
    incomePeriod$,
    targets,
    actuals3m,
    shiftLimitPct,
  });

  try {
    // Call the income allocation engine
    console.log('[Income Allocation Engine] Calling allocateIncome with:', {
      incomePeriod$,
      targets,
      actuals3m,
      shiftLimitPct,
    });
    const allocation = allocateIncome({
      incomePeriod$,
      targets,
      actuals3m,
      shiftLimitPct,
    });
    console.log('[Income Allocation Engine] Result:', allocation);

    // Build categories for visualization
    const categories = [
      {
        name: 'Needs',
        amount$: allocation.needs$,
        percentage: (allocation.needs$ / incomePeriod$) * 100,
        color: '#3b82f6', // blue
      },
      {
        name: 'Wants',
        amount$: allocation.wants$,
        percentage: (allocation.wants$ / incomePeriod$) * 100,
        color: '#10b981', // green
      },
      {
        name: 'Savings',
        amount$: allocation.savings$,
        percentage: (allocation.savings$ / incomePeriod$) * 100,
        color: '#8b5cf6', // purple
      },
    ];

    return {
      needs$: allocation.needs$,
      wants$: allocation.wants$,
      savings$: allocation.savings$,
      categories,
      notes: allocation.notes,
    };
  } catch (error) {
    // Fallback to default split if engine fails
    console.warn('Income allocation engine failed, using fallback:', error);
    return getFallbackPlan(incomePeriod$, state.primaryGoal);
  }
}

/**
 * Gets default target percentages based on primary goal
 */
function getDefaultTargetsForGoal(goal?: PrimaryGoal): {
  needsPct: number;
  wantsPct: number;
  savingsPct: number;
} {
  switch (goal) {
    case 'emergency-fund':
      return { needsPct: 0.50, wantsPct: 0.25, savingsPct: 0.25 };
    case 'debt-free':
      return { needsPct: 0.50, wantsPct: 0.20, savingsPct: 0.30 };
    case 'retirement':
      return { needsPct: 0.50, wantsPct: 0.25, savingsPct: 0.25 };
    case 'house-down-payment':
      return { needsPct: 0.50, wantsPct: 0.20, savingsPct: 0.30 };
    default:
      // Standard 50/30/20 rule
      return { needsPct: 0.50, wantsPct: 0.30, savingsPct: 0.20 };
  }
}

/**
 * Calculates actual spending percentages from fixed expenses
 */
function calculateActualsFromExpenses(
  fixedExpenses: OnboardingState['fixedExpenses'],
  incomePeriod$: number,
  fallbackTargets: { needsPct: number; wantsPct: number; savingsPct: number },
  incomePayFrequency?: PayFrequency,
  debts?: OnboardingState['debts']
): { needsPct: number; wantsPct: number; savingsPct: number } {
  if (fixedExpenses.length === 0 && (!debts || debts.length === 0)) {
    // No expenses data, use targets as baseline
    return fallbackTargets;
  }

  // Calculate monthly totals from expenses
  let needsTotal = 0;
  let wantsTotal = 0;

  for (const expense of fixedExpenses) {
    // All expenses should be stored as monthly (single source of truth)
    // If frequency is not monthly, it's a data integrity issue, but convert for safety
    let monthlyAmount = expense.amount$;
    if (expense.frequency !== 'monthly') {
      // This shouldn't happen if expenses are normalized, but convert for safety
    if (expense.frequency === 'weekly') {
      monthlyAmount = expense.amount$ * 4.33;
    } else if (expense.frequency === 'biweekly') {
      monthlyAmount = expense.amount$ * 2.17;
    } else if (expense.frequency === 'semimonthly') {
      monthlyAmount = expense.amount$ * 2;
    } else if (expense.frequency === 'yearly') {
      monthlyAmount = expense.amount$ / 12;
    }
    }

    if (expense.category === 'needs') {
      needsTotal += monthlyAmount;
    } else if (expense.category === 'wants') {
      wantsTotal += monthlyAmount;
    } else {
      // Default to needs if category not specified
      needsTotal += monthlyAmount;
    }
  }

  // Determine if incomePeriod$ is monthly or per-paycheck
  // If payFrequency is 'monthly', incomePeriod$ is monthly; otherwise it's per-paycheck
  const isIncomeMonthly = incomePayFrequency === 'monthly';
  
  // Convert income to monthly for comparison
  let monthlyIncome: number;
  let paychecksPerMonth: number;
  if (isIncomeMonthly) {
    monthlyIncome = incomePeriod$;
    paychecksPerMonth = 1; // Not used, but initialize for clarity
  } else {
    // incomePeriod$ is per-paycheck, convert to monthly
    paychecksPerMonth = getPaychecksPerMonth(incomePayFrequency || 'biweekly');
    monthlyIncome = incomePeriod$ * paychecksPerMonth;
  }

  // Add debt minimum payments to needs
  // Debt payments are stored as per-paycheck amounts, convert to monthly
  if (debts && debts.length > 0) {
    const totalDebtMinPayments$ = debts.reduce((sum, d) => sum + d.minPayment$, 0);
    // Convert per-paycheck debt payments to monthly
    const monthlyDebtMinPayments = isIncomeMonthly 
      ? totalDebtMinPayments$  // If income is monthly, assume debt payments are also monthly
      : totalDebtMinPayments$ * paychecksPerMonth;  // Convert per-paycheck to monthly
    needsTotal += monthlyDebtMinPayments;
  }
  
  // Validate monthly income
  if (!monthlyIncome || monthlyIncome <= 0) {
    throw new Error('Invalid monthly income');
  }
  
  // Calculate percentages based on monthly amounts
  // Both expenses and income are now in monthly terms
  // Don't cap these - let them reflect actual spending
  // The income allocation engine will handle adjustments based on targets
  const needsPct = Math.max(needsTotal / monthlyIncome, 0);
  const wantsPct = Math.max(wantsTotal / monthlyIncome, 0);
  const savingsPct = Math.max((monthlyIncome - needsTotal - wantsTotal) / monthlyIncome, 0);

  // If the sum is invalid or expenses exceed income, return fallback targets
  const sum = needsPct + wantsPct + savingsPct;
  if (sum <= 0 || !isFinite(sum) || sum > 1.01) {
    // If expenses exceed income or sum is invalid, return fallback targets
    return fallbackTargets;
  }
  
  // Normalize to sum to 1.0 (only if sum is close to 1.0, otherwise there's an issue)
  if (Math.abs(sum - 1.0) > 0.01) {
    // Sum doesn't equal 1.0 - this shouldn't happen if calculations are correct
    // But if it does, normalize to ensure engine gets valid percentages
    return {
      needsPct: needsPct / sum,
      wantsPct: wantsPct / sum,
      savingsPct: savingsPct / sum,
    };
  }
  
  // Sum is already 1.0 (or very close), return as-is
  return {
    needsPct,
    wantsPct,
    savingsPct,
  };
}

/**
 * Gets number of paychecks per month based on frequency
 */
function getPaychecksPerMonth(frequency: string): number {
  switch (frequency) {
    case 'weekly':
      return 4.33;
    case 'biweekly':
      return 2.17;
    case 'semimonthly':
      return 2;
    case 'monthly':
      return 1;
    default:
      return 2; // Default to biweekly
  }
}

/**
 * Fallback plan if engine can't compute
 */
function getFallbackPlan(
  incomePeriod$: number,
  goal?: PrimaryGoal
): PaycheckPlan {
  const targets = getDefaultTargetsForGoal(goal);
  
  return {
    needs$: Math.round(incomePeriod$ * targets.needsPct * 100) / 100,
    wants$: Math.round(incomePeriod$ * targets.wantsPct * 100) / 100,
    savings$: Math.round(incomePeriod$ * targets.savingsPct * 100) / 100,
    categories: [
      {
        name: 'Needs',
        amount$: Math.round(incomePeriod$ * targets.needsPct * 100) / 100,
        percentage: targets.needsPct * 100,
        color: '#3b82f6',
      },
      {
        name: 'Wants',
        amount$: Math.round(incomePeriod$ * targets.wantsPct * 100) / 100,
        percentage: targets.wantsPct * 100,
        color: '#10b981',
      },
      {
        name: 'Savings',
        amount$: Math.round(incomePeriod$ * targets.savingsPct * 100) / 100,
        percentage: targets.savingsPct * 100,
        color: '#8b5cf6',
      },
    ],
    notes: ['Using default allocation (engine unavailable)'],
  };
}

/**
 * Generates a boosted plan and net worth projection using all three engines.
 * 
 * This function:
 * 1. Calls incomeAllocationEngine to refine paycheck allocation
 * 2. Calls savingsAllocationEngine to determine savings split
 * 3. Calls netWorthSimulator to produce projection
 */
export function generateBoostedPlanAndProjection(
  state: OnboardingState
): {
  paycheckPlan: PaycheckPlan;
  netWorthProjection: Array<{ months: number; value: number }>;
  efReachedMonth?: number;
  debtFreeMonth?: number;
} {
  const { income, riskConstraints, fixedExpenses, debts, assets, safetyStrategy, payrollContributions } = state;

  // Validate required data
  // Prefer netIncome$ (take home pay), but fall back to grossIncome$ if needed
  if (!income || (!income.netIncome$ && !income.grossIncome$)) {
    throw new Error('Income data is required. Please go back to the Income step and enter your income.');
  }

  // Convert income to per-paycheck basis for allocation engine
  // The allocation engine works with per-paycheck amounts
  // Use netIncome$ (take home pay) if available, otherwise use grossIncome$ as approximation
  const incomePeriod$ = income.netIncome$ || income.grossIncome$ || 0;
  
  // Convert to monthly for simulation (simulator expects monthly values)
  const getMonthlyIncome = (): number => {
    if (!income.payFrequency || income.payFrequency === 'monthly') {
      return incomePeriod$;
    }
    // Convert per-paycheck to monthly
    switch (income.payFrequency) {
      case 'weekly':
        return incomePeriod$ * 4.33;
      case 'biweekly':
        return incomePeriod$ * 2.17;
      case 'semimonthly':
        return incomePeriod$ * 2;
      default:
        // Default to biweekly if unknown
        return incomePeriod$ * 2.17;
    }
  };
  
  const monthlyIncome$ = getMonthlyIncome();
  
  // Step 1: Income Allocation
  const defaultTargets = getDefaultTargetsForGoal(state.primaryGoal);
  let targets = riskConstraints?.targets || defaultTargets;
  
  // Normalize targets: if they sum to ~100, convert from whole numbers to decimals
  const targetSum = targets.needsPct + targets.wantsPct + targets.savingsPct;
  if (Math.abs(targetSum - 100) < 1 && Math.abs(targetSum - 1.0) > 0.1) {
    // Targets are in whole number format (50, 30, 20), convert to decimals (0.5, 0.3, 0.2)
    targets = {
      needsPct: targets.needsPct / 100,
      wantsPct: targets.wantsPct / 100,
      savingsPct: targets.savingsPct / 100,
    };
  }
  
  const shiftLimitPct = riskConstraints?.shiftLimitPct ?? 0.04;
  
  // Calculate actuals3m with proper error handling
  let actuals3m = riskConstraints?.actuals3m;
  if (!actuals3m) {
    try {
        actuals3m = calculateActualsFromExpenses(
          fixedExpenses,
          incomePeriod$,
          targets,
          income.payFrequency,
          debts
        );
    } catch (error) {
      // If calculation fails, use targets as baseline
      console.warn('Failed to calculate actuals from expenses, using targets:', error);
      actuals3m = targets;
    }
  }

  // Normalize actuals3m: if they sum to ~100, convert from whole numbers to decimals
  const actualsSum = actuals3m.needsPct + actuals3m.wantsPct + actuals3m.savingsPct;
  if (Math.abs(actualsSum - 100) < 1 && Math.abs(actualsSum - 1.0) > 0.1) {
    // Actuals are in whole number format (50, 30, 20), convert to decimals (0.5, 0.3, 0.2)
    actuals3m = {
      needsPct: actuals3m.needsPct / 100,
      wantsPct: actuals3m.wantsPct / 100,
      savingsPct: actuals3m.savingsPct / 100,
    };
  } else if (Math.abs(actualsSum - 1.0) > 0.001) {
    // Normalize to sum to 1.0 (if already in decimal format but doesn't sum to 1.0)
    actuals3m = {
      needsPct: actuals3m.needsPct / actualsSum,
      wantsPct: actuals3m.wantsPct / actualsSum,
      savingsPct: actuals3m.savingsPct / actualsSum,
    };
  }

  const incomeAlloc = allocateIncome({
    incomePeriod$,
    targets,
    actuals3m,
    shiftLimitPct,
  });

  // Step 2: Savings Allocation
  const efTargetMonths = safetyStrategy?.efTargetMonths || 3;
  const monthlyBasics = calculateMonthlyBasics(fixedExpenses);
  // If no expenses, use a default monthly basics (e.g., 30% of income as a rough estimate)
  const efTarget$ = monthlyBasics > 0 
    ? monthlyBasics * efTargetMonths 
    : (incomePeriod$ * 2.17 * 0.3 * efTargetMonths); // Assume biweekly pay, 30% for needs
  const efBalance$ = safetyStrategy?.efBalance$ || 
    assets.filter(a => a.type === 'cash').reduce((sum, a) => sum + a.value$, 0);

  const highAprDebts = debts
    .filter(d => d.isHighApr || d.aprPct > 10)
    .map(d => ({ balance$: d.balance$, aprPct: d.aprPct }));

  const freq = income.payFrequency || 'biweekly';
  const paychecksPerMonthForMatch = freq === 'weekly' ? 4.33 : freq === 'biweekly' ? 2.17 : freq === 'semimonthly' ? 2 : 1;
  const matchNeedPerPaycheck$ = (safetyStrategy?.match401kPerMonth$ ?? 0) / paychecksPerMonthForMatch;

  const savingsAlloc = allocateSavings({
    savingsBudget$: incomeAlloc.savings$,
    efTarget$,
    efBalance$,
    highAprDebts,
    matchNeedThisPeriod$: matchNeedPerPaycheck$,
    incomeSingle$: income.incomeSingle$ || income.annualSalary$ || incomePeriod$ * 26,
    onIDR: safetyStrategy?.onIDR || false,
    liquidity: safetyStrategy?.liquidity || 'Medium',
    retirementFocus: safetyStrategy?.retirementFocus || 'Medium',
    iraRoomThisYear$: 7000, // TODO: Calculate from actual contributions
    k401RoomThisYear$: 23000, // TODO: Calculate from actual contributions
  });

  // Build paycheck plan with savings breakdown
  const paycheckPlan: PaycheckPlan = {
    needs$: incomeAlloc.needs$,
    wants$: incomeAlloc.wants$,
    savings$: incomeAlloc.savings$,
    savingsBreakdown: {
      ef$: savingsAlloc.ef$,
      debt$: savingsAlloc.highAprDebt$,
      match401k$: savingsAlloc.match401k$,
      retirement$: savingsAlloc.retirementTaxAdv$,
      brokerage$: savingsAlloc.brokerage$,
    },
    categories: [
      {
        name: 'Needs',
        amount$: incomeAlloc.needs$,
        percentage: (incomeAlloc.needs$ / incomePeriod$) * 100,
        color: '#3b82f6',
      },
      {
        name: 'Wants',
        amount$: incomeAlloc.wants$,
        percentage: (incomeAlloc.wants$ / incomePeriod$) * 100,
        color: '#10b981',
      },
      {
        name: 'Savings',
        amount$: incomeAlloc.savings$,
        percentage: (incomeAlloc.savings$ / incomePeriod$) * 100,
        color: '#8b5cf6',
      },
    ],
    notes: [...incomeAlloc.notes, ...savingsAlloc.notes],
  };

  // Step 3: Net Worth Simulation
  const openingBalances = {
    cash: efBalance$,
    brokerage: assets.filter(a => a.type === 'brokerage').reduce((sum, a) => sum + a.value$, 0),
    retirement: assets.filter(a => a.type === 'retirement').reduce((sum, a) => sum + a.value$, 0),
    hsa: assets.find(a => a.type === 'hsa')?.value$,
    otherAssets: assets.filter(a => a.type === 'other').reduce((sum, a) => sum + a.value$, 0),
    liabilities: debts.map(d => ({
      name: d.name,
      balance: d.balance$,
      aprPct: d.aprPct,
      minPayment: d.minPayment$,
      extraPayment: d.isHighApr ? savingsAlloc.highAprDebt$ : undefined,
    })),
  };

  // Convert per-paycheck allocations to monthly for simulation
  const getPaychecksPerMonth = (): number => {
    if (!income.payFrequency || income.payFrequency === 'monthly') {
      return 1;
    }
    switch (income.payFrequency) {
      case 'weekly':
        return 4.33;
      case 'biweekly':
        return 2.17;
      case 'semimonthly':
        return 2;
      default:
        return 2.17; // Default to biweekly
    }
  };
  
  const paychecksPerMonth = getPaychecksPerMonth();
  const preTaxSavingsInitial = calculatePreTaxSavings(income, payrollContributions);

  const monthlyPlan: SimMonthlyPlan = {
    monthIndex: 0,
    incomeNet: monthlyIncome$,
    needs$: incomeAlloc.needs$ * paychecksPerMonth,
    wants$: incomeAlloc.wants$ * paychecksPerMonth,
    ef$: savingsAlloc.ef$ * paychecksPerMonth,
    highAprDebt$: savingsAlloc.highAprDebt$ * paychecksPerMonth,
    preTax401k$: preTaxSavingsInitial.traditional401k.monthly,
    match401k$: savingsAlloc.match401k$ * paychecksPerMonth,
    hsa$: savingsAlloc.hsa$ != null ? savingsAlloc.hsa$ * paychecksPerMonth : preTaxSavingsInitial.hsa.monthly,
    employerHsa$: preTaxSavingsInitial.employerHSA.monthly,
    retirementTaxAdv$: savingsAlloc.retirementTaxAdv$ * paychecksPerMonth,
    brokerage$: savingsAlloc.brokerage$ * paychecksPerMonth,
  };

  // Create monthly plan array (repeat for all months)
  const horizonMonths = 24; // 2 years for initial projection
  const monthlyPlans: SimMonthlyPlan[] = Array.from({ length: horizonMonths }, (_, i) => ({
    ...monthlyPlan,
    monthIndex: i,
  }));

  const scenarioInput: ScenarioInput = {
    startDate: new Date().toISOString().split('T')[0],
    horizonMonths,
    inflationRatePct: riskConstraints?.assumptions?.inflationRatePct || 2.5,
    nominalReturnPct: riskConstraints?.assumptions?.nominalReturnPct || 9.0,
    cashYieldPct: riskConstraints?.assumptions?.cashYieldPct || 4.0,
    taxDragBrokeragePct: 0.5,
    openingBalances,
    monthlyPlan: monthlyPlans,
    goals: {
      efTarget$,
    },
  };

  const simulation = simulateScenario(scenarioInput);

  // Convert to simplified projection format
  const netWorthProjection = simulation.netWorth
    .map((value, index) => ({ months: index + 1, value }))
    .filter((_, index) => index % 3 === 0 || index === 0 || index === simulation.netWorth.length - 1); // Sample every 3 months

  return {
    paycheckPlan,
    netWorthProjection,
    efReachedMonth: simulation.kpis.efReachedMonth,
    debtFreeMonth: simulation.kpis.debtFreeMonth,
  };
}

/**
 * Calculates monthly basics from fixed expenses
 */
function calculateMonthlyBasics(expenses: OnboardingState['fixedExpenses']): number {
  return expenses
    .filter(e => e.category === 'needs')
    .reduce((sum, e) => {
      let monthly = e.amount$;
      if (e.frequency === 'weekly') monthly = e.amount$ * 4.33;
      else if (e.frequency === 'biweekly') monthly = e.amount$ * 2.17;
      else if (e.frequency === 'semimonthly') monthly = e.amount$ * 2;
      else if (e.frequency === 'yearly') monthly = e.amount$ / 12;
      return sum + monthly;
    }, 0);
}

/**
 * Final Plan Data Structure
 * 
 * Comprehensive data structure for the final plan page that synthesizes
 * all three engines (Income Allocation, Savings Allocation, Net Worth Simulator).
 */
export interface FinalPlanData {
  // SECTION 2 – Paycheck Allocation
  paycheckAmount: number;
  paycheckCategories: Array<{
    id: string;
    key:
      | 'essentials'
      | 'debt_minimums'
      | 'debt_extra'
      | 'emergency'
      | 'short_term_goals'
      | 'long_term_investing'
      | 'fun_flexible';
    label: string;
    amount: number;
    percent: number; // 0–100
    why: string;
    subCategories?: Array<{
      id: string;
      key: string;
      label: string;
      amount: number;
      percent: number;
      why: string;
    }>;
  }>;

  // SECTION 3 – Savings Strategy
  emergencyFund: {
    current: number;
    target: number;
    monthsTarget: number;
    monthsToTarget: number;
  };
  goalsFunding: Array<{
    id: string;
    label: string;
    amountPerPaycheck: number;
    targetDateLabel: string; // e.g., "Mar 2026"
    progressPct: number;
  }>;
  smartInsights: string[]; // 1–3 short insight strings

  // SECTION 4 – Debt Payoff (optional if no debts)
  debts: Array<{
    id: string;
    name: string;
    apr: number | null;
    payoffDateLabel: string; // "Nov 2026"
  }>;
  totalInterestSaved?: number; // compared to minimums-only

  // SECTION 5 – Net Worth Projection
  /** Total monthly contribution used in the net worth sim (ef + debt + 401k + match + HSA + retirement + brokerage). Use for scenario math so proposed = baseline ± amount. */
  monthlySavingsTotal?: number;
  /** Savings breakdown (pre-tax, match, post-tax cash) from the plan's simulation. Use for chat and UI when payrollContributions may be empty. */
  savingsBreakdown?: {
    cashSavingsMTD: number;
    payrollSavingsMTD: number;
    employerMatchMTD: number;
    employerHSAMTD: number;
    totalSavingsMTD: number;
  };
  netWorthProjection: Array<{
    label: 'Today' | '6 Months' | '12 Months' | '24 Months' | '5 Years' | '10 Years' | '20 Years';
    months: number;
    value: number;
  }>;
  netWorthInsight?: string;
  /** Input used for net worth sim (so we can run "baseline minus $X/month" for scenario comparison). */
  netWorthScenarioInput?: ScenarioInput;
  // Full simulation data for chart
  netWorthChartData: {
    labels: string[];
    netWorth: number[];
    assets: number[];
    liabilities: number[];
    // Asset breakdowns for detailed analysis
    cash?: number[]; // Emergency fund / cash savings
    brokerage?: number[]; // Taxable brokerage account
    retirement?: number[]; // 401k, IRA, etc.
    hsa?: number[]; // Health Savings Account (if applicable)
  };

  // SECTION 6 – Key Protection Settings
  protection: {
    minCheckingBuffer?: number;
    minCashPct?: number;
    riskTolerance?: number; // 1–5
    timeHorizonLabel?: string; // e.g., "3–5 years"
    debtStrategyLabel?: string; // e.g., "Avalanche"
  };
}

/** Options for building plan data. Use when "current plan" must reflect user state, not 3-month average. */
export interface BuildFinalPlanDataOptions {
  /** When true, derive needs/wants/savings from current expenses (user state) only; do not use riskConstraints.actuals3m (3-month average). */
  useCurrentStateActuals?: boolean;
  /** When true, use only engine allocation for 401k/HSA (no payroll fallback). Use for proposed/simulated plans so net worth delta vs baseline reflects the full savings change (e.g. $500/mo undersave). */
  forSimulationComparison?: boolean;
  /** When set, use this as monthly savings budget for the sim instead of incomeAlloc.savings$ * paychecksPerMonth. Use for scenario "undersave $X" so proposed = baseline - X exactly. */
  overrideMonthlySavingsBudget?: number;
}

/**
 * Run baseline net worth sim with exactly $X less (or more) per month; return projection + chart data.
 * Use for "undersave $200" so proposed = baseline - $200 every month and delta is correct (~$1,200 at 6mo).
 */
export function buildProposedNetWorthFromBaseline(
  baseline: Pick<FinalPlanData, 'netWorthScenarioInput' | 'netWorthChartData'>,
  monthlyDelta$: number
): Pick<FinalPlanData, 'netWorthProjection' | 'netWorthChartData'> | null {
  const input = baseline.netWorthScenarioInput;
  if (!input?.monthlyPlan?.length) return null;
  const simulation = simulateScenarioWithMonthlyDelta(input, monthlyDelta$);
  const openingBalances = input.openingBalances;
  const totalOpeningLiabilities = openingBalances.liabilities.reduce((s, d) => s + d.balance, 0);
  const openingNetWorth = Math.round(
    (openingBalances.cash + openingBalances.brokerage + openingBalances.retirement +
      (openingBalances.hsa ?? 0) + (openingBalances.otherAssets ?? 0) - totalOpeningLiabilities) * 100
  ) / 100;
  const openingAssets = openingBalances.cash + openingBalances.brokerage + openingBalances.retirement +
    (openingBalances.hsa ?? 0) + (openingBalances.otherAssets ?? 0);
  const netWorth6m = simulation.netWorth[5] ?? simulation.netWorth[0] ?? openingNetWorth;
  const netWorth12m = simulation.netWorth[11] ?? simulation.netWorth[0] ?? openingNetWorth;
  const netWorth24m = simulation.netWorth[23] ?? simulation.netWorth[simulation.netWorth.length - 1] ?? openingNetWorth;
  const netWorthProjection: FinalPlanData['netWorthProjection'] = [
    { label: 'Today', months: 0, value: openingNetWorth },
    { label: '6 Months', months: 6, value: netWorth6m },
    { label: '12 Months', months: 12, value: netWorth12m },
    { label: '24 Months', months: 24, value: netWorth24m },
  ];
  const expectedLength = simulation.assets?.length ?? 480;
  let chartCash = (simulation.cash && simulation.cash.length === expectedLength) ? [...simulation.cash] : new Array(expectedLength).fill(0);
  let chartBrokerage = (simulation.brokerage && simulation.brokerage.length === expectedLength) ? [...simulation.brokerage] : new Array(expectedLength).fill(0);
  let chartRetirement = (simulation.retirement && simulation.retirement.length === expectedLength) ? [...simulation.retirement] : new Array(expectedLength).fill(0);
  let chartHSA: number[] | undefined = (simulation.hsa && simulation.hsa.length === expectedLength) ? [...simulation.hsa] : undefined;
  chartCash = [openingBalances.cash, ...chartCash];
  chartBrokerage = [openingBalances.brokerage, ...chartBrokerage];
  chartRetirement = [openingBalances.retirement, ...chartRetirement];
  if (chartHSA) chartHSA = [(openingBalances.hsa ?? 0), ...chartHSA];
  const chartLabels = ['Today', ...simulation.labels];
  const chartNetWorth = [openingNetWorth, ...simulation.netWorth];
  const chartAssets = [openingAssets, ...simulation.assets];
  const chartLiabilities = [totalOpeningLiabilities, ...simulation.liabilities];
  return {
    netWorthProjection,
    netWorthChartData: {
      labels: chartLabels,
      netWorth: chartNetWorth,
      assets: chartAssets,
      liabilities: chartLiabilities,
      cash: chartCash,
      brokerage: chartBrokerage,
      retirement: chartRetirement,
      ...(chartHSA && chartHSA.length > 0 ? { hsa: chartHSA } : {}),
    },
  };
}

/**
 * Builds comprehensive final plan data from onboarding state using all three engines.
 */
export function buildFinalPlanData(state: OnboardingState, options?: BuildFinalPlanDataOptions): FinalPlanData {
  const { income, riskConstraints, fixedExpenses, debts, assets, goals, safetyStrategy, initialPaycheckPlan, payrollContributions } = state;

  // Validate required data
  // Prefer netIncome$ (take home pay), but fall back to grossIncome$ if needed
  if (!income || (!income.netIncome$ && !income.grossIncome$)) {
    throw new Error('Income data is required');
  }

  // Use netIncome$ (take home pay) if available, otherwise use grossIncome$ as approximation
  // Note: If only grossIncome$ is provided, we're using it as an approximation for net income
  const incomePeriod$ = income.netIncome$ || income.grossIncome$ || 0;
  const paycheckAmount = incomePeriod$;

  // Log income source for debugging Plaid vs manual entry
  console.log('[buildFinalPlanData] Income data:', {
    netIncome$: income.netIncome$,
    grossIncome$: income.grossIncome$,
    payFrequency: income.payFrequency,
    incomePeriod$,
    hasInitialPaycheckPlan: !!initialPaycheckPlan,
    initialPlanNeeds$: initialPaycheckPlan?.needs$,
    plaidConnected: state.plaidConnected,
    fixedExpensesCount: fixedExpenses.length,
    debtsCount: debts.length,
    fixedExpensesTotal: fixedExpenses.reduce((sum, e) => sum + e.amount$, 0), // All expenses should be monthly
  });

  // SINGLE SOURCE OF TRUTH: Always calculate from current state (expenses, debts, income)
  // The state IS the source of truth - don't use initialPaycheckPlan as a cache
  // initialPaycheckPlan is only for display/editing on the Monthly Plan page, not for calculations
  console.log('[buildFinalPlanData] Calculating from current state (single source of truth)', {
    fixedExpensesCount: fixedExpenses.length,
    debtsCount: debts.length,
    incomePeriod$,
  });
  
  // Always calculate from current state - this is the source of truth
  // Calculate from income allocation engine using current expenses and debts
    const defaultTargets = getDefaultTargetsForGoal(state.primaryGoal);
    let targets = riskConstraints?.targets || defaultTargets;
    
    // Normalize targets if needed
    const targetSum = targets.needsPct + targets.wantsPct + targets.savingsPct;
    if (Math.abs(targetSum - 100) < 1 && Math.abs(targetSum - 1.0) > 0.1) {
      // They're in whole number format (50, 30, 20), convert to decimals (0.5, 0.3, 0.2)
      targets = {
        needsPct: targets.needsPct / 100,
        wantsPct: targets.wantsPct / 100,
        savingsPct: targets.savingsPct / 100,
      };
    } else if (Math.abs(targetSum - 1.0) > 0.001) {
      // They're already in decimal format but don't sum to 1.0 - normalize them
      targets = {
        needsPct: targets.needsPct / targetSum,
        wantsPct: targets.wantsPct / targetSum,
        savingsPct: targets.savingsPct / targetSum,
      };
    }
    
    // Final validation - ensure targets sum to exactly 1.0 (within tolerance)
    const finalTargetSum = targets.needsPct + targets.wantsPct + targets.savingsPct;
    if (Math.abs(finalTargetSum - 1.0) > 0.0001) {
      // Force exact sum by using savings as remainder
      targets = {
        needsPct: targets.needsPct,
        wantsPct: targets.wantsPct,
        savingsPct: Math.max(0, Math.min(1.0, 1.0 - targets.needsPct - targets.wantsPct)),
      };
    }

    const shiftLimitPct = riskConstraints?.shiftLimitPct ?? 0.04;

  // Current plan = user state: derive needs/wants/savings from current expenses only (no 3-month average)
  const useCurrentStateActuals = options?.useCurrentStateActuals === true;
  const bypassWantsFloor = riskConstraints?.bypassWantsFloor || false;

  // Calculate actuals3m
  // When a tool (e.g. savings-helper) has applied a plan, riskConstraints has bypassWantsFloor and actuals3m set.
  // Use that as source of truth so savings-allocator and others see the updated amount.
  // When useCurrentStateActuals is true and no applied plan: derive from current expenses.
  let actuals3m = riskConstraints?.actuals3m;
  if (useCurrentStateActuals && !(bypassWantsFloor && actuals3m)) {
    try {
      actuals3m = calculateActualsFromExpenses(fixedExpenses, incomePeriod$, targets, income.payFrequency, debts);
      console.log('[buildFinalPlanData] useCurrentStateActuals=true — actuals from current expenses (user state)', {
        actuals3m,
        fixedExpensesCount: fixedExpenses.length,
      });
    } catch (error) {
      console.warn('Failed to calculate actuals from expenses (user state), using targets:', error);
      actuals3m = targets;
    }
  } else if (bypassWantsFloor && actuals3m) {
    console.log('[buildFinalPlanData] Using applied plan from tool (bypassWantsFloor + actuals3m) as source of truth', {
      actuals3m,
    });
  }
  
  // Check if actuals3m is valid (sums to ~1.0 or ~100)
  // CRITICAL: If bypassWantsFloor is true, this means actuals3m was explicitly set by a tool
  // and we should NOT recalculate it from expenses, even if the sum is slightly off
  const hasValidActuals3m = actuals3m && (
    Math.abs(actuals3m.needsPct + actuals3m.wantsPct + actuals3m.savingsPct - 1.0) < 0.1 ||
    Math.abs(actuals3m.needsPct + actuals3m.wantsPct + actuals3m.savingsPct - 100) < 1
  );
  
  // If bypassWantsFloor is true and we did NOT use current-state-only, actuals3m was explicitly set by a tool - use it as-is
  if (!useCurrentStateActuals && bypassWantsFloor && actuals3m) {
    console.log('[buildFinalPlanData] Using explicit actuals3m from tool (bypassWantsFloor=true)', {
      actuals3m,
      fixedExpensesCount: fixedExpenses.length,
    });
    // Still normalize to ensure exact sum of 1.0
    const actualsSum = actuals3m.needsPct + actuals3m.wantsPct + actuals3m.savingsPct;
    if (Math.abs(actualsSum - 1.0) > 0.000001 && Math.abs(actualsSum - 100) > 1) {
      // Normalize if needed (only if sum is not 1.0 or 100)
      actuals3m = {
        needsPct: actuals3m.needsPct / actualsSum,
        wantsPct: actuals3m.wantsPct / actualsSum,
        savingsPct: actuals3m.savingsPct / actualsSum,
      };
    }
  } else if (!hasValidActuals3m) {
      try {
      console.log('[buildFinalPlanData] Calculating actuals3m from current expenses', {
        hadCachedActuals3m: !!actuals3m,
        fixedExpensesCount: fixedExpenses.length,
        debtsCount: debts.length,
        reason: !actuals3m ? 'no actuals3m provided' : 'actuals3m invalid - recalculating from expenses',
      });
      actuals3m = calculateActualsFromExpenses(fixedExpenses, incomePeriod$, targets, income.payFrequency, debts);
      } catch (error) {
        console.warn('Failed to calculate actuals from expenses, using targets:', error);
        actuals3m = targets;
      }
  } else {
    console.log('[buildFinalPlanData] Using explicit actuals3m from riskConstraints', {
      actuals3m,
      fixedExpensesCount: fixedExpenses.length,
    });
    }

    // CRITICAL: If bypassWantsFloor is true, actuals3m was explicitly set by a tool
    // Skip normalization to preserve the exact values - only ensure sum is exactly 1.0
    // Normalize actuals3m only if bypassWantsFloor is false
    if (!bypassWantsFloor) {
      if (!actuals3m) {
        actuals3m = { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 };
      }
      const actualsSum = actuals3m.needsPct + actuals3m.wantsPct + actuals3m.savingsPct;
      if (Math.abs(actualsSum - 100) < 1 && Math.abs(actualsSum - 1.0) > 0.1) {
        actuals3m = {
          needsPct: actuals3m.needsPct / 100,
          wantsPct: actuals3m.wantsPct / 100,
          savingsPct: actuals3m.savingsPct / 100,
        };
      } else if (Math.abs(actualsSum - 1.0) > 0.001) {
        actuals3m = {
          needsPct: actuals3m.needsPct / actualsSum,
          wantsPct: actuals3m.wantsPct / actualsSum,
          savingsPct: actuals3m.savingsPct / actualsSum,
        };
      }
    } else {
      // bypassWantsFloor is true - actuals3m was explicitly set, only ensure sum is exactly 1.0
      if (!actuals3m) {
        actuals3m = { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 };
      }
      console.log('[buildFinalPlanData] bypassWantsFloor=true - preserving actuals3m values without normalization', {
        actuals3mBefore: actuals3m,
      });
    }

  // Final validation before calling allocateIncome - ensure actuals3m sums to exactly 1.0
  // (targets already validated above at line 770)
  const finalActualsSum = actuals3m.needsPct + actuals3m.wantsPct + actuals3m.savingsPct;
  if (Math.abs(finalActualsSum - 1.0) > 0.0001) {
    // Force actuals3m to sum to exactly 1.0 (only adjust savings, preserve needs and wants if bypassWantsFloor is true)
    if (bypassWantsFloor) {
      // Preserve Needs and Wants, adjust only Savings
      actuals3m = {
        needsPct: actuals3m.needsPct,
        wantsPct: actuals3m.wantsPct,
        savingsPct: Math.max(0, Math.min(1.0, 1.0 - actuals3m.needsPct - actuals3m.wantsPct)),
      };
    } else {
      // Normal normalization
      actuals3m = {
        needsPct: actuals3m.needsPct,
        wantsPct: actuals3m.wantsPct,
        savingsPct: Math.max(0, Math.min(1.0, 1.0 - actuals3m.needsPct - actuals3m.wantsPct)),
      };
    }
  }
  
  if (bypassWantsFloor) {
    console.log('[buildFinalPlanData] bypassWantsFloor=true - final actuals3m preserved', {
      actuals3m,
      sum: actuals3m.needsPct + actuals3m.wantsPct + actuals3m.savingsPct,
    });
  }
  
  const incomeAlloc = allocateIncome({
      incomePeriod$,
      targets,
      actuals3m,
      shiftLimitPct,
      bypassWantsFloor, // Using bypassWantsFloor declared earlier (line 790)
    });
  
  console.log('[buildFinalPlanData] Income allocation calculated from engine', {
    needs$: incomeAlloc.needs$,
    wants$: incomeAlloc.wants$,
    savings$: incomeAlloc.savings$,
    actuals3mNeedsPct: actuals3m.needsPct,
    actuals3mWantsPct: actuals3m.wantsPct,
    actuals3mSavingsPct: actuals3m.savingsPct,
    targetsNeedsPct: targets.needsPct,
    targetsWantsPct: targets.wantsPct,
    targetsSavingsPct: targets.savingsPct,
  });

  // Step 2: Savings Allocation Engine
  const efTargetMonths = safetyStrategy?.efTargetMonths || 3;
  const monthlyBasics = calculateMonthlyBasics(fixedExpenses);
  const efTarget$ = monthlyBasics > 0 
    ? monthlyBasics * efTargetMonths 
    : (incomePeriod$ * 2.17 * 0.3 * efTargetMonths);
  const efBalance$ = safetyStrategy?.efBalance$ || 
    assets.filter(a => a.type === 'cash').reduce((sum, a) => sum + a.value$, 0);

  const highAprDebts = debts
    .filter(d => d.isHighApr || d.aprPct > 10)
    .map(d => ({ balance$: d.balance$, aprPct: d.aprPct }));

  // Calculate total debt minimum payments (per-paycheck)
  const totalDebtMinPayments$ = debts.reduce((sum, d) => sum + d.minPayment$, 0);

  // Convert to monthly for savings allocation (everything is monthly now)
  const paychecksPerMonth = getPaychecksPerMonth(income.payFrequency || 'biweekly');
  const monthlySavingsBudget = options?.overrideMonthlySavingsBudget != null
    ? Math.max(0, options.overrideMonthlySavingsBudget)
    : incomeAlloc.savings$ * paychecksPerMonth;
  const monthlyNeedsTotal = incomeAlloc.needs$ * paychecksPerMonth;
  // Convert debt minimum payments from per-paycheck to monthly
  const monthlyDebtMinimums = totalDebtMinPayments$ * paychecksPerMonth;
  const monthlyEssentials = Math.max(0, monthlyNeedsTotal - monthlyDebtMinimums);

  console.log('[buildFinalPlanData] Savings allocation inputs:', {
    monthlySavingsBudget,
    incomeAllocSavings$: incomeAlloc.savings$,
    paychecksPerMonth,
    hasCustomAllocation: !!safetyStrategy?.customSavingsAllocation,
    customAllocationTotal: safetyStrategy?.customSavingsAllocation 
      ? (safetyStrategy.customSavingsAllocation.ef$ + 
         safetyStrategy.customSavingsAllocation.highAprDebt$ + 
         safetyStrategy.customSavingsAllocation.match401k$ + 
         safetyStrategy.customSavingsAllocation.retirementTaxAdv$ + 
         safetyStrategy.customSavingsAllocation.brokerage$)
      : 0,
  });

  // Use custom savings allocation if provided, otherwise calculate from engine
  // CRITICAL: Always use custom allocation if it exists - user explicitly set these values
  // The budget matching was too strict and causing custom allocations to be ignored
  let savingsAlloc;
  const customAlloc = safetyStrategy?.customSavingsAllocation;
  const customAllocTotal = customAlloc 
    ? (customAlloc.ef$ + customAlloc.highAprDebt$ + customAlloc.match401k$ + (customAlloc.hsa$ ?? 0) + customAlloc.retirementTaxAdv$ + customAlloc.brokerage$)
    : 0;
  
  // Calculate post-tax portion of custom allocation (exclude pre-tax match401k$)
  // This is what should match the monthlySavingsBudget (which is post-tax)
  const customAllocPostTax = customAlloc 
    ? (customAlloc.ef$ + customAlloc.highAprDebt$ + customAlloc.retirementTaxAdv$ + customAlloc.brokerage$)
    : 0;
  
  // Use a larger tolerance (10%) to account for rounding differences and pre-tax/post-tax differences
  // The match401k$ is pre-tax, so it shouldn't be compared to the post-tax budget
  const budgetTolerance = monthlySavingsBudget * 0.10; // 10% tolerance
  const budgetMatches = customAllocPostTax > 0 && Math.abs(customAllocPostTax - monthlySavingsBudget) < Math.max(1, budgetTolerance);
  
  console.log('[buildFinalPlanData] Checking custom savings allocation:', {
    hasCustomAlloc: !!customAlloc,
    customAllocTotal,
    customAllocPostTax,
    monthlySavingsBudget,
    difference: Math.abs(customAllocPostTax - monthlySavingsBudget),
    budgetTolerance,
    budgetMatches,
    willUseCustom: !!customAlloc,
    riskConstraints: riskConstraints?.targets,
    riskConstraintsActuals3m: riskConstraints?.actuals3m,
  });
  
  // ALWAYS use custom allocation if it exists - user explicitly set these values in savings allocator
  if (customAlloc) {
    // Use custom allocation (already in monthly amounts) - budget hasn't changed
    // Calculate routing info from the allocation percentages
    const totalRetirement = customAlloc.match401k$ + customAlloc.retirementTaxAdv$;
    const totalInvesting = totalRetirement + customAlloc.brokerage$;
    const retirePct = totalInvesting > 0 ? totalRetirement / totalInvesting : 0.5;
    const brokerPct = totalInvesting > 0 ? customAlloc.brokerage$ / totalInvesting : 0.5;
    
    // Determine account type based on income and IDR status
    const incomeSingle$ = income.incomeSingle$ || income.annualSalary$ || incomePeriod$ * paychecksPerMonth * 12;
    const onIDR = safetyStrategy?.onIDR || false;
    const acctType = (onIDR || incomeSingle$ >= 190000) ? "Traditional401k" : "Roth";
    
    savingsAlloc = {
      ef$: customAlloc.ef$,
      highAprDebt$: customAlloc.highAprDebt$,
      match401k$: customAlloc.match401k$,
      hsa$: customAlloc.hsa$ ?? 0,
      retirementTaxAdv$: customAlloc.retirementTaxAdv$,
      brokerage$: customAlloc.brokerage$,
      routing: {
        acctType,
        splitRetirePct: round2(retirePct * 100),
        splitBrokerPct: round2(brokerPct * 100),
      },
      notes: ['Using custom savings allocation from user adjustments'],
    };
    console.log('[buildFinalPlanData] Using custom savings allocation (user-set values):', {
      savingsAlloc,
      customAlloc,
      budgetMatches,
      note: budgetMatches ? 'Budget matches' : 'Using custom allocation despite budget difference',
    });
  } else {
    // Calculate from engine - no custom allocation exists
    console.log('[buildFinalPlanData] No custom allocation, calculating from engine');
    // Calculate HSA room and current contribution
    const hsaEligible = payrollContributions?.hsaEligible === true;
    const hsaCoverageType = payrollContributions?.hsaCoverageType || "unknown";
    
    // HSA annual limits (2025)
    const hsaAnnualLimits = {
      self: 4300,
      family: 8550,
      unknown: 4300, // Default to self if unknown
    };
    const hsaAnnualLimit$ = hsaAnnualLimits[hsaCoverageType];
    
    // Calculate current HSA contribution (annual)
    let currentHSAAnnual$ = 0;
    let currentHSAMonthly$ = 0;
    if (payrollContributions?.hasHSA && payrollContributions?.currentlyContributingHSA === "yes") {
      const paychecksPerMonthForHSA = getPaychecksPerMonth(income.payFrequency || 'biweekly');
      const grossIncomePerPaycheck = income.grossIncome$ || income.netIncome$ || 0;
      const grossIncomeMonthly = grossIncomePerPaycheck * paychecksPerMonthForHSA;
      
      if (payrollContributions.contributionTypeHSA === "percent_gross" && payrollContributions.contributionValueHSA) {
        currentHSAMonthly$ = (grossIncomeMonthly * payrollContributions.contributionValueHSA) / 100;
      } else if (payrollContributions.contributionTypeHSA === "amount" && payrollContributions.contributionValueHSA) {
        if (payrollContributions.contributionFrequencyHSA === "per_paycheck") {
          currentHSAMonthly$ = payrollContributions.contributionValueHSA * paychecksPerMonthForHSA;
        } else if (payrollContributions.contributionFrequencyHSA === "per_month") {
          currentHSAMonthly$ = payrollContributions.contributionValueHSA;
        }
      }
      currentHSAAnnual$ = currentHSAMonthly$ * 12;
    }
    
    // Calculate remaining HSA room
    const hsaRoomThisYear$ = Math.max(0, hsaAnnualLimit$ - currentHSAAnnual$);
    
    // Determine if user should prioritize HSA (tax-efficiency focused or high medical spend)
    // For MVP, we'll use retirementFocus as a proxy for tax-efficiency focus
    const prioritizeHSA = safetyStrategy?.retirementFocus === "High" || safetyStrategy?.retirementFocus === "Medium";
    
    savingsAlloc = allocateSavings({
      savingsBudget$: monthlySavingsBudget,
      efTarget$,
      efBalance$,
      highAprDebts,
      matchNeedThisPeriod$: safetyStrategy?.match401kPerMonth$ || 0,
      incomeSingle$: income.incomeSingle$ || income.annualSalary$ || incomePeriod$ * paychecksPerMonth * 12,
      onIDR: safetyStrategy?.onIDR || false,
      liquidity: safetyStrategy?.liquidity || 'Medium',
      retirementFocus: safetyStrategy?.retirementFocus || 'Medium',
      iraRoomThisYear$: safetyStrategy?.iraRoomThisYear$ || 7000,
      k401RoomThisYear$: safetyStrategy?.k401RoomThisYear$ || 23000,
      hsaEligible,
      hsaCoverageType,
      currentHSAMonthly$,
      hsaRoomThisYear$,
      prioritizeHSA,
    });
    console.log('[buildFinalPlanData] Calculated savings allocation from engine:', {
      savingsAlloc,
      monthlySavingsBudget,
      incomeAllocSavings$: incomeAlloc.savings$,
    });
  }
  
  // Convert savings allocation back to per-paycheck for paycheck categories (for backward compatibility)
  // But we'll display monthly amounts everywhere
  const savingsAllocPerPaycheck = {
    ef$: savingsAlloc.ef$ / paychecksPerMonth,
    highAprDebt$: savingsAlloc.highAprDebt$ / paychecksPerMonth,
    match401k$: savingsAlloc.match401k$ / paychecksPerMonth,
    hsa$: (savingsAlloc.hsa$ || 0) / paychecksPerMonth,
    retirementTaxAdv$: savingsAlloc.retirementTaxAdv$ / paychecksPerMonth,
    brokerage$: savingsAlloc.brokerage$ / paychecksPerMonth,
  };

  console.log('[buildFinalPlanData] Building paycheck categories', {
    incomeAllocNeeds$: incomeAlloc.needs$,
    incomeAllocWants$: incomeAlloc.wants$,
    incomeAllocSavings$: incomeAlloc.savings$,
    totalDebtMinPayments$,
    essentialsAmount: incomeAlloc.needs$ - totalDebtMinPayments$,
  });
  
  // Build paycheck categories
  const paycheckCategories: FinalPlanData['paycheckCategories'] = [
    {
      id: 'essentials',
      key: 'essentials' as const,
      label: 'Essentials & Bills',
      amount: incomeAlloc.needs$ - totalDebtMinPayments$,
      percent: ((incomeAlloc.needs$ - totalDebtMinPayments$) / incomePeriod$) * 100,
      why: 'Covers your essential expenses like rent, utilities, and groceries',
    },
    {
      id: 'debt_minimums',
      key: 'debt_minimums' as const,
      label: 'Debt Minimums',
      amount: totalDebtMinPayments$,
      percent: (totalDebtMinPayments$ / incomePeriod$) * 100,
      why: 'Required minimum payments to keep accounts in good standing',
    },
    {
      id: 'debt_extra',
      key: 'debt_extra' as const,
      label: 'Extra Debt Paydown',
      amount: savingsAllocPerPaycheck.highAprDebt$,
      percent: (savingsAllocPerPaycheck.highAprDebt$ / incomePeriod$) * 100,
      why: 'Accelerates debt payoff and saves on interest',
    },
    {
      id: 'emergency',
      key: 'emergency' as const,
      label: 'Emergency Savings',
      amount: savingsAllocPerPaycheck.ef$,
      percent: (savingsAllocPerPaycheck.ef$ / incomePeriod$) * 100,
      why: 'Builds your safety net for unexpected expenses',
    },
    {
      id: 'long_term_investing',
      key: 'long_term_investing' as const,
      label: 'Long-Term Investing',
      amount: savingsAllocPerPaycheck.match401k$ + savingsAllocPerPaycheck.hsa$ + savingsAllocPerPaycheck.retirementTaxAdv$ + savingsAllocPerPaycheck.brokerage$,
      percent: ((savingsAllocPerPaycheck.match401k$ + savingsAllocPerPaycheck.hsa$ + savingsAllocPerPaycheck.retirementTaxAdv$ + savingsAllocPerPaycheck.brokerage$) / incomePeriod$) * 100,
      why: 'Grows your wealth for retirement and long-term goals (includes 401K match and HSA)',
      subCategories: [
        {
          id: '401k_match',
          key: '401k_match' as const,
          label: '401k Match',
          amount: savingsAllocPerPaycheck.match401k$,
          percent: (savingsAllocPerPaycheck.match401k$ / incomePeriod$) * 100,
          why: 'Employer contribution to your retirement, essentially free money',
        },
        ...(savingsAllocPerPaycheck.hsa$ > 0.01 ? [{
          id: 'hsa',
          key: 'hsa' as const,
          label: 'HSA',
          amount: savingsAllocPerPaycheck.hsa$,
          percent: (savingsAllocPerPaycheck.hsa$ / incomePeriod$) * 100,
          why: 'Health Savings Account - triple tax advantage (pre-tax, tax-free growth, tax-free withdrawals for medical)',
        }] : []),
        {
          id: 'retirement_tax_advantaged',
          key: 'retirement_tax_advantaged' as const,
          label: 'Retirement Tax-Advantaged',
          amount: savingsAllocPerPaycheck.retirementTaxAdv$,
          percent: (savingsAllocPerPaycheck.retirementTaxAdv$ / incomePeriod$) * 100,
          why: 'Investments in accounts like IRA/401k for tax benefits',
        },
        {
          id: 'brokerage',
          key: 'brokerage' as const,
          label: 'Brokerage',
          amount: savingsAllocPerPaycheck.brokerage$,
          percent: (savingsAllocPerPaycheck.brokerage$ / incomePeriod$) * 100,
          why: 'Flexible investments for long-term goals outside of retirement',
        },
      ],
    },
    {
      id: 'fun_flexible',
      key: 'fun_flexible' as const,
      label: 'Fun & Flexible',
      amount: incomeAlloc.wants$,
      percent: (incomeAlloc.wants$ / incomePeriod$) * 100,
      why: 'Money for dining out, entertainment, and personal enjoyment',
    },
  ].filter(cat => cat.amount > 0.01); // Only show categories with meaningful amounts

  // Calculate paychecks per month (needed for multiple calculations)
  const paychecksPerMonthForCalc = getPaychecksPerMonth(income.payFrequency || 'biweekly');
  
  // Emergency Fund data
  const efGap$ = Math.max(0, efTarget$ - efBalance$);
  // savingsAlloc.ef$ is now monthly, so no need to multiply by paychecksPerMonth
  const monthsToTarget = efGap$ > 0 && savingsAlloc.ef$ > 0
    ? Math.ceil(efGap$ / savingsAlloc.ef$)
    : 0;

  // Goals funding (simplified - map from goals array)
  const goalsFunding: FinalPlanData['goalsFunding'] = goals
    .filter(g => g.targetAmount$ && g.targetAmount$ > 0)
    .map((goal, idx) => {
      // Allocate a portion of savings to each goal (simplified heuristic)
      const goalAllocation$ = savingsAlloc.brokerage$ * 0.3; // 30% of brokerage for goals
      const targetDate = goal.targetDate ? new Date(goal.targetDate) : null;
      const targetDateLabel = targetDate
        ? targetDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        : 'TBD';
      
      const currentProgress = assets
        .filter(a => a.type === 'brokerage' || a.type === 'cash')
        .reduce((sum, a) => sum + a.value$, 0);
      const progressPct = goal.targetAmount$ ? Math.min(100, (currentProgress / goal.targetAmount$) * 100) : 0;

      return {
        id: goal.id,
        label: goal.name,
        amountPerPaycheck: goalAllocation$,
        targetDateLabel,
        progressPct,
      };
    });

  // Smart insights
  const smartInsights: string[] = [];
  if (savingsAlloc.ef$ > 0 && monthsToTarget > 0) {
    const additional$ = 20 * paychecksPerMonthForCalc; // Convert to monthly
    const additionalMonths = Math.ceil(efGap$ / (savingsAlloc.ef$ + additional$));
    if (additionalMonths < monthsToTarget) {
      smartInsights.push(
        `If you increase savings by $${additional$} per month, you reach your safety goal ${monthsToTarget - additionalMonths} month${monthsToTarget - additionalMonths === 1 ? '' : 's'} sooner.`
      );
    }
  }
  if (savingsAlloc.ef$ > incomePeriod$ * 0.1) {
    smartInsights.push('Your emergency fund is growing faster than average for your age.');
  }
  if (savingsAlloc.highAprDebt$ > 0) {
    smartInsights.push(`Paying extra on high-APR debt saves you significant interest over time.`);
  }

  // Step 3: Net Worth Simulator
  const openingBalances = {
    cash: efBalance$,
    brokerage: assets.filter(a => a.type === 'brokerage').reduce((sum, a) => sum + a.value$, 0),
    retirement: assets.filter(a => a.type === 'retirement').reduce((sum, a) => sum + a.value$, 0),
    hsa: assets.find(a => a.type === 'hsa')?.value$,
    otherAssets: assets.filter(a => a.type === 'other').reduce((sum, a) => sum + a.value$, 0),
    liabilities: debts.map(d => ({
      name: d.name,
      balance: d.balance$,
      aprPct: d.aprPct,
      minPayment: d.minPayment$,
      extraPayment: d.isHighApr ? savingsAlloc.highAprDebt$ : undefined,
    })),
  };

  // Pre-tax payroll (401k, HSA, employer match/HSA) for net worth simulation
  const preTaxSavings = calculatePreTaxSavings(income, payrollContributions);
  const forSimulationComparison = options?.forSimulationComparison === true;

  // savingsAlloc.match401k$ = EMPLOYEE 401k (from custom alloc or engine). Net worth sim expects:
  // preTax401k$ = employee contribution, match401k$ = employer match (derived).
  // When forSimulationComparison (e.g. proposed/undersaved plan), use only engine allocation so the
  // net worth delta vs baseline reflects the full savings change (e.g. $500/mo undersave → ~$12k+ gap at 24mo).
  const employee401k$ = forSimulationComparison
    ? savingsAlloc.match401k$
    : (savingsAlloc.match401k$ > 0.01 ? savingsAlloc.match401k$ : preTaxSavings.traditional401k.monthly);
  const grossIncomeMonthly = getGrossIncomeMonthly(income);
  const employerMatch$ = calculateEmployerMatch(employee401k$, grossIncomeMonthly, payrollContributions ?? undefined);
  const hsaFromAlloc = savingsAlloc.hsa$ ?? 0;
  const employeeHsa$ = forSimulationComparison ? hsaFromAlloc : (hsaFromAlloc > 0.01 ? hsaFromAlloc : (preTaxSavings.hsa.monthly ?? 0));
  const employerHsa$ = forSimulationComparison
    ? (employeeHsa$ > 0.01 ? preTaxSavings.employerHSA.monthly : 0)
    : preTaxSavings.employerHSA.monthly;

  const monthlyPlan: SimMonthlyPlan = {
    monthIndex: 0,
    incomeNet: incomePeriod$ * paychecksPerMonth,
    needs$: monthlyEssentials,
    wants$: incomeAlloc.wants$ * paychecksPerMonth,
    ef$: savingsAlloc.ef$,
    highAprDebt$: savingsAlloc.highAprDebt$,
    preTax401k$: employee401k$,
    match401k$: employerMatch$,
    hsa$: employeeHsa$,
    employerHsa$,
    retirementTaxAdv$: savingsAlloc.retirementTaxAdv$,
    brokerage$: savingsAlloc.brokerage$,
  };

  // Use 40 years (480 months) for full projection, but we'll sample for display
  const horizonMonths = 480; // 40 years for full projection
  const monthlyPlans: SimMonthlyPlan[] = Array.from({ length: horizonMonths }, (_, i) => ({
    ...monthlyPlan,
    monthIndex: i,
  }));

  const scenarioInput: ScenarioInput = {
    startDate: new Date().toISOString().split('T')[0],
    horizonMonths,
    inflationRatePct: riskConstraints?.assumptions?.inflationRatePct || 2.5,
    nominalReturnPct: riskConstraints?.assumptions?.nominalReturnPct || 9.0,
    cashYieldPct: riskConstraints?.assumptions?.cashYieldPct || 4.0,
    taxDragBrokeragePct: 0.5,
    openingBalances,
    monthlyPlan: monthlyPlans,
    goals: {
      efTarget$,
    },
  };

  const simulation = simulateScenario(scenarioInput);

  // Keep a copy of scenario input for "baseline minus $X/month" (savings-helper scenario comparison)
  const netWorthScenarioInput: ScenarioInput = {
    ...scenarioInput,
    openingBalances: { ...scenarioInput.openingBalances, liabilities: scenarioInput.openingBalances.liabilities.map(d => ({ ...d })) },
    monthlyPlan: scenarioInput.monthlyPlan.map(p => ({ ...p })),
  };

  // Total monthly inflow used in sim (so scenario "undersave $200" can use baseline total - 200)
  const monthlySavingsTotal = round2(
    monthlyPlan.ef$ + monthlyPlan.highAprDebt$ + (monthlyPlan.preTax401k$ ?? 0) + monthlyPlan.match401k$ +
    (monthlyPlan.hsa$ ?? 0) + (monthlyPlan.employerHsa$ ?? 0) + monthlyPlan.retirementTaxAdv$ + monthlyPlan.brokerage$
  );

  // Debug: Log simulation arrays to check if they're populated
  console.log('[buildFinalPlanData] Simulation arrays after simulateScenario:', {
    cashLength: simulation.cash?.length || 0,
    brokerageLength: simulation.brokerage?.length || 0,
    retirementLength: simulation.retirement?.length || 0,
    assetsLength: simulation.assets?.length || 0,
    cashFirst3: simulation.cash?.slice(0, 3),
    brokerageFirst3: simulation.brokerage?.slice(0, 3),
    retirementFirst3: simulation.retirement?.slice(0, 3),
  });

  // Opening (today) net worth = assets - liabilities before any simulation month (aligns cards + chart with "today")
  const totalOpeningLiabilities = openingBalances.liabilities.reduce((s, d) => s + d.balance, 0);
  const openingNetWorth = Math.round(
    (openingBalances.cash + openingBalances.brokerage + openingBalances.retirement +
      (openingBalances.hsa ?? 0) + (openingBalances.otherAssets ?? 0) - totalOpeningLiabilities) * 100
  ) / 100;
  const openingAssets = openingBalances.cash + openingBalances.brokerage + openingBalances.retirement +
    (openingBalances.hsa ?? 0) + (openingBalances.otherAssets ?? 0);

  // Net worth projection: Today = opening (same for both plans); 6/12/24M = simulation (index 0 = after month 1)
  const netWorth6m = simulation.netWorth[5] ?? simulation.netWorth[0] ?? openingNetWorth; // Month 6 (index 5)
  const netWorth12m = simulation.netWorth[11] ?? simulation.netWorth[0] ?? openingNetWorth;
  const netWorth24m = simulation.netWorth[23] ?? simulation.netWorth[simulation.netWorth.length - 1] ?? openingNetWorth;

  const netWorthProjection: FinalPlanData['netWorthProjection'] = [
    { label: 'Today', months: 0, value: openingNetWorth },
    { label: '6 Months', months: 6, value: netWorth6m },
    { label: '12 Months', months: 12, value: netWorth12m },
    { label: '24 Months', months: 24, value: netWorth24m },
  ];

  const netWorthInsight = `Following this plan, your projected net worth is $${netWorth12m.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} in 12 months — up from $${openingNetWorth.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} today.`;

  // Include asset breakdowns for detailed analysis (simulation length = 480)
  const expectedLength = simulation.assets?.length ?? 480;
  const getArrayOrPlaceholder = (arr: number[] | undefined, name: string): number[] => {
    if (arr && Array.isArray(arr) && arr.length === expectedLength && expectedLength > 0) {
      return [...arr];
    }
    if (expectedLength > 0) {
      console.warn(`[buildFinalPlanData] ${name} array is missing or wrong length (expected ${expectedLength}, got ${arr?.length ?? 0}). Creating placeholder.`);
      return new Array(expectedLength).fill(0);
    }
    return [];
  };
  let chartCash = getArrayOrPlaceholder(simulation.cash, 'cash');
  let chartBrokerage = getArrayOrPlaceholder(simulation.brokerage, 'brokerage');
  let chartRetirement = getArrayOrPlaceholder(simulation.retirement, 'retirement');
  let chartHSA: number[] | undefined = (simulation.hsa && Array.isArray(simulation.hsa) && simulation.hsa.length === expectedLength)
    ? [...simulation.hsa]
    : undefined;
  // Prepend opening (today) so chart first point aligns with Today card
  chartCash = [openingBalances.cash, ...chartCash];
  chartBrokerage = [openingBalances.brokerage, ...chartBrokerage];
  chartRetirement = [openingBalances.retirement, ...chartRetirement];
  if (chartHSA) chartHSA = [(openingBalances.hsa ?? 0), ...chartHSA];

  const chartLabels = ['Today', ...simulation.labels];
  const chartNetWorth = [openingNetWorth, ...simulation.netWorth];
  const chartAssets = [openingAssets, ...simulation.assets];
  const chartLiabilities = [totalOpeningLiabilities, ...simulation.liabilities];
  
  // CRITICAL DEBUG: If arrays are empty but assets works, something is wrong
  if (chartAssets.length > 0 && (chartCash.length === 0 || chartBrokerage.length === 0 || chartRetirement.length === 0)) {
    console.error('❌❌❌ CRITICAL ERROR: Assets array has data but breakdown arrays are empty! ❌❌❌', {
      assetsLength: chartAssets.length,
      cashLength: chartCash.length,
      brokerageLength: chartBrokerage.length,
      retirementLength: chartRetirement.length,
      simulationCashExists: !!simulation.cash,
      simulationCashType: typeof simulation.cash,
      simulationCashIsArray: Array.isArray(simulation.cash),
      simulationCashLength: simulation.cash?.length ?? 0,
      simulationBrokerageExists: !!simulation.brokerage,
      simulationBrokerageLength: simulation.brokerage?.length ?? 0,
      simulationRetirementExists: !!simulation.retirement,
      simulationRetirementLength: simulation.retirement?.length ?? 0,
      simulationKeys: Object.keys(simulation),
      fullSimulation: simulation,
    });
  }
  
  // Debug: Check what we're actually getting from simulation
  console.log('[buildFinalPlanData] Simulation object check:', {
    hasCash: !!simulation.cash,
    cashType: typeof simulation.cash,
    cashIsArray: Array.isArray(simulation.cash),
    cashLength: simulation.cash?.length ?? 'undefined',
    cashFirstValue: simulation.cash?.[0],
    hasBrokerage: !!simulation.brokerage,
    brokerageLength: simulation.brokerage?.length ?? 'undefined',
    brokerageFirstValue: simulation.brokerage?.[0],
    hasRetirement: !!simulation.retirement,
    retirementLength: simulation.retirement?.length ?? 'undefined',
    retirementFirstValue: simulation.retirement?.[0],
    assetsLength: simulation.assets?.length ?? 'undefined',
    assetsFirstValue: simulation.assets?.[0],
    simulationKeys: Object.keys(simulation),
  });
  
  // Debug: Log after extraction
  console.log('[buildFinalPlanData] Chart arrays after extraction:', {
    chartCashLength: chartCash.length,
    chartBrokerageLength: chartBrokerage.length,
    chartRetirementLength: chartRetirement.length,
    chartAssetsLength: chartAssets.length,
  });

  // Debt payoff dates (from simulation - individual debt tracking)
  // The simulator tracks when each debt is paid off by name
  const debtPayoffMonths = simulation.debtPayoffMonths || new Map<string, number>();
  
  const debtsList: FinalPlanData['debts'] = debts.map(d => {
    // Get individual payoff month for this specific debt
    // The simulator uses debt.name as the key, so we need to match exactly
    let payoffMonth: number | undefined = undefined;
    
    // Try to find the payoff month for this debt by name
    if (debtPayoffMonths.size > 0) {
      payoffMonth = debtPayoffMonths.get(d.name);
    }
    
    // If not found individually, check if all debts are paid off at the same time
    // (fall back to overall debt-free month only if no individual tracking exists)
    if (payoffMonth === undefined && simulation.kpis.debtFreeMonth !== undefined) {
      // Only use overall debt-free month if we have no individual tracking
      // This means all debts were likely paid off together
      payoffMonth = simulation.kpis.debtFreeMonth;
    }
    
    const payoffDateLabel = payoffMonth !== undefined
      ? (() => {
          const date = new Date(scenarioInput.startDate);
          date.setMonth(date.getMonth() + payoffMonth!);
          return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        })()
      : 'TBD';
    
    return {
      id: d.id,
      name: d.name,
      apr: d.aprPct,
      payoffDateLabel,
    };
  });

  // Protection settings
  const timeHorizonMap: Record<string, string> = {
    short: '0–2 years',
    medium: '3–5 years',
    long: '5+ years',
  };

  const debtStrategyMap: Record<string, string> = {
    avalanche: 'Avalanche',
    snowball: 'Snowball',
    minimum_only: 'Minimums only',
  };

  return {
    paycheckAmount,
    paycheckCategories,
    emergencyFund: {
      current: efBalance$,
      target: efTarget$,
      monthsTarget: efTargetMonths,
      monthsToTarget,
    },
    goalsFunding,
    smartInsights: smartInsights.length > 0 ? smartInsights : ['Your plan is optimized for your current financial situation.'],
    debts: debtsList,
    monthlySavingsTotal,
    savingsBreakdown: {
      cashSavingsMTD: monthlyPlan.ef$ + monthlyPlan.highAprDebt$ + monthlyPlan.retirementTaxAdv$ + monthlyPlan.brokerage$,
      payrollSavingsMTD: (monthlyPlan.preTax401k$ ?? 0) + (monthlyPlan.hsa$ ?? 0),
      employerMatchMTD: monthlyPlan.match401k$ ?? 0,
      employerHSAMTD: monthlyPlan.employerHsa$ ?? 0,
      totalSavingsMTD: monthlySavingsTotal,
    },
    netWorthProjection,
    netWorthInsight,
    netWorthScenarioInput,
    netWorthChartData: {
      labels: chartLabels,
      netWorth: chartNetWorth,
      assets: chartAssets,
      liabilities: chartLiabilities,
      // Asset breakdowns for detailed analysis
      // Always include arrays with the same length as assets (even if filled with zeros)
      // This ensures the structure exists for the chat to use
      cash: chartCash,
      brokerage: chartBrokerage,
      retirement: chartRetirement,
      ...(chartHSA && chartHSA.length > 0 ? { hsa: chartHSA } : {}),
    },
    protection: {
      minCheckingBuffer: riskConstraints?.minCheckingBuffer$,
      minCashPct: riskConstraints?.minCashPct,
      riskTolerance: riskConstraints?.riskScore1to5,
      timeHorizonLabel: riskConstraints?.dominantTimeHorizon
        ? timeHorizonMap[riskConstraints.dominantTimeHorizon]
        : undefined,
      debtStrategyLabel: safetyStrategy?.debtPayoffStrategy
        ? debtStrategyMap[safetyStrategy.debtPayoffStrategy]
        : undefined,
    },
  };
}

