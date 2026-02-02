/**
 * Configurable Tool Component
 * 
 * A reusable, configurable component for financial planning tools.
 * Handles sliders, charts, comparisons, and apply logic.
 */

'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { usePlanData } from '@/lib/onboarding/usePlanData';
import { buildFinalPlanData, type FinalPlanData } from '@/lib/onboarding/plan';
import type { OnboardingState } from '@/lib/onboarding/types';
import type { ToolConfig, ToolSlider } from '@/lib/tools/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { NetWorthChart } from '@/components/charts/NetWorthChart';
import { X, ArrowRight } from 'lucide-react';

interface ConfigurableToolProps {
  config: ToolConfig;
  onSliderValuesChange?: (sliderValues: Record<string, number>) => void;
  incomeDistribution?: {
    needsPct: number;
    wantsPct: number;
    savingsPct: number;
  } | null;
  baselineIncomeDistribution?: {
    needsPct: number;
    wantsPct: number;
    savingsPct: number;
  } | null;
}

export function ConfigurableTool({ config, onSliderValuesChange, incomeDistribution, baselineIncomeDistribution }: ConfigurableToolProps) {
  const router = useRouter();
  const baselineState = useOnboardingStore();
  const baselinePlanData = usePlanData();
  
  // Initialize slider values from config
  const [sliderValues, setSliderValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    config.sliders.forEach(slider => {
      initial[slider.id] = slider.defaultValue;
    });
    return initial;
  });
  
  const [originalSliderValues, setOriginalSliderValues] = useState<Record<string, number>>({ ...sliderValues });
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Initialize original values when baseline data loads
  useEffect(() => {
    if (baselinePlanData && config.sliders && config.sliders.length > 0) {
      const initial: Record<string, number> = {};
      config.sliders.forEach(slider => {
        initial[slider.id] = slider.defaultValue;
      });
      setSliderValues(initial);
      setOriginalSliderValues(initial);
      // Notify parent of initial slider values
      if (onSliderValuesChange) {
        onSliderValuesChange(initial);
      }
    }
  }, [baselinePlanData, config.sliders, onSliderValuesChange]);

  // Notify parent when slider values change (for dynamic chart updates)
  useEffect(() => {
    if (onSliderValuesChange && Object.keys(sliderValues).length > 0) {
      onSliderValuesChange(sliderValues);
    }
  }, [sliderValues, onSliderValuesChange]);

  // Calculate scenario state based on slider values
  const scenarioState = useMemo((): OnboardingState => {
    try {
      if (!config?.calculateScenarioState) {
        return baselineState;
      }
      return config.calculateScenarioState({
        baselineState,
        sliderValues,
      });
    } catch (error) {
      console.error('[ConfigurableTool] Error calculating scenario state:', error);
      return baselineState;
    }
  }, [baselineState, sliderValues, config]);

  // Calculate scenario plan data
  const scenarioPlanData = useMemo((): FinalPlanData | null => {
    if (!baselinePlanData || !config) return null;
    try {
      // Check if config has required sliders before building
      if (!config.sliders || config.sliders.length === 0) {
        return null;
      }
      return buildFinalPlanData(scenarioState);
    } catch (error) {
      console.error('[ConfigurableTool] Error calculating scenario plan:', error);
      return null;
    }
  }, [scenarioState, baselinePlanData, config]);

  // Handle slider value change - make sliders independent (no auto-adjusting other sliders)
  const handleSliderChange = (sliderId: string, value: number) => {
    const slider = config.sliders.find(s => s.id === sliderId);
    if (!slider) return;

    // Simply constrain the value to min/max and update - no auto-adjusting other sliders
    const constrained = Math.max(slider.min, Math.min(slider.max, value));
    let newValues = { ...sliderValues, [sliderId]: constrained };

    // Only apply constraints if explicitly defined via constrainWith (for backward compatibility)
    if (slider.constrainWith && slider.constrainWith.length > 0) {
      // Original constraint logic for backward compatibility
      const otherSliders = slider.constrainWith.map(id => config.sliders.find(s => s.id === id)).filter(Boolean) as ToolSlider[];
      const currentSum = constrained + otherSliders.reduce((sum, s) => sum + (newValues[s.id] || s.defaultValue), 0);
      const targetSum = slider.constraintType === 'sum' ? 100 : undefined;
      
      if (targetSum && currentSum > targetSum) {
        const remaining = targetSum - constrained;
        const otherSum = otherSliders.reduce((sum, s) => sum + (newValues[s.id] || s.defaultValue), 0);
        
        if (otherSum > 0) {
          otherSliders.forEach(otherSlider => {
            const ratio = (newValues[otherSlider.id] || otherSlider.defaultValue) / otherSum;
            newValues[otherSlider.id] = Math.max(otherSlider.min, Math.min(otherSlider.max, remaining * ratio));
          });
        }
      }
    }

    setSliderValues(newValues);
    // Note: Parent will be notified via useEffect below when sliderValues state updates
  };

  // Check if any values have changed
  const hasChanged = useMemo(() => {
    return config.sliders.some(slider => {
      const current = sliderValues[slider.id] || slider.defaultValue;
      const original = originalSliderValues[slider.id] || slider.defaultValue;
      return Math.abs(current - original) > 0.1;
    });
  }, [sliderValues, originalSliderValues, config.sliders]);

  // Handle apply button click
  const handleApply = (e?: React.MouseEvent) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setShowConfirmDialog(true);
  };

  // Handle confirm apply
  const handleConfirmApply = async (e?: React.MouseEvent) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setIsProcessing(true);
    try {
      // Apply changes to store (this updates the source of truth)
      await config.onApply({
        sliderValues,
        scenarioState,
        baselineState,
      });
      
      // Wait a brief moment to ensure store updates have propagated
      // This ensures Zustand subscribers (like usePlanData) have time to react
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setShowConfirmDialog(false);
      
      // Navigate to home after applying changes so user can see updated plan
      // Use push instead of back to ensure the page reloads and shows updated data
      // The usePlanData hook will automatically recalculate when riskConstraints changes
      try {
        router.push('/app/home');
        // Force a small delay to ensure navigation completes and new page renders
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (navError) {
        console.error('[ConfigurableTool] Error navigating:', navError);
        // Fallback: try router.back() if push fails
        try {
          if (config.onBack) {
            config.onBack();
          } else {
            router.back();
          }
        } catch (backError) {
          console.error('[ConfigurableTool] Error with fallback navigation:', backError);
        }
      }
    } catch (error) {
      console.error('[ConfigurableTool] Error applying changes:', error);
      setIsProcessing(false);
      // Don't re-throw - just log and reset state
      // If it's an event object or non-Error, convert to proper error message
      if (error && typeof error === 'object' && !(error instanceof Error)) {
        const errorMessage = 'toString' in error ? String(error) : 'An error occurred while applying changes';
        console.error('[ConfigurableTool] Non-Error object caught:', errorMessage, error);
      }
      // Keep dialog open so user can try again
    }
  };

  // Format value for display
  const formatSliderValue = (slider: ToolSlider, value: number): string => {
    if (slider.formatDisplay) {
      return slider.formatDisplay(value);
    }
    if (slider.formatValue) {
      return slider.formatValue(value);
    }
    if (slider.unit === '%') {
      return `${value.toFixed(1)}%`;
    }
    if (slider.unit === '$') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }
    return value.toFixed(slider.step < 1 ? 1 : 0);
  };

  if (!baselinePlanData) {
    return (
      <div className="flex min-h-[calc(100vh-73px)] items-center justify-center p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-600 dark:text-slate-400">
              Loading tool...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Only block rendering if chart is enabled AND scenarioPlanData is required but missing
  // But allow rendering if there are sliders (user might just be adjusting, chart will show loading)
  if (config.chart.type !== 'none' && !scenarioPlanData && config.sliders.length > 0) {
    // Show loading state instead of blocking
    console.warn('[ConfigurableTool] Unable to calculate scenario plan data');
  }

  // If no sliders, show chart if enabled (for configure-your-own, chart shows by default)
  if (!config.sliders || config.sliders.length === 0) {
    // Show chart if enabled, even without sliders
    if (config.chart.type === 'net_worth' && baselinePlanData) {
      return (
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto w-full max-w-lg space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold">{config.title}</h1>
                {config.description && (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {config.description}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={config.onBack || (() => router.back())}
                className="h-8 w-8"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Custom Header Content */}
            {config.headerContent}

            {/* Show chart - baseline (current plan) by default */}
            {config.chart.type === 'net_worth' && baselinePlanData && (
              <Card>
                <CardHeader>
                  {config.chart.title && <CardTitle>{config.chart.title}</CardTitle>}
                  {config.chart.description && (
                    <CardDescription>{config.chart.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-lg border bg-white p-4 dark:bg-slate-800">
                    <div className="min-w-0">
                      <NetWorthChart
                        labels={baselinePlanData.netWorthChartData?.labels || []}
                        netWorth={baselinePlanData.netWorthChartData?.netWorth || []}
                        assets={baselinePlanData.netWorthChartData?.assets || []}
                        liabilities={baselinePlanData.netWorthChartData?.liabilities || []}
                        height={400}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      );
    }
    
    // If no chart and no sliders, show minimal UI (for non-configure-your-own tools)
    return (
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-lg space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">{config.title}</h1>
              {config.description && (
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {config.description}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={config.onBack || (() => router.back())}
              className="h-8 w-8"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-lg space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">{config.title}</h1>
              {config.description && (
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {config.description}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={config.onBack || (() => router.back())}
              className="h-8 w-8"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Custom Header Content */}
          {config.headerContent}

          {/* Sliders */}
          {config.sliders.map((slider) => {
            const currentValue = sliderValues[slider.id] || slider.defaultValue;
            const originalValue = originalSliderValues[slider.id] || slider.defaultValue;
            const hasChanged = Math.abs(currentValue - originalValue) > 0.1;
            
            return (
              <Card key={slider.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{slider.label}</CardTitle>
                  {slider.description && (
                    <CardDescription>{slider.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {slider.unit ? `Value (${slider.unit})` : 'Value'}
                      </span>
                      <span className="text-sm font-semibold">
                        {formatSliderValue(slider, currentValue)}
                      </span>
                    </div>
                    {/* Slider with baseline marker */}
                    <div className="relative w-full py-2">
                      <Slider
                        value={[currentValue]}
                        onValueChange={([value]) => handleSliderChange(slider.id, value)}
                        min={slider.min}
                        max={slider.max}
                        step={slider.step}
                        className="w-full"
                      />
                      {/* Baseline marker (dash line) showing original value */}
                      {hasChanged && (
                        <div
                          className="absolute top-1/2 -translate-y-1/2 h-6 w-0 border-l-2 border-dashed border-slate-400 dark:border-slate-500 pointer-events-none z-10"
                          style={{
                            left: `${((originalValue - slider.min) / (slider.max - slider.min)) * 100}%`,
                            marginLeft: '-1px', // Center the 2px border
                          }}
                          title={`Original: ${formatSliderValue(slider, originalValue)}`}
                        />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Total Allocation Summary - Show after sliders for alignment */}
          {config.sliders.some(s => s.group) && (() => {
            // Use income distribution values from parent (same as bar chart) - SINGLE SOURCE OF TRUTH
            if (!incomeDistribution) {
              return null;
            }
            
            const needsSimulated = incomeDistribution.needsPct;
            const wantsSimulated = incomeDistribution.wantsPct;
            const savingsSimulated = incomeDistribution.savingsPct;
            const totalSum = needsSimulated + wantsSimulated + savingsSimulated;
            
            // Get baseline values (current plan) if available
            const needsCurrent = baselineIncomeDistribution?.needsPct ?? needsSimulated;
            const wantsCurrent = baselineIncomeDistribution?.wantsPct ?? wantsSimulated;
            const savingsCurrent = baselineIncomeDistribution?.savingsPct ?? savingsSimulated;
            const totalCurrent = needsCurrent + wantsCurrent + savingsCurrent;
            
            return (
              <Card className={totalSum > 100.01 ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950' : ''}>
                <CardHeader>
                  <CardTitle className="text-lg">Total Allocation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Table header */}
                    <div className="grid grid-cols-3 gap-4 text-xs font-medium text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 pb-2">
                      <div>Category</div>
                      <div className="text-right">Current Plan</div>
                      <div className="text-right">Simulated Plan</div>
                    </div>
                    
                    {/* Needs row */}
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <span className="text-sm text-slate-700 dark:text-slate-300">Needs</span>
                      <span className="text-sm text-right text-slate-600 dark:text-slate-400">{needsCurrent.toFixed(1)}%</span>
                      <span className="text-sm text-right font-semibold text-slate-900 dark:text-white">
                        {needsSimulated.toFixed(1)}%
                        {Math.abs(needsSimulated - needsCurrent) > 0.1 && (
                          <span className={`ml-1 text-xs ${needsSimulated > needsCurrent ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            ({needsSimulated > needsCurrent ? '+' : ''}{(needsSimulated - needsCurrent).toFixed(1)}%)
                          </span>
                        )}
                      </span>
                    </div>
                    
                    {/* Wants row */}
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <span className="text-sm text-slate-700 dark:text-slate-300">Wants</span>
                      <span className="text-sm text-right text-slate-600 dark:text-slate-400">{wantsCurrent.toFixed(1)}%</span>
                      <span className="text-sm text-right font-semibold text-slate-900 dark:text-white">
                        {wantsSimulated.toFixed(1)}%
                        {Math.abs(wantsSimulated - wantsCurrent) > 0.1 && (
                          <span className={`ml-1 text-xs ${wantsSimulated > wantsCurrent ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            ({wantsSimulated > wantsCurrent ? '+' : ''}{(wantsSimulated - wantsCurrent).toFixed(1)}%)
                          </span>
                        )}
                      </span>
                    </div>
                    
                    {/* Savings row */}
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <span className="text-sm text-slate-700 dark:text-slate-300">Savings</span>
                      <span className="text-sm text-right text-slate-600 dark:text-slate-400">{savingsCurrent.toFixed(1)}%</span>
                      <span className="text-sm text-right font-semibold text-slate-900 dark:text-white">
                        {savingsSimulated.toFixed(1)}%
                        {Math.abs(savingsSimulated - savingsCurrent) > 0.1 && (
                          <span className={`ml-1 text-xs ${savingsSimulated > savingsCurrent ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            ({savingsSimulated > savingsCurrent ? '+' : ''}{(savingsSimulated - savingsCurrent).toFixed(1)}%)
                          </span>
                        )}
                      </span>
                    </div>
                    
                    {/* Total row */}
                    <div className="grid grid-cols-3 gap-4 items-center border-t border-slate-200 dark:border-slate-700 pt-2">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Total</span>
                      <span className="text-sm text-right font-medium text-slate-700 dark:text-slate-300">{totalCurrent.toFixed(1)}%</span>
                      <span className={`text-sm text-right font-semibold ${totalSum > 100.01 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                        {totalSum.toFixed(1)}%
                      </span>
                    </div>
                    
                    {totalSum > 100.01 && (
                      <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                        Total exceeds 100%. Adjust sliders to fit within your take-home pay.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Chart Visualization */}
          {config.chart.type !== 'none' && (
            <Card>
              <CardHeader>
                {config.chart.title && <CardTitle>{config.chart.title}</CardTitle>}
                {config.chart.description && (
                  <CardDescription>{config.chart.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {config.chart.type === 'net_worth' && baselinePlanData && (
                  <div className="overflow-x-auto rounded-lg border bg-white p-4 dark:bg-slate-800">
                    <div className="min-w-0">
                      <NetWorthChart
                        key={`configurable-${hasChanged ? 'changed' : 'baseline'}-${Object.values(sliderValues).join('-')}`}
                        // Labels from baseline plan
                        labels={baselinePlanData.netWorthChartData?.labels || []}
                        // When sliders have changed: show simulated plan as main curve, baseline as comparison
                        // When no changes: show baseline as main curve only (no comparison needed)
                        netWorth={
                          hasChanged && scenarioPlanData
                            ? scenarioPlanData.netWorthChartData?.netWorth || []
                            : baselinePlanData.netWorthChartData?.netWorth || []
                        }
                        assets={
                          hasChanged && scenarioPlanData
                            ? scenarioPlanData.netWorthChartData?.assets || []
                            : baselinePlanData.netWorthChartData?.assets || []
                        }
                        liabilities={
                          hasChanged && scenarioPlanData
                            ? scenarioPlanData.netWorthChartData?.liabilities || []
                            : baselinePlanData.netWorthChartData?.liabilities || []
                        }
                        // Always pass baseline for comparison (only shows as comparison line when hasChanged is true)
                        baselineNetWorth={
                          hasChanged 
                            ? baselinePlanData.netWorthChartData?.netWorth || [] 
                            : undefined
                        }
                        height={400}
                      />
                    </div>
                  </div>
                )}
                {config.chart.type === 'custom' && config.chart.customRender && (
                  config.chart.customRender({
                    baselinePlanData,
                    scenarioPlanData,
                    sliderValues,
                  })
                )}
              </CardContent>
            </Card>
          )}

          {/* Key Milestones */}
          {scenarioPlanData?.netWorthProjection && baselinePlanData?.netWorthProjection && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Key Milestones</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {scenarioPlanData.netWorthProjection.map((projection) => {
                    const baselineValue = baselinePlanData.netWorthProjection?.find(p => p.label === projection.label)?.value || 0;
                    const scenarioValue = projection.value;
                    const delta = scenarioValue - baselineValue;
                    const showDelta = Math.abs(delta) > 1;
                    
                    return (
                      <div key={projection.label} className="text-center">
                        <p className="text-xs text-slate-600 dark:text-slate-400">{projection.label}</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                          ${(scenarioValue / 1000).toFixed(0)}K
                        </p>
                        {showDelta && (
                          <p className={`mt-0.5 text-xs font-medium ${delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {delta >= 0 ? '+' : ''}${(delta / 1000).toFixed(0)}K
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Custom Sections */}
          {config.customSections?.map((section) => (
            <Card key={section.id}>
              <CardHeader>
                <CardTitle className="text-lg">{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                {section.render({
                  sliderValues,
                  baselinePlanData,
                  scenarioPlanData,
                  scenarioState,
                  baselineState,
                })}
              </CardContent>
            </Card>
          ))}

          {/* Comparison Metrics - Calculate dynamically if using function */}
          {config.comparisonMetrics && (() => {
            // Allow comparisonMetrics to be a function for dynamic calculation
            const metrics = typeof config.comparisonMetrics === 'function'
              ? config.comparisonMetrics({
                  baselinePlanData,
                  scenarioPlanData,
                  sliderValues,
                  baselineState,
                  scenarioState,
                })
              : config.comparisonMetrics;

            if (!metrics || metrics.length === 0) return null;

            return (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Impact Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {metrics.map((metric, idx) => {
                      const delta = metric.scenarioValue - metric.baselineValue;
                      const deltaStr = metric.deltaFormat 
                        ? metric.deltaFormat(delta)
                        : delta >= 0 ? `+${delta.toLocaleString()}` : delta.toLocaleString();
                      const baselineStr = metric.formatValue 
                        ? metric.formatValue(metric.baselineValue)
                        : metric.baselineValue.toLocaleString();
                      const scenarioStr = metric.formatValue
                        ? metric.formatValue(metric.scenarioValue)
                        : metric.scenarioValue.toLocaleString();

                      return (
                        <div key={idx} className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800 last:border-b-0 last:pb-0">
                          <div className="flex-1">
                            <p className="font-medium text-slate-900 dark:text-white">{metric.label}</p>
                            <div className="mt-1 flex items-center gap-2 text-sm">
                              <span className="text-slate-600 dark:text-slate-400">
                                Baseline: {baselineStr}
                              </span>
                              <ArrowRight className="h-3 w-3 text-slate-400" />
                              <span className="font-medium text-slate-900 dark:text-white">
                                {scenarioStr}
                              </span>
                            </div>
                          </div>
                          <div className={`text-right font-semibold ${delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {deltaStr}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Apply Button */}
          <div className="sticky bottom-0 bg-background pt-4">
            <Button
              onClick={handleApply}
              size="lg"
              className="w-full"
              disabled={!hasChanged || isProcessing}
            >
              {isProcessing ? 'Applying...' : hasChanged ? 'Apply Changes' : 'No Changes'}
            </Button>
          </div>

          {/* Custom Footer Content */}
          {config.footerContent}
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Confirm Changes</CardTitle>
              <CardDescription>
                Apply these changes to your financial plan?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Show what's changing */}
              <div className="space-y-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                {config.sliders.map((slider) => {
                  const current = sliderValues[slider.id] || slider.defaultValue;
                  const original = originalSliderValues[slider.id] || slider.defaultValue;
                  const changed = Math.abs(current - original) > 0.1;
                  
                  if (!changed) return null;
                  
                  return (
                    <div key={slider.id} className="text-sm">
                      <span className="font-medium">{slider.label}:</span>{' '}
                      <span className="text-slate-600 dark:text-slate-400">
                        {formatSliderValue(slider, original)}
                      </span>
                      {' → '}
                      <span className="font-medium text-slate-900 dark:text-white">
                        {formatSliderValue(slider, current)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowConfirmDialog(false)}
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleConfirmApply}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Applying...' : 'Confirm & Apply'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

