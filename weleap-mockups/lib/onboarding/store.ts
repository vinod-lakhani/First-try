/**
 * Onboarding Store
 * 
 * Zustand store for managing onboarding state across all steps.
 */

import { create } from 'zustand';
import type {
  OnboardingState,
  IncomeState,
  FixedExpense,
  Debt,
  Asset,
  PrimaryGoal,
  Goal,
  SafetyStrategy,
  RiskConstraints,
  PaycheckPlan,
  PulsePreferences,
} from './types';

/**
 * Default onboarding state
 */
const defaultState: OnboardingState = {
  currentStep: 'welcome',
  isComplete: false,
  plaidConnected: false,
  fixedExpenses: [],
  debts: [],
  assets: [],
  goals: [],
  riskConstraints: {
    shiftLimitPct: 4.0,
    targets: {
      needsPct: 0.50,
      wantsPct: 0.30,
      savingsPct: 0.20,
    },
    assumptions: {
      cashYieldPct: 4.0,
      nominalReturnPct: 9.0,
      taxDragBrokeragePct: 0.5,
      inflationRatePct: 2.5,
    },
  },
  safetyStrategy: {
    efTargetMonths: 3,
    efBalance$: 0,
    liquidity: 'Medium',
    retirementFocus: 'High',
    onIDR: false,
    match401kPerMonth$: 0,
    iraRoomThisYear$: 7000,
    k401RoomThisYear$: 23000,
  },
  pulsePreferences: {
    enabled: false,
    frequency: 'weekly',
    channels: ['email'],
  },
};

/**
 * Onboarding store interface
 */
export interface OnboardingStore extends OnboardingState {
  // Income setters
  setIncome: (income: IncomeState) => void;
  updateIncome: (updates: Partial<IncomeState>) => void;
  
  // Plaid setters
  setPlaidConnected: (connected: boolean, accessToken?: string) => void;
  setLastSyncDate: (date: string) => void;
  
  // Fixed expenses setters
  setFixedExpenses: (expenses: FixedExpense[]) => void;
  addFixedExpense: (expense: FixedExpense) => void;
  updateFixedExpense: (id: string, updates: Partial<FixedExpense>) => void;
  removeFixedExpense: (id: string) => void;
  
  // Debts setters
  setDebts: (debts: Debt[]) => void;
  addDebt: (debt: Debt) => void;
  updateDebt: (id: string, updates: Partial<Debt>) => void;
  removeDebt: (id: string) => void;
  
  // Assets setters
  setAssets: (assets: Asset[]) => void;
  addAsset: (asset: Asset) => void;
  updateAsset: (id: string, updates: Partial<Asset>) => void;
  removeAsset: (id: string) => void;
  
  // Goals setters
  setPrimaryGoal: (goal: PrimaryGoal) => void;
  setGoals: (goals: Goal[]) => void;
  addGoal: (goal: Goal) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  removeGoal: (id: string) => void;
  
  // Safety strategy setters
  setSafetyStrategy: (strategy: SafetyStrategy) => void;
  updateSafetyStrategy: (updates: Partial<SafetyStrategy>) => void;
  
  // Risk constraints setters
  setRiskConstraints: (constraints: RiskConstraints) => void;
  updateRiskConstraints: (updates: Partial<RiskConstraints>) => void;
  
  // Paycheck plan setters
  setInitialPaycheckPlan: (plan: PaycheckPlan | undefined) => void;
  setBoostedPaycheckPlan: (plan: PaycheckPlan) => void;
  
  // Net worth setters
  setBaselineNetWorth: (netWorth: OnboardingState['baselineNetWorth']) => void;
  setProjectedNetWorth: (netWorth: OnboardingState['projectedNetWorth']) => void;
  
  // Money persona setter
  setMoneyPersona: (persona: string) => void;
  
  // Pulse preferences setters
  setPulsePreferences: (preferences: PulsePreferences) => void;
  updatePulsePreferences: (updates: Partial<PulsePreferences>) => void;
  
  // Step navigation
  setCurrentStep: (step: string) => void;
  setComplete: (complete: boolean) => void;
  
  // Reset
  resetOnboarding: () => void;
}

/**
 * Create the onboarding store
 */
