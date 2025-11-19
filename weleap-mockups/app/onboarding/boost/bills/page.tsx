/**
 * Onboarding - Bills & Subscriptions Micro-Flow
 * 
 * Phase 6: Manage fixed expenses (bills and subscriptions).
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useOnboardingStore } from '@/lib/onboarding/store';
import type { FixedExpense } from '@/lib/onboarding/types';
import { Plus, Trash2, Save } from 'lucide-react';

export default function BillsPage() {
  const router = useRouter();
  const {
    plaidConnected,
    fixedExpenses,
    setFixedExpenses,
    updateFixedExpense,
    removeFixedExpense,
    addFixedExpense,
  } = useOnboardingStore();

  const [expenses, setExpenses] = useState<FixedExpense[]>(fixedExpenses);
  const [newExpenseName, setNewExpenseName] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    setExpenses(fixedExpenses);
  }, [fixedExpenses]);

  const handleSave = () => {
    setFixedExpenses(expenses);
    router.push('/onboarding/boost');
  };

  const handleUpdateExpense = (id: string, updates: Partial<FixedExpense>) => {
    const updated = expenses.map((exp) =>
      exp.id === id ? { ...exp, ...updates } : exp
    );
    setExpenses(updated);
  };

  const handleRemoveExpense = (id: string) => {
    setExpenses(expenses.filter((exp) => exp.id !== id));
  };

  const handleAddExpense = () => {
    if (newExpenseName && newExpenseAmount > 0) {
      const newExpense: FixedExpense = {
        id: `exp-${Date.now()}`,
        name: newExpenseName,
        amount$: newExpenseAmount,
        frequency: 'monthly',
        category: 'needs',
        isSubscription: false,
      };
      setExpenses([...expenses, newExpense]);
      setNewExpenseName('');
      setNewExpenseAmount(0);
      setShowAddForm(false);
    }
  };

  // If Plaid connected and we have expenses, show editable list
  if (plaidConnected && expenses.length > 0) {
    return (
      <Card className="w-full">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl sm:text-3xl font-bold">
            Bills & Subscriptions
          </CardTitle>
          <CardDescription className="text-base">
            Review and edit your recurring expenses from your connected accounts.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Existing Expenses */}
          <div className="space-y-3">
            {expenses.map((expense) => (
              <div
                key={expense.id}
                className="rounded-lg border bg-white p-4 dark:bg-slate-800"
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Name
                    </label>
                    <input
                      type="text"
                      value={expense.name}
                      onChange={(e) =>
                        handleUpdateExpense(expense.id, { name: e.target.value })
                      }
                      className="mt-1 block w-full rounded-md border-slate-300 px-3 py-2 text-sm focus:border-primary focus:ring-primary dark:bg-slate-700 dark:border-slate-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Amount
                    </label>
                    <div className="relative mt-1">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <span className="text-slate-500 sm:text-sm">$</span>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        value={expense.amount$}
                        onChange={(e) =>
                          handleUpdateExpense(expense.id, {
                            amount$: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="block w-full rounded-md border-slate-300 pl-7 pr-3 py-2 text-sm focus:border-primary focus:ring-primary dark:bg-slate-700 dark:border-slate-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Type
                    </label>
                    <select
                      value={expense.isSubscription ? 'subscription' : 'fixed'}
                      onChange={(e) =>
                        handleUpdateExpense(expense.id, {
                          isSubscription: e.target.value === 'subscription',
                        })
                      }
                      className="mt-1 block w-full rounded-md border-slate-300 py-2 pl-3 pr-10 text-sm focus:border-primary focus:ring-primary dark:bg-slate-700 dark:border-slate-600"
                    >
                      <option value="fixed">Fixed Bill</option>
                      <option value="subscription">Subscription</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={() => handleRemoveExpense(expense.id)}
                      className="rounded-md p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={expense.category === 'needs'}
                      onChange={(e) =>
                        handleUpdateExpense(expense.id, {
                          category: e.target.checked ? 'needs' : 'wants',
                        })
                      }
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      Essential (Needs)
                    </span>
                  </label>
                </div>
              </div>
            ))}
          </div>

          {/* Add New Expense */}
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            variant="outline"
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </Button>

          {showAddForm && (
            <div className="rounded-lg border bg-slate-50 p-4 dark:bg-slate-800">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Name
                  </label>
                  <input
                    type="text"
                    value={newExpenseName}
                    onChange={(e) => setNewExpenseName(e.target.value)}
                    placeholder="e.g., Netflix"
                    className="mt-1 block w-full rounded-md border-slate-300 px-3 py-2 text-sm focus:border-primary focus:ring-primary dark:bg-slate-700 dark:border-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Amount
                  </label>
                  <div className="relative mt-1">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <span className="text-slate-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={newExpenseAmount || ''}
                      onChange={(e) =>
                        setNewExpenseAmount(parseFloat(e.target.value) || 0)
                      }
                      placeholder="0.00"
                      className="block w-full rounded-md border-slate-300 pl-7 pr-3 py-2 text-sm focus:border-primary focus:ring-primary dark:bg-slate-700 dark:border-slate-600"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button onClick={handleAddExpense} size="sm">
                  Add
                </Button>
                <Button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewExpenseName('');
                    setNewExpenseAmount(0);
                  }}
                  variant="outline"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="pt-4">
            <Button onClick={handleSave} size="lg" className="w-full">
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Manual entry flow
  return (
    <Card className="w-full">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl sm:text-3xl font-bold">
          Bills & Subscriptions
        </CardTitle>
        <CardDescription className="text-base">
          Add your key recurring expenses to get accurate recommendations.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Key Bills Form */}
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-4 dark:bg-slate-800">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Rent / Housing
            </label>
            <div className="relative mt-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <span className="text-slate-500 sm:text-sm">$</span>
              </div>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                onChange={(e) => {
                  const amount = parseFloat(e.target.value) || 0;
                  if (amount > 0) {
                    const existing = expenses.find((e) => e.name.toLowerCase().includes('rent'));
                    if (existing) {
                      handleUpdateExpense(existing.id, { amount$: amount });
                    } else {
                      const newExp: FixedExpense = {
                        id: `exp-rent-${Date.now()}`,
                        name: 'Rent / Housing',
                        amount$: amount,
                        frequency: 'monthly',
                        category: 'needs',
                      };
                      setExpenses([...expenses, newExp]);
                    }
                  }
                }}
                className="block w-full rounded-md border-slate-300 pl-7 pr-3 py-2 text-sm focus:border-primary focus:ring-primary dark:bg-slate-700 dark:border-slate-600"
              />
            </div>
          </div>

          <div className="rounded-lg border bg-white p-4 dark:bg-slate-800">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Phone & Internet
            </label>
            <div className="relative mt-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <span className="text-slate-500 sm:text-sm">$</span>
              </div>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                onChange={(e) => {
                  const amount = parseFloat(e.target.value) || 0;
                  if (amount > 0) {
                    const existing = expenses.find((e) =>
                      e.name.toLowerCase().includes('phone') || e.name.toLowerCase().includes('internet')
                    );
                    if (existing) {
                      handleUpdateExpense(existing.id, { amount$: amount });
                    } else {
                      const newExp: FixedExpense = {
                        id: `exp-phone-${Date.now()}`,
                        name: 'Phone & Internet',
                        amount$: amount,
                        frequency: 'monthly',
                        category: 'needs',
                        isSubscription: true,
                      };
                      setExpenses([...expenses, newExp]);
                    }
                  }
                }}
                className="block w-full rounded-md border-slate-300 pl-7 pr-3 py-2 text-sm focus:border-primary focus:ring-primary dark:bg-slate-700 dark:border-slate-600"
              />
            </div>
          </div>

          {/* Generic Add Form */}
          {expenses
            .filter((e) => !e.name.toLowerCase().includes('rent') && !e.name.toLowerCase().includes('phone') && !e.name.toLowerCase().includes('internet'))
            .map((expense) => (
              <div
                key={expense.id}
                className="rounded-lg border bg-white p-4 dark:bg-slate-800"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={expense.name}
                      onChange={(e) =>
                        handleUpdateExpense(expense.id, { name: e.target.value })
                      }
                      placeholder="Bill name"
                      className="block w-full rounded-md border-slate-300 px-3 py-2 text-sm focus:border-primary focus:ring-primary dark:bg-slate-700 dark:border-slate-600"
                    />
                  </div>
                  <div className="ml-3 w-32">
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <span className="text-slate-500 sm:text-sm">$</span>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        value={expense.amount$}
                        onChange={(e) =>
                          handleUpdateExpense(expense.id, {
                            amount$: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="block w-full rounded-md border-slate-300 pl-7 pr-3 py-2 text-sm focus:border-primary focus:ring-primary dark:bg-slate-700 dark:border-slate-600"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveExpense(expense.id)}
                    className="ml-3 rounded-md p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}

          <Button
            onClick={() => {
              const newExp: FixedExpense = {
                id: `exp-${Date.now()}`,
                name: '',
                amount$: 0,
                frequency: 'monthly',
                category: 'needs',
              };
              setExpenses([...expenses, newExp]);
            }}
            variant="outline"
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Another Bill
          </Button>
        </div>

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

