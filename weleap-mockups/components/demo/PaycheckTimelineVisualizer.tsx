// @ts-nocheck
"use client";
import React, { useState } from 'react';

export default function PaycheckTimelineVisualizer() {
  const paycheck = 2669;
  const fixed = 1642;
  const initialSavings = 534;
  const initialVariable = 493;
  const emergencyFund = 3000;

  const [variableSpentCurrent, setVariableSpentCurrent] = useState(0);
  const [isThreePaycheckMonth, setIsThreePaycheckMonth] = useState(false);
  const [editModeTarget, setEditModeTarget] = useState<string | null>(null);
  const [editableAllocations, setEditableAllocations] = useState({
    Current: { fixed, savings: initialSavings, variable: initialVariable },
    Next: { fixed, savings: initialSavings, variable: initialVariable },
    Bonus: { fixed: 0, savings: paycheck, variable: 0 },
  });

  const currentAlloc = editableAllocations.Current;
  const nextAlloc = editableAllocations.Next;
  const bonusAlloc = editableAllocations.Bonus;

  const savingsConsumed = Math.max(variableSpentCurrent - currentAlloc.variable, 0);
  const emergencyConsumed = Math.max(variableSpentCurrent - (currentAlloc.variable + currentAlloc.savings), 0);
  const variableRemaining = Math.max(currentAlloc.variable - variableSpentCurrent, 0);

  let status = `✅ You're within your variable budget. Remaining: $${variableRemaining.toFixed(0)}`;
  if (savingsConsumed > 0 && emergencyConsumed === 0) {
    status = `⚠️ Dipped into savings by $${savingsConsumed.toFixed(0)}.`;
  } else if (emergencyConsumed > 0) {
    status = `🚨 Emergency fund in use! $${emergencyConsumed.toFixed(0)} used.`;
  }

  const handleVariableChange = (value: number) => {
    setVariableSpentCurrent(value);
    const overspent = value - currentAlloc.variable;
    if (overspent > 0) {
      const savingsUsedInCurrent = Math.min(overspent, currentAlloc.savings);
      const savingsRecoveryAmount = savingsUsedInCurrent;
      const maxSavingsAdjustment = paycheck - nextAlloc.fixed;
      const proposedSavings = Math.min(initialSavings + savingsRecoveryAmount, maxSavingsAdjustment);
      const proposedVariable = paycheck - nextAlloc.fixed - proposedSavings;

      setEditableAllocations(prev => ({
        ...prev,
        Next: {
          ...prev.Next,
          savings: proposedSavings,
          variable: proposedVariable,
          fixed: prev.Next.fixed,
        },
      }));
    } else {
      setEditableAllocations(prev => ({
        ...prev,
        Next: {
          ...prev.Next,
          savings: initialSavings,
          variable: initialVariable,
          fixed: prev.Next.fixed,
        },
      }));
    }
  };

  const handleEditChange = (category: string, value: number) => {
    if (!editModeTarget) return;
    const target = editModeTarget as keyof typeof editableAllocations;
    const updated = { ...editableAllocations[target], [category]: value };
    const total = updated.fixed + updated.savings + updated.variable;
    if (total <= paycheck) {
      setEditableAllocations((prev) => ({ ...prev, [target]: updated }));
    }
  };

  const renderEditSliders = () => {
    if (!editModeTarget) return null;
    const target = editModeTarget as keyof typeof editableAllocations;
    return (
      <div className="space-y-2 mb-4">
        {['fixed', 'savings', 'variable'].map((cat) => (
          <div key={cat}>
            <label className="block text-sm font-medium capitalize">{cat} (${editableAllocations[target][cat as keyof typeof editableAllocations[typeof target]]})</label>
            <input
              type="range"
              min="0"
              max={paycheck}
              value={editableAllocations[target][cat as keyof typeof editableAllocations[typeof target]]}
            onChange={(e) => handleEditChange(cat, Number(e.target.value))}
            className="w-full"
          />
        </div>
      ))}
      {(editableAllocations[target].fixed < fixed) && (
        <div className="text-xs text-red-600">⚠️ Fixed budget is below your recommended amount (${fixed}).</div>
      )}
      </div>
    );
  };

  const buildSections = (spent: number, label: string, savingsBudget: number, variableBudget: number, isLocked = false, editable: { fixed: number; savings: number; variable: number } | null = null, hidden = false) => {
    if (hidden) {
      return (
        <div className="text-center h-64 w-16 mx-auto opacity-0 pointer-events-none">
          <div className="h-64 w-16"></div>
          <div className="text-xs mt-1">{label}</div>
          <div style={{ height: 24 }}></div>
        </div>
      );
    }
    const effectiveFixed = editable ? editable.fixed : fixed;
    const effectiveSavings = editable ? editable.savings : savingsBudget;
    const effectiveVariable = editable ? editable.variable : variableBudget;

    const variableUsed = Math.min(spent, effectiveVariable);
    const variableRemaining = Math.max(effectiveVariable - variableUsed, 0);
    const savingsConsumed = Math.max(spent - effectiveVariable, 0);
    const savingsUsed = Math.min(savingsConsumed, effectiveSavings);
    const savingsRemaining = Math.max(effectiveSavings - savingsUsed, 0);
    const emergencyConsumed = Math.max(spent - (effectiveVariable + effectiveSavings), 0);
    const total = effectiveFixed + effectiveSavings + effectiveVariable;

    const percent = (value: number) => total > 0 ? ((value / total) * 100).toFixed(1) : 0;

    // Always render two lines for the top label (variable used)
    const topLabel1 = variableUsed > 0 ? `-$${variableUsed} (${percent(variableUsed)}%)` : '';
    const topLabel2 = variableUsed < 0 ? `-$${Math.abs(variableUsed)} (${percent(Math.abs(variableUsed))}%)` : '';
    // Always render two lines for the savings label
    const savingsLabel1 = savingsUsed > 0 ? `-$${savingsUsed} (${percent(savingsUsed)}%)` : '';
    const savingsLabel2 = savingsUsed < 0 ? `-$${Math.abs(savingsUsed)} (${percent(Math.abs(savingsUsed))}%)` : '';

    return (
      <div className="text-center">
        <div className="h-64 w-16 relative border border-gray-300 rounded overflow-hidden mx-auto flex flex-col justify-end">
          <div className="absolute w-full bg-blue-200 flex flex-col items-center" style={{ top: 0, height: `${percent(variableUsed)}%` }}>
            <span className="text-[10px] text-blue-800" style={{ minHeight: 14 }}>{topLabel1 || <span className="invisible">0</span>}</span>
            <span className="text-[10px] text-blue-800" style={{ minHeight: 14 }}>{topLabel2 || <span className="invisible">0</span>}</span>
          </div>
          <div className="absolute w-full bg-blue-500 text-[10px] text-white flex items-center justify-center" style={{ top: `${percent(variableUsed)}%`, height: `${percent(variableRemaining)}%` }}>
            <span className="w-full text-center">${variableRemaining} ({percent(variableRemaining)}%)</span>
          </div>
          <div className="absolute w-full bg-green-200 flex flex-col items-center" style={{ top: `${percent(effectiveVariable)}%`, height: `${percent(savingsUsed)}%` }}>
            <span className="text-[10px] text-green-800" style={{ minHeight: 14 }}>{savingsLabel1 || <span className="invisible">0</span>}</span>
            <span className="text-[10px] text-green-800" style={{ minHeight: 14 }}>{savingsLabel2 || <span className="invisible">0</span>}</span>
          </div>
          <div className="absolute w-full bg-green-500 text-[10px] text-white flex items-center justify-center" style={{ top: `${percent(effectiveVariable + savingsUsed)}%`, height: `${percent(savingsRemaining)}%` }}>
            <span className="w-full text-center">${savingsRemaining} ({percent(savingsRemaining)}%)</span>
          </div>
          <div className="absolute bottom-0 w-full bg-orange-500 flex items-center justify-center text-[10px] text-white" style={{ height: `${percent(effectiveFixed)}%` }}>
            <span className="w-full text-center">${effectiveFixed} ({percent(effectiveFixed)}%)</span>
          </div>
        </div>
        <div className="text-xs mt-1">{label}</div>
        {/* Always render an Edit button or invisible placeholder for alignment */}
        {isLocked
          ? <div style={{ height: 24 }}></div>
          : <button
              onClick={() => setEditModeTarget(label)}
              className="mt-1 text-blue-500 underline text-xs"
              style={label === "Previous" ? { visibility: 'hidden' } : {}}
            >
              Edit
            </button>
        }
      </div>
    );
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-lg font-bold mb-4 text-center">Paycheck Analyzer</h2>

      <div className={`grid ${isThreePaycheckMonth ? 'grid-cols-4' : 'grid-cols-3'} gap-4 mb-4 items-end w-[340px] mx-auto`}>
        {buildSections(0, "Previous", 334, 693, true)}
        {buildSections(variableSpentCurrent, "Current", currentAlloc.savings, currentAlloc.variable, false, currentAlloc)}
        {buildSections(0, "Next", nextAlloc.savings, nextAlloc.variable, false, nextAlloc)}
        {isThreePaycheckMonth && buildSections(0, "Bonus", bonusAlloc.savings, bonusAlloc.variable, false, bonusAlloc)}
      </div>

      <div className="text-sm text-center mb-4">{status}</div>

      <div className="h-3 w-full bg-red-100 rounded overflow-hidden mb-2">
        <div
          className="h-3 bg-red-500"
          style={{ width: `${(emergencyConsumed / emergencyFund) * 100}%` }}
        ></div>
      </div>
      <div className="text-xs text-right mb-4">Emergency Used: ${emergencyConsumed}</div>

      <div className="mb-4">
        <label htmlFor="variableSlider" className="block mb-2 text-sm font-medium">
          Variable Expenses Incurred: ${variableSpentCurrent.toFixed(0)}
        </label>
        <input
          id="variableSlider"
          type="range"
          min="0"
          max={paycheck}
          value={variableSpentCurrent}
          onChange={(e) => handleVariableChange(Number(e.target.value))}
          className="w-full"
        />
      </div>

      {editModeTarget && (
        <>
          <h3 className="text-sm font-medium mb-2 text-center">Edit {editModeTarget} Paycheck Allocations</h3>
          {renderEditSliders()}
          <button
            onClick={() => setEditModeTarget(null)}
            className="bg-gray-500 text-white px-4 py-2 rounded mb-4"
          >
            Close Edit Mode
          </button>
        </>
      )}

      <div className="text-xs flex justify-around mt-6">
        <div><span className="inline-block w-3 h-3 bg-orange-400 mr-1"></span>Fixed</div>
        <div><span className="inline-block w-3 h-3 bg-green-500 mr-1"></span>Savings</div>
        <div><span className="inline-block w-3 h-3 bg-blue-500 mr-1"></span>Variable</div>
      </div>

      <div className="mt-6 text-center">
        <label className="text-sm font-medium mr-2">3-Paycheck Month?</label>
        <input
          type="checkbox"
          checked={isThreePaycheckMonth}
          onChange={(e) => setIsThreePaycheckMonth(e.target.checked)}
        />
        {isThreePaycheckMonth && (
          <div className="mt-2 text-xs text-green-600">🎉 You've got a 3rd paycheck this month — consider allocating it entirely to savings, debt, or investment goals.</div>
        )}
      </div>
    </div>
  );
}