export const useOnboardingStore = create<OnboardingStore>((set) => ({
  ...defaultState,
  
  // Income setters
  setIncome: (income) => set({ income }),
  updateIncome: (updates) =>
    set((state) => ({
      income: state.income ? { ...state.income, ...updates } : undefined,
    })),
  
  // Plaid setters
  setPlaidConnected: (connected, accessToken) =>
    set({ plaidConnected: connected, plaidAccessToken: accessToken }),
  setLastSyncDate: (date) => set({ lastSyncDate: date }),
  
  // Fixed expenses setters
  setFixedExpenses: (expenses) => set({ fixedExpenses: expenses }),
  addFixedExpense: (expense) =>
    set((state) => ({
      fixedExpenses: [...state.fixedExpenses, expense],
    })),
  updateFixedExpense: (id, updates) =>
    set((state) => ({
      fixedExpenses: state.fixedExpenses.map((exp) =>
        exp.id === id ? { ...exp, ...updates } : exp
      ),
    })),
  removeFixedExpense: (id) =>
    set((state) => ({
      fixedExpenses: state.fixedExpenses.filter((exp) => exp.id !== id),
    })),
  
  // Debts setters
  setDebts: (debts) => set({ debts }),
  addDebt: (debt) =>
    set((state) => ({
      debts: [...state.debts, debt],
    })),
  updateDebt: (id, updates) =>
    set((state) => ({
      debts: state.debts.map((debt) =>
        debt.id === id ? { ...debt, ...updates } : debt
      ),
    })),
  removeDebt: (id) =>
    set((state) => ({
      debts: state.debts.filter((debt) => debt.id !== id),
    })),
  
  // Assets setters
  setAssets: (assets) => set({ assets }),
  addAsset: (asset) =>
    set((state) => ({
      assets: [...state.assets, asset],
    })),
  updateAsset: (id, updates) =>
    set((state) => ({
      assets: state.assets.map((asset) =>
        asset.id === id ? { ...asset, ...updates } : asset
      ),
    })),
  removeAsset: (id) =>
    set((state) => ({
      assets: state.assets.filter((asset) => asset.id !== id),
    })),
  
  // Goals setters
  setPrimaryGoal: (goal) => set({ primaryGoal: goal }),
  setGoals: (goals) => set({ goals }),
  addGoal: (goal) =>
    set((state) => ({
      goals: [...state.goals, goal],
    })),
  updateGoal: (id, updates) =>
    set((state) => ({
      goals: state.goals.map((g) => (g.id === id ? { ...g, ...updates } : g)),
    })),
  removeGoal: (id) =>
    set((state) => ({
      goals: state.goals.filter((g) => g.id !== id),
    })),
  
  // Safety strategy setters
  setSafetyStrategy: (strategy) => set({ safetyStrategy: strategy }),
  updateSafetyStrategy: (updates) =>
    set((state) => ({
      safetyStrategy: state.safetyStrategy
        ? { ...state.safetyStrategy, ...updates }
        : undefined,
    })),
  
  // Risk constraints setters
  setRiskConstraints: (constraints) => set({ riskConstraints: constraints }),
  updateRiskConstraints: (updates) =>
    set((state) => ({
      riskConstraints: state.riskConstraints
        ? { ...state.riskConstraints, ...updates }
        : undefined,
    })),
  
  // Paycheck plan setters
  setInitialPaycheckPlan: (plan) => set({ initialPaycheckPlan: plan }),
  setBoostedPaycheckPlan: (plan) => set({ boostedPaycheckPlan: plan }),
  
  // Net worth setters
  setBaselineNetWorth: (netWorth) => set({ baselineNetWorth: netWorth }),
  setProjectedNetWorth: (netWorth) => set({ projectedNetWorth: netWorth }),
  
  // Money persona setter
  setMoneyPersona: (persona) => set({ moneyPersona: persona }),
  
  // Pulse preferences setters
  setPulsePreferences: (preferences) => set({ pulsePreferences: preferences }),
  updatePulsePreferences: (updates) =>
    set((state) => ({
      pulsePreferences: state.pulsePreferences
        ? { ...state.pulsePreferences, ...updates }
        : undefined,
    })),
  
  // Step navigation
  setCurrentStep: (step) => set({ currentStep: step }),
  setComplete: (complete) =>
    set({
      isComplete: complete,
      completedAt: complete ? new Date().toISOString() : undefined,
    }),
  
  // Reset
  resetOnboarding: () =>
    set({
      ...defaultState,
      startedAt: new Date().toISOString(),
    }),
}));

