/**
 * Store for Savings Helper simulation scenario selection.
 * Persisted to localStorage so selection is kept when navigating home → savings-helper.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Past3mScenarioId, CurrentMonthScenarioId } from './scenarios';
import {
  PAST3M_SCENARIO_DEFAULT,
  CURRENT_MONTH_SCENARIO_DEFAULT,
} from './scenarios';

export interface SavingsHelperScenarioState {
  past3mScenarioId: Past3mScenarioId;
  currentMonthScenarioId: CurrentMonthScenarioId;
  setPast3mScenarioId: (id: Past3mScenarioId) => void;
  setCurrentMonthScenarioId: (id: CurrentMonthScenarioId) => void;
}

const STORAGE_KEY = 'mvp-savings-helper-scenario';

export const useSavingsHelperScenarioStore = create<SavingsHelperScenarioState>()(
  persist(
    (set) => ({
      past3mScenarioId: PAST3M_SCENARIO_DEFAULT,
      currentMonthScenarioId: CURRENT_MONTH_SCENARIO_DEFAULT,
      setPast3mScenarioId: (past3mScenarioId) => set({ past3mScenarioId }),
      setCurrentMonthScenarioId: (currentMonthScenarioId) => set({ currentMonthScenarioId }),
    }),
    { name: STORAGE_KEY }
  )
);
