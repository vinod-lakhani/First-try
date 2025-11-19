/**
 * Plaid Connection Helper
 * 
 * Shared logic for connecting Plaid and updating the onboarding store.
 */

import { mockPlaidConnect, type MockPlaidData } from './mock';
import type { OnboardingStore } from '@/lib/onboarding/store';

/**
 * Connects with Plaid (or mock) and updates the onboarding store.
 * 
 * This function:
 * 1. Calls the Plaid/mock connection function
 * 2. Updates the store with income, fixedExpenses, debts, and assets
 * 3. Sets plaidConnected = true
 * 4. Sets lastSyncDate
 * 
 * @param store - The onboarding store instance (from useOnboardingStore.getState() or passed directly)
 * @returns Promise that resolves when connection is complete
 */
export async function connectWithPlaidAndUpdateStore(
  store: Pick<
    OnboardingStore,
    | 'setIncome'
    | 'setFixedExpenses'
    | 'setDebts'
    | 'setAssets'
    | 'setPlaidConnected'
    | 'setLastSyncDate'
  >
): Promise<MockPlaidData> {
  // Call Plaid/mock connection
  const data = await mockPlaidConnect();

  // Update store with Plaid data
  if (data.income) {
    store.setIncome(data.income);
  }
  store.setFixedExpenses(data.fixedExpenses);
  store.setDebts(data.debts);
  store.setAssets(data.assets);
  store.setPlaidConnected(true);
  store.setLastSyncDate(new Date().toISOString());

  return data;
}

