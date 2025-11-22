/**
 * Configurable Tool Types
 * 
 * Types for a reusable, configurable financial planning tool component.
 */

import type { FinalPlanData } from '@/lib/onboarding/plan';
import type { OnboardingState } from '@/lib/onboarding/types';
import type { ReactNode } from 'react';

/**
 * Slider Configuration
 */
export interface ToolSlider {
  id: string;
  label: string;
  description?: string;
  unit?: '%' | '$' | 'months' | string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  formatValue?: (value: number) => string;
  formatDisplay?: (value: number) => string; // For the value display next to slider
  constrainWith?: string[]; // IDs of other sliders that must sum to 100%
  constraintType?: 'sum' | 'independent'; // How this slider relates to others
  // Grouping for income allocation constraints
  group?: 'needs' | 'wants' | 'savings'; // Which parent group this slider belongs to
  parentCategory?: string; // If this is a subcategory, the parent category key
}

/**
 * Comparison Metric
 */
export interface ComparisonMetric {
  label: string;
  baselineValue: number;
  scenarioValue: number;
  formatValue?: (value: number) => string;
  deltaFormat?: (delta: number) => string;
}

/**
 * Custom Section Configuration
 */
export interface CustomSection {
  id: string;
  title: string;
  render: (props: {
    sliderValues: Record<string, number>;
    baselinePlanData: FinalPlanData | null;
    scenarioPlanData: FinalPlanData | null;
    scenarioState: OnboardingState;
    baselineState: OnboardingState;
  }) => ReactNode;
}

/**
 * Chart Configuration
 */
export interface ChartConfig {
  type: 'net_worth' | 'income_distribution' | 'nws_bars' | 'custom' | 'none';
  title?: string;
  description?: string;
  customRender?: (props: {
    baselinePlanData: FinalPlanData | null;
    scenarioPlanData: FinalPlanData | null;
    sliderValues: Record<string, number>;
  }) => ReactNode;
}

/**
 * Tool Configuration
 */
export interface ToolConfig {
  // Basic info
  id: string;
  title: string;
  description?: string;
  
  // Sliders/Inputs
  sliders: ToolSlider[];
  
  // Calculation logic
  calculateScenarioState: (props: {
    baselineState: OnboardingState;
    sliderValues: Record<string, number>;
  }) => OnboardingState;
  
  // Visualization
  chart: ChartConfig;
  
  // Comparison metrics (can be static array or function for dynamic calculation)
  comparisonMetrics?: ComparisonMetric[] | ((props: {
    baselinePlanData: FinalPlanData | null;
    scenarioPlanData: FinalPlanData | null;
    sliderValues: Record<string, number>;
    baselineState: OnboardingState;
    scenarioState: OnboardingState;
  }) => ComparisonMetric[]);
  
  // Custom sections (e.g., debt details)
  customSections?: CustomSection[];
  
  // Apply handler
  onApply: (props: {
    sliderValues: Record<string, number>;
    scenarioState: OnboardingState;
    baselineState: OnboardingState;
  }) => void | Promise<void>;
  
  // Navigation
  onBack?: () => void;
  backLabel?: string;
  
  // Additional content
  headerContent?: ReactNode;
  footerContent?: ReactNode;
}

