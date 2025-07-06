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
  const [editModeTarget, setEditModeTarget] = useState(null);
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

  const handleVariableChange = (value) => {
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

  const handleEditChange = (category, value) => {
    const updated = { ...editableAllocations[editModeTarget], [category]: value };
    const total = updated.fixed + updated.savings + updated.variable;
    if (total <= paycheck) {
      setEditableAllocations((prev) => ({ ...prev, [editModeTarget]: updated }));
    }
  };

  const renderEditSliders = () => (
    <div className="space-y-2 mb-4">
      {['fixed', 'savings', 'variable'].map((cat) => (
        <div key={cat}>
          <label className="block text-sm font-medium capitalize">{cat} (${editableAllocations[editModeTarget][cat]})</label>
          <input
            type="range"
            min="0"
            max={paycheck}
            value={editableAllocations[editModeTarget][cat]}
            onChange={(e) => handleEditChange(cat, Number(e.target.value))}
            className="w-full"
          />
        </div>
      ))}
      {(editableAllocations[editModeTarget].fixed < fixed) && (
        <div className="text-xs text-red-600">⚠️ Fixed budget is below your recommended amount (${fixed}).</div>
      )}
    </div>
  );

  const buildSections = (spent, label, savingsBudget, variableBudget, isLocked = false, editable = null) => {
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

    const percent = (value) => total > 0 ? ((value / total) * 100).toFixed(1) : 0;

    return (
      <div className="text-center">
        <div className="h-64 w-16 relative border border-gray-300 rounded overflow-hidden mx-auto">
          <div className="absolute w-full bg-blue-200 text-[10px] text-blue-800 flex items-center justify-center" style={{ top: 0, height: `${percent(variableUsed)}%` }}>
            {variableUsed > 0 && (<span className="w-full text-center">-${variableUsed} ({percent(variableUsed)}%)</span>)}
          </div>
          <div className="absolute w-full bg-blue-500 text-[10px] text-white flex items-center justify-center" style={{ top: `${percent(variableUsed)}%`, height: `${percent(variableRemaining)}%` }}>
            <span className="w-full text-center">${variableRemaining} ({percent(variableRemaining)}%)</span>
          </div>
          <div className="absolute w-full bg-green-200 text-[10px] text-green-800 flex items-center justify-center" style={{ top: `${percent(effectiveVariable)}%`, height: `${percent(savingsUsed)}%` }}>
            {savingsUsed > 0 && (<span className="w-full text-center">-${savingsUsed} ({percent(savingsUsed)}%)</span>)}
          </div>
          <div className="absolute w-full bg-green-500 text-[10px] text-white flex items-center justify-center" style={{ top: `${percent(effectiveVariable + savingsUsed)}%`, height: `${percent(savingsRemaining)}%` }}>
            <span className="w-full text-center">${savingsRemaining} ({percent(savingsRemaining)}%)</span>
          </div>
          <div className="absolute bottom-0 w-full bg-orange-500 flex items-center justify-center text-[10px] text-white" style={{ height: `${percent(effectiveFixed)}%` }}>
            <span className="w-full text-center">${effectiveFixed} ({percent(effectiveFixed)}%)</span>
          </div>
        </div>
        <div className="text-xs mt-1">{label}</div>
        {!isLocked && (
          <button
            onClick={() => setEditModeTarget(label)}
            className="mt-1 text-blue-500 underline text-xs"
          >
            Edit
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-lg font-bold mb-4 text-center">Paycheck Analyzer</h2>

      <div className="flex justify-between mb-4">
        {buildSections(120, "Previous", initialSavings, initialVariable, true)}
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