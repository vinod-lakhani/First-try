/**
 * Onboarding - Assets & Goals Micro-Flow
 * 
 * Phase 8: Manage assets and financial goals.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useOnboardingStore } from '@/lib/onboarding/store';
import type { Asset, Goal, PrimaryGoal } from '@/lib/onboarding/types';
import { Plus, Trash2, Save, Target } from 'lucide-react';

const assetTypes: Array<{ value: Asset['type']; label: string }> = [
  { value: 'cash', label: 'Cash / Savings' },
  { value: 'brokerage', label: 'Brokerage' },
  { value: 'retirement', label: 'Retirement (401k/IRA)' },
  { value: 'hsa', label: 'HSA' },
  { value: 'other', label: 'Other' },
];

const goalTypes: Array<{ value: PrimaryGoal; label: string }> = [
  { value: 'house-down-payment', label: 'Big Purchase / Travel' },
  { value: 'retirement', label: 'Retirement' },
  { value: 'emergency-fund', label: 'Emergency Fund' },
  { value: 'debt-free', label: 'Debt Free' },
  { value: 'other', label: 'Other' },
];

const priorityOptions = [
  { value: 1, label: 'High' },
  { value: 2, label: 'Medium' },
  { value: 3, label: 'Low' },
];

export default function AssetsGoalsPage() {
  const router = useRouter();
  const { assets, goals, setAssets, setGoals, addAsset, updateAsset, removeAsset } =
    useOnboardingStore();

  const [assetsList, setAssetsList] = useState<Asset[]>(assets);
  const [selectedGoals, setSelectedGoals] = useState<Set<PrimaryGoal>>(
    new Set(goals.map((g) => g.type))
  );
  const [goalPriorities, setGoalPriorities] = useState<Record<string, number>>(
    goals.reduce((acc, g) => {
      acc[g.type] = g.priority;
      return acc;
    }, {} as Record<string, number>)
  );
  const [otherGoalDescription, setOtherGoalDescription] = useState('');

  useEffect(() => {
    setAssetsList(assets);
    setSelectedGoals(new Set(goals.map((g) => g.type)));
    setGoalPriorities(
      goals.reduce((acc, g) => {
        acc[g.type] = g.priority;
        return acc;
      }, {} as Record<string, number>)
    );
  }, [assets, goals]);

  const handleSave = () => {
    // Save assets
    setAssets(assetsList);

    // Convert selected goals to Goal objects
    const goalsList: Goal[] = Array.from(selectedGoals).map((goalType, idx) => ({
      id: `goal-${goalType}-${Date.now()}`,
      type: goalType,
      name: goalTypes.find((gt) => gt.value === goalType)?.label || goalType,
      priority: goalPriorities[goalType] || idx + 1,
      description: goalType === 'other' ? otherGoalDescription : undefined,
    }));

    setGoals(goalsList);
    router.push('/onboarding/boost');
  };

  const handleUpdateAsset = (id: string, updates: Partial<Asset>) => {
    const updated = assetsList.map((asset) =>
      asset.id === id ? { ...asset, ...updates } : asset
    );
    setAssetsList(updated);
  };

  const handleRemoveAsset = (id: string) => {
    setAssetsList(assetsList.filter((a) => a.id !== id));
  };

  const handleAddAsset = () => {
    const newAsset: Asset = {
      id: `asset-${Date.now()}`,
      name: '',
      value$: 0,
      type: 'cash',
    };
    setAssetsList([...assetsList, newAsset]);
  };

  const toggleGoal = (goalType: PrimaryGoal) => {
    const newSet = new Set(selectedGoals);
    if (newSet.has(goalType)) {
      newSet.delete(goalType);
    } else {
      newSet.add(goalType);
    }
    setSelectedGoals(newSet);
  };

  return (
    <Card className="w-full">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl sm:text-3xl font-bold">
          Assets & Goals
        </CardTitle>
        <CardDescription className="text-base">
          Track your assets and set financial goals to personalize your plan.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-8">
        {/* Assets Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Your Assets
            </h3>
          </div>

          {assetsList.length > 0 && (
            <div className="space-y-3">
              {assetsList.map((asset) => (
                <div
                  key={asset.id}
                  className="rounded-lg border bg-white p-4 dark:bg-slate-800"
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                        Name / Account
                      </label>
                      <input
                        type="text"
                        value={asset.name}
                        onChange={(e) =>
                          handleUpdateAsset(asset.id, { name: e.target.value })
                        }
                        placeholder="e.g., Chase Savings"
                        className="mt-1 block w-full rounded-md border-slate-300 px-3 py-2 text-sm focus:border-primary focus:ring-primary dark:bg-slate-700 dark:border-slate-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                        Type
                      </label>
                      <select
                        value={asset.type}
                        onChange={(e) =>
                          handleUpdateAsset(asset.id, {
                            type: e.target.value as Asset['type'],
                          })
                        }
                        className="mt-1 block w-full rounded-md border-slate-300 py-2 pl-3 pr-10 text-sm focus:border-primary focus:ring-primary dark:bg-slate-700 dark:border-slate-600"
                      >
                        {assetTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                        Value
                      </label>
                      <div className="relative mt-1">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <span className="text-slate-500 sm:text-sm">$</span>
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          value={asset.value$ || ''}
                          onChange={(e) =>
                            handleUpdateAsset(asset.id, {
                              value$: parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder="0.00"
                          className="block w-full rounded-md border-slate-300 pl-7 pr-3 py-2 text-sm focus:border-primary focus:ring-primary dark:bg-slate-700 dark:border-slate-600"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() => handleRemoveAsset(asset.id)}
                      className="rounded-md p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button onClick={handleAddAsset} variant="outline" className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add Asset
          </Button>
        </div>

        {/* Goals Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Financial Goals
            </h3>
          </div>

          <div className="space-y-3">
            {goalTypes.map((goalType) => (
              <div
                key={goalType.value}
                className="rounded-lg border bg-white p-4 dark:bg-slate-800"
              >
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedGoals.has(goalType.value)}
                      onChange={() => toggleGoal(goalType.value)}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span className="font-medium text-slate-900 dark:text-white">
                      {goalType.label}
                    </span>
                  </label>

                  {selectedGoals.has(goalType.value) && (
                    <select
                      value={goalPriorities[goalType.value] || 2}
                      onChange={(e) =>
                        setGoalPriorities({
                          ...goalPriorities,
                          [goalType.value]: parseInt(e.target.value),
                        })
                      }
                      className="rounded-md border-slate-300 py-1 pl-3 pr-8 text-sm focus:border-primary focus:ring-primary dark:bg-slate-700 dark:border-slate-600"
                    >
                      {priorityOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label} Priority
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {goalType.value === 'other' && selectedGoals.has(goalType.value) && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Description
                    </label>
                    <input
                      type="text"
                      value={otherGoalDescription}
                      onChange={(e) => setOtherGoalDescription(e.target.value)}
                      placeholder="Describe your goal"
                      className="mt-1 block w-full rounded-md border-slate-300 px-3 py-2 text-sm focus:border-primary focus:ring-primary dark:bg-slate-700 dark:border-slate-600"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
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

