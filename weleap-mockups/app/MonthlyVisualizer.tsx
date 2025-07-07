"use client";
import React, { useState, useEffect } from 'react';

export default function MonthlyVisualizer() {
  const target = {
    income: 5784,
    fixed: 3558,
    variable: 1069,
    savings: 1157,
  };

  const [actualFixed, setActualFixed] = useState(3200);
  const [actualVariable, setActualVariable] = useState(1300);
  const [actualSavings, setActualSavings] = useState(900);
  const [paycheckCount, setPaycheckCount] = useState(2);
  const [paychecksReceived, setPaychecksReceived] = useState(2);
  const [emergencyFundUsed, setEmergencyFundUsed] = useState(0);

  const targetAnnualIncome = target.income * 12;
  const actualMonthlyIncome = (targetAnnualIncome / 26) * paycheckCount;
  const actualTotal = actualFixed + actualVariable + actualSavings;
  const totalBarHeight = 256;

  // Scaling factor for comparisons
  const scaling = paychecksReceived / paycheckCount;
  const scaledTarget = {
    fixed: target.fixed * scaling,
    variable: target.variable * scaling,
    savings: target.savings * scaling,
  };

  const actualIncomeToDate = (targetAnnualIncome / 26) * paychecksReceived;

  useEffect(() => {
    const overspend = actualTotal - actualMonthlyIncome;
    setEmergencyFundUsed(overspend > 0 ? overspend : 0);
  }, [actualFixed, actualVariable, actualSavings, actualMonthlyIncome]);

  useEffect(() => {
    if (paycheckCount === 3) {
      const extra = targetAnnualIncome / 26;
      setActualSavings(target.savings + extra);
    } else {
      setActualSavings(target.savings);
    }
  }, [paycheckCount]);

  const getHeight = (amount: number, total: number) => `${(amount / total) * totalBarHeight}px`;
  const getLabelStyle = (amount: number, total: number) => ({
    height: getHeight(amount, total),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    color: 'white'
  });

  let status = "✅ You're on track this month!";
  const fixedShort = actualFixed < scaledTarget.fixed ? (scaledTarget.fixed - actualFixed).toFixed(0) : null;
  if (actualVariable > scaledTarget.variable && actualSavings < scaledTarget.savings && fixedShort) {
    const overspent = (actualVariable - scaledTarget.variable).toFixed(0);
    const undersaved = (scaledTarget.savings - actualSavings).toFixed(0);
    status = `⚠️ You overspent on variable expenses by $${overspent}, saved $${undersaved} less than planned, and have $${fixedShort} less than needed for fixed expenses (to date).`;
  } else if (actualVariable > scaledTarget.variable && actualSavings < scaledTarget.savings) {
    const overspent = (actualVariable - scaledTarget.variable).toFixed(0);
    const undersaved = (scaledTarget.savings - actualSavings).toFixed(0);
    status = `⚠️ You overspent on variable expenses by $${overspent} and saved $${undersaved} less than planned (to date).`;
  } else if (actualSavings < scaledTarget.savings && fixedShort) {
    status = `⚠️ You saved $${(scaledTarget.savings - actualSavings).toFixed(0)} less than planned and have $${fixedShort} less than needed for fixed expenses (to date).`;
  } else if (actualVariable > scaledTarget.variable && fixedShort) {
    status = `⚠️ You overspent on variable expenses by $${(actualVariable - scaledTarget.variable).toFixed(0)} and have $${fixedShort} less than needed for fixed expenses (to date).`;
  } else if (fixedShort) {
    status = `⚠️ You have $${fixedShort} less than needed for fixed expenses (to date).`;
  } else if (actualSavings < scaledTarget.savings) {
    status = `⚠️ You saved $${(scaledTarget.savings - actualSavings).toFixed(0)} less than planned (to date).`;
  } else if (actualVariable > scaledTarget.variable) {
    status = `⚠️ You overspent on variable expenses by $${(actualVariable - scaledTarget.variable).toFixed(0)} (to date).`;
  }

  const savingsProgress = Math.min((actualSavings / target.savings) * 100, 100);
  const emergencyFundRemaining = 3000 - emergencyFundUsed;

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-lg font-bold mb-4">Monthly Plan vs Actual</h2>

      {paycheckCount === 3 ? (
        <div className="bg-blue-100 text-blue-800 px-3 py-2 rounded text-sm mb-4 text-center">
          This is a <strong>3-paycheck month 🎉</strong> — consider allocating the 3rd to savings or debt!
        </div>
      ) : (
        <div className="bg-yellow-50 text-yellow-700 px-3 py-2 rounded text-sm mb-4 text-center">
          This is a <strong>2-paycheck month</strong> — spending below your monthly plan is expected. Monthly plan is based on average income.
        </div>
      )}

      <div className="flex gap-8 justify-center">
        <div className="text-center">
          <h3 className="text-sm font-semibold mb-2">Target (Avg Month)</h3>
          <div className="h-64 w-20 relative border border-gray-300 rounded overflow-hidden">
            <div className="absolute bottom-0 w-full bg-orange-400" style={getLabelStyle(target.fixed, target.income)}>
              ${target.fixed}
            </div>
            <div
              className="absolute w-full"
              style={{
                ...getLabelStyle(target.savings, target.income),
                bottom: getHeight(target.fixed, target.income),
                backgroundColor: '#22c55e'
              }}
            >
              ${target.savings}
            </div>
            <div
              className="absolute w-full"
              style={{
                ...getLabelStyle(target.variable, target.income),
                bottom: getHeight(target.fixed + target.savings, target.income),
                backgroundColor: '#3b82f6'
              }}
            >
              ${target.variable}
            </div>
          </div>
          <div className="text-xs mt-2">${target.income.toLocaleString()}</div>
        </div>

        <div className="text-center">
          <h3 className="text-sm font-semibold mb-2">Actual</h3>
          <div className="h-64 w-20 relative border border-gray-300 rounded overflow-hidden">
            <div className="absolute bottom-0 w-full bg-orange-300" style={getLabelStyle(actualFixed, actualMonthlyIncome)}>
              ${actualFixed.toLocaleString()}
            </div>
            <div
              className="absolute w-full"
              style={{
                ...getLabelStyle(actualSavings, actualMonthlyIncome),
                bottom: getHeight(actualFixed, actualMonthlyIncome),
                backgroundColor: '#bbf7d0',
                color: '#000',
                fontWeight: '500'
              }}
            >
              ${actualSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div
              className="absolute w-full"
              style={{
                ...getLabelStyle(actualVariable, actualMonthlyIncome),
                bottom: getHeight(actualFixed + actualSavings, actualMonthlyIncome),
                backgroundColor: '#93c5fd'
              }}
            >
              ${actualVariable.toLocaleString()}
            </div>
          </div>
          <div className="text-xs mt-2">${actualTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
      </div>

      <div className="mt-4 text-sm text-center font-medium">{status}</div>

      <div className="mt-6 text-xs flex justify-center gap-6">
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-orange-400"></span> Fixed
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-green-500"></span> Savings
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-blue-500"></span> Variable
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Savings Goal Progress</label>
          <div className="w-full bg-gray-200 h-3 rounded">
            <div
              className="h-3 rounded bg-green-500"
              style={{ width: `${savingsProgress}%` }}
            ></div>
          </div>
          <div className="text-xs mt-1 text-right">{savingsProgress.toFixed(0)}%</div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Emergency Fund Used</label>
          <div className="w-full bg-gray-200 h-3 rounded">
            <div
              className="h-3 rounded bg-red-500"
              style={{ width: `${(emergencyFundUsed / 3000) * 100}%` }}
            ></div>
          </div>
          <div className="text-xs mt-1 text-right">
            ${emergencyFundUsed.toLocaleString(undefined, { maximumFractionDigits: 0 })} / $3000 used
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Fixed Expenses: ${actualFixed.toLocaleString()}</label>
          <input
            type="range"
            min="0"
            max="5784"
            value={actualFixed}
            onChange={(e) => setActualFixed(Number(e.target.value))}
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Variable Expenses: ${actualVariable.toLocaleString()}</label>
          <input
            type="range"
            min="0"
            max="5784"
            value={actualVariable}
            onChange={(e) => setActualVariable(Number(e.target.value))}
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Savings: ${actualSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}</label>
          <input
            type="range"
            min="0"
            max="5784"
            value={actualSavings}
            onChange={(e) => setActualSavings(Number(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      <div className="flex justify-center gap-4 mb-4">
        <button
          className={`px-3 py-1 rounded border ${paycheckCount === 2 ? 'bg-yellow-300' : 'bg-white'}`}
          onClick={() => setPaycheckCount(2)}
        >
          2 Paychecks
        </button>
        <button
          className={`px-3 py-1 rounded border ${paycheckCount === 3 ? 'bg-blue-300' : 'bg-white'}`}
          onClick={() => setPaycheckCount(3)}
        >
          3 Paychecks
        </button>
        <div className="flex items-center ml-4">
          <span className="mr-2 text-sm">Paychecks Received:</span>
          <button
            className={`px-2 py-1 rounded border ${paychecksReceived === 1 ? 'bg-gray-200' : 'bg-white'}`}
            onClick={() => setPaychecksReceived(1)}
          >
            1
          </button>
          <button
            className={`ml-2 px-2 py-1 rounded border ${paychecksReceived === 2 ? 'bg-gray-200' : 'bg-white'}`}
            onClick={() => setPaychecksReceived(2)}
          >
            2
          </button>
        </div>
      </div>
    </div>
  );
} 