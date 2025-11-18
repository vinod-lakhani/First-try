/**
 * Net Worth Simulator Demo Page
 * 
 * Demonstrates the net worth simulator with Baseline and Variant scenarios.
 */

'use client';

import React, { useState, useMemo } from 'react';
import { simulateScenario, ScenarioInput } from '../../lib/sim/netWorth';
import { NetWorthChart } from '../../components/charts/NetWorthChart';
import { TimelineControls } from '../../components/controls/TimelineControls';

export default function NetWorthDemo() {
  const [visibleYears, setVisibleYears] = useState(40);
  const [showBaseline, setShowBaseline] = useState(true);
  const [showVariant, setShowVariant] = useState(true);
  
  // Baseline scenario
  const baselineInput: ScenarioInput = {
    startDate: '2026-01-01',
    horizonMonths: 480,
    openingBalances: {
      cash: 6000,
      brokerage: 5000,
      retirement: 15000,
      liabilities: [
        { name: 'Credit Card', balance: 2500, aprPct: 22, minPayment: 75 },
      ],
    },
    monthlyPlan: [
      {
        monthIndex: 0,
        incomeNet: 4000,
        needs$: 2000,
        wants$: 1000,
        ef$: 300,
        highAprDebt$: 150,
        match401k$: 100,
        retirementTaxAdv$: 250,
        brokerage$: 200,
      },
    ],
    goals: {
      efTarget$: 10000,
    },
  };
  
  // Variant scenario: Higher savings rate
  const variantInput: ScenarioInput = {
    ...baselineInput,
    monthlyPlan: [
      {
        monthIndex: 0,
        incomeNet: 4000,
        needs$: 1800, // Reduced needs
        wants$: 800,  // Reduced wants
        ef$: 400,     // More to EF
        highAprDebt$: 200, // More to debt
        match401k$: 100,
        retirementTaxAdv$: 400, // More to retirement
        brokerage$: 300, // More to brokerage
      },
    ],
  };
  
  const scenarios = useMemo(() => {
    const results: Array<{
      name: string;
      series: ReturnType<typeof simulateScenario>;
      color: string;
    }> = [];
    
    if (showBaseline) {
      const baselineSeries = simulateScenario(baselineInput);
      results.push({
        name: 'Baseline',
        series: baselineSeries,
        color: '#2563eb', // Blue
      });
    }
    
    if (showVariant) {
      const variantSeries = simulateScenario(variantInput);
      results.push({
        name: 'Variant (Higher Savings)',
        series: variantSeries,
        color: '#10b981', // Green
      });
    }
    
    return results;
  }, [showBaseline, showVariant]);
  
  const baselineKPIs = showBaseline ? scenarios.find(s => s.name === 'Baseline')?.series.kpis : null;
  const variantKPIs = showVariant ? scenarios.find(s => s.name === 'Variant')?.series.kpis : null;
  
  return (
    <div style={{ 
      maxWidth: '1400px', 
      margin: '0 auto', 
      padding: '24px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px' }}>
        Net Worth Simulator
      </h1>
      <p style={{ color: '#6b7280', marginBottom: '32px' }}>
        40-year projection based on Income & Savings Allocation engines
      </p>
      
      {/* Scenario Toggles */}
      <div style={{ 
        display: 'flex', 
        gap: '16px', 
        marginBottom: '24px',
        padding: '12px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showBaseline}
            onChange={(e) => setShowBaseline(e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <span style={{ fontWeight: '500' }}>Baseline</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showVariant}
            onChange={(e) => setShowVariant(e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <span style={{ fontWeight: '500' }}>Variant (Higher Savings)</span>
        </label>
      </div>
      
      {/* Timeline Controls */}
      <TimelineControls visibleYears={visibleYears} onChange={setVisibleYears} />
      
      {/* Chart */}
      <div style={{ 
        backgroundColor: 'white', 
        padding: '24px', 
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '32px',
      }}>
        <NetWorthChart 
          scenarios={scenarios} 
          visibleYears={visibleYears}
          showAssets={true}
          showLiabilities={true}
        />
      </div>
      
      {/* KPIs */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px',
        marginBottom: '32px',
      }}>
        {baselineKPIs && (
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            borderLeft: '4px solid #2563eb',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#2563eb' }}>
              Baseline KPIs
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {baselineKPIs.efReachedMonth !== undefined && (
                <div>
                  <span style={{ color: '#6b7280', fontSize: '14px' }}>EF Reached:</span>
                  <div style={{ fontSize: '20px', fontWeight: '600' }}>
                    Month {baselineKPIs.efReachedMonth + 1}
                  </div>
                </div>
              )}
              {baselineKPIs.debtFreeMonth !== undefined && (
                <div>
                  <span style={{ color: '#6b7280', fontSize: '14px' }}>Debt-Free:</span>
                  <div style={{ fontSize: '20px', fontWeight: '600' }}>
                    Month {baselineKPIs.debtFreeMonth + 1}
                  </div>
                </div>
              )}
              <div>
                <span style={{ color: '#6b7280', fontSize: '14px' }}>Net Worth at 10Y:</span>
                <div style={{ fontSize: '20px', fontWeight: '600' }}>
                  ${baselineKPIs.netWorthAtYears[10]?.toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }) || 'N/A'}
                </div>
              </div>
              {baselineKPIs.cagrNominal !== undefined && (
                <div>
                  <span style={{ color: '#6b7280', fontSize: '14px' }}>CAGR:</span>
                  <div style={{ fontSize: '20px', fontWeight: '600' }}>
                    {baselineKPIs.cagrNominal.toFixed(2)}%
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {variantKPIs && (
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            borderLeft: '4px solid #10b981',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#10b981' }}>
              Variant KPIs
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {variantKPIs.efReachedMonth !== undefined && (
                <div>
                  <span style={{ color: '#6b7280', fontSize: '14px' }}>EF Reached:</span>
                  <div style={{ fontSize: '20px', fontWeight: '600' }}>
                    Month {variantKPIs.efReachedMonth + 1}
                  </div>
                </div>
              )}
              {variantKPIs.debtFreeMonth !== undefined && (
                <div>
                  <span style={{ color: '#6b7280', fontSize: '14px' }}>Debt-Free:</span>
                  <div style={{ fontSize: '20px', fontWeight: '600' }}>
                    Month {variantKPIs.debtFreeMonth + 1}
                  </div>
                </div>
              )}
              <div>
                <span style={{ color: '#6b7280', fontSize: '14px' }}>Net Worth at 10Y:</span>
                <div style={{ fontSize: '20px', fontWeight: '600' }}>
                  ${variantKPIs.netWorthAtYears[10]?.toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }) || 'N/A'}
                </div>
              </div>
              {variantKPIs.cagrNominal !== undefined && (
                <div>
                  <span style={{ color: '#6b7280', fontSize: '14px' }}>CAGR:</span>
                  <div style={{ fontSize: '20px', fontWeight: '600' }}>
                    {variantKPIs.cagrNominal.toFixed(2)}%
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Warnings */}
      {scenarios.some(s => s.series.warnings.length > 0) && (
        <div style={{
          backgroundColor: '#fef3c7',
          padding: '16px',
          borderRadius: '8px',
          borderLeft: '4px solid #f59e0b',
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
            Warnings
          </h3>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#92400e' }}>
            {scenarios.flatMap(s => 
              s.series.warnings.map((w, i) => (
                <li key={`${s.name}-${i}`} style={{ marginBottom: '8px' }}>
                  <strong>{s.name}:</strong> {w}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

