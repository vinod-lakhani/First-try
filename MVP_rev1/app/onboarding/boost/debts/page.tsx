/**
 * Onboarding - Debts Micro-Flow
 * 
 * Phase 7: Manage debts (credit cards, loans, etc.).
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useOnboardingStore } from '@/lib/onboarding/store';
import type { Debt } from '@/lib/onboarding/types';
import { Plus, Trash2, Save } from 'lucide-react';

export default function DebtsPage() {
  const router = useRouter();
  const { debts, setDebts, addDebt, updateDebt, removeDebt } = useOnboardingStore();

  const [debtsList, setDebtsList] = useState<Debt[]>(debts);
  const [includedDebts, setIncludedDebts] = useState<Set<string>>(
    new Set(debts.map((d) => d.id))
  );

  useEffect(() => {
    setDebtsList(debts);
    setIncludedDebts(new Set(debts.map((d) => d.id)));
  }, [debts]);

  const handleSave = () => {
    // Only save debts that are included
    const included = debtsList.filter((d) => includedDebts.has(d.id));
    setDebts(included);
    router.push('/onboarding/boost');
  };

  const handleUpdateDebt = (id: string, updates: Partial<Debt>) => {
    const updated = debtsList.map((debt) =>
      debt.id === id ? { ...debt, ...updates } : debt
    );
    setDebtsList(updated);
  };

  const handleRemoveDebt = (id: string) => {
    setDebtsList(debtsList.filter((d) => d.id !== id));
    const newIncluded = new Set(includedDebts);
    newIncluded.delete(id);
    setIncludedDebts(newIncluded);
  };

  const handleAddDebt = () => {
    const newDebt: Debt = {
      id: `debt-${Date.now()}`,
      name: '',
      balance$: 0,
      aprPct: 0,
      minPayment$: 0,
      type: 'credit_card',
    };
    setDebtsList([...debtsList, newDebt]);
    setIncludedDebts(new Set([...includedDebts, newDebt.id]));
  };

  const toggleIncluded = (id: string) => {
    const newSet = new Set(includedDebts);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setIncludedDebts(newSet);
  };

  return (
    <Card className="w-full">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl sm:text-3xl font-bold">
          Your Debts
        </CardTitle>
        <CardDescription className="text-base">
          Add and manage your debts to optimize your payoff strategy.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Existing Debts */}
        {debtsList.length > 0 && (
          <div className="space-y-3">
            {debtsList.map((debt) => (
              <div
                key={debt.id}
                className="rounded-lg border bg-white p-4 dark:bg-slate-800"
              >
                <div className="mb-3 flex items-center justify-between">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={includedDebts.has(debt.id)}
                      onChange={() => toggleIncluded(debt.id)}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Include in plan
                    </span>
                  </label>
                  <button
                    onClick={() => handleRemoveDebt(debt.id)}
                    className="rounded-md p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Type
                    </label>
                    <select
                      value={debt.type || 'credit_card'}
                      onChange={(e) =>
                        handleUpdateDebt(debt.id, { type: e.target.value })
                      }
                      className="mt-1 block w-full rounded-md border-slate-300 py-2 pl-3 pr-10 text-sm focus:border-primary focus:ring-primary dark:bg-slate-700 dark:border-slate-600"
                    >
                      <option value="credit_card">Credit Card</option>
                      <option value="student_loan">Student Loan</option>
                      <option value="personal_loan">Personal Loan</option>
                      <option value="auto_loan">Auto Loan</option>
                      <option value="mortgage">Mortgage</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Name / Account
                    </label>
                    <input
                      type="text"
                      value={debt.name}
                      onChange={(e) =>
                        handleUpdateDebt(debt.id, { name: e.target.value })
                      }
                      placeholder="e.g., Chase Credit Card"
                      className="mt-1 block w-full rounded-md border-slate-300 px-3 py-2 text-sm focus:border-primary focus:ring-primary dark:bg-slate-700 dark:border-slate-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Balance
                    </label>
                    <div className="relative mt-1">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <span className="text-slate-500 sm:text-sm">$</span>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        value={debt.balance$ || ''}
                        onChange={(e) =>
                          handleUpdateDebt(debt.id, {
                            balance$: parseFloat(e.target.value) || 0,
                            isHighApr: (debt.aprPct || 0) > 10,
                          })
                        }
                        placeholder="0.00"
                        className="block w-full rounded-md border-slate-300 pl-7 pr-3 py-2 text-sm focus:border-primary focus:ring-primary dark:bg-slate-700 dark:border-slate-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      APR (%)
                    </label>
                    <div className="relative mt-1">
                      <input
                        type="number"
                        step="0.1"
                        value={debt.aprPct || ''}
                        onChange={(e) => {
                          const apr = parseFloat(e.target.value) || 0;
                          handleUpdateDebt(debt.id, {
                            aprPct: apr,
                            isHighApr: apr > 10,
                          });
                        }}
                        placeholder="0.0"
                        className="block w-full rounded-md border-slate-300 px-3 py-2 text-sm focus:border-primary focus:ring-primary dark:bg-slate-700 dark:border-slate-600"
                      />
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                        <span className="text-slate-500 sm:text-sm">%</span>
                      </div>
                    </div>
                    {debt.aprPct && debt.aprPct > 10 && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                        High-APR debt (priority for payoff)
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Minimum Payment
                    </label>
                    <div className="relative mt-1">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <span className="text-slate-500 sm:text-sm">$</span>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        value={debt.minPayment$ || ''}
                        onChange={(e) =>
                          handleUpdateDebt(debt.id, {
                            minPayment$: parseFloat(e.target.value) || 0,
                          })
                        }
                        placeholder="0.00"
                        className="block w-full rounded-md border-slate-300 pl-7 pr-3 py-2 text-sm focus:border-primary focus:ring-primary dark:bg-slate-700 dark:border-slate-600"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Debt Button */}
        <Button onClick={handleAddDebt} variant="outline" className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Add Debt
        </Button>

        {debtsList.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-400">
              No debts added yet. Click "Add Debt" to get started.
            </p>
          </div>
        )}

        {/* Save Button */}
        <div className="pt-4">
          <Button onClick={handleSave} size="lg" className="w-full">
            <Save className="mr-2 h-4 w-4" />
            Save & Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

