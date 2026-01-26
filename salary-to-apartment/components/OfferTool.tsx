'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResultsCards } from '@/components/ResultsCards';
import { AssumptionsAccordion } from '@/components/AssumptionsAccordion';
import { WaitlistForm } from '@/components/WaitlistForm';
import { getStateCodeForCity, getAvailableCities } from '@/lib/cities';
import { calculateRentRange, calculateBudgetBreakdown } from '@/lib/rent';
import { formatCurrency } from '@/lib/rounding';
import { track } from '@/lib/analytics';

interface TaxCalculationResult {
  federalTaxAnnual: number;
  stateTaxAnnual: number;
  ficaTaxAnnual: number;
  totalTaxAnnual: number;
  netIncomeAnnual: number;
  taxSource: 'api_ninjas' | 'fallback';
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC',
];

export function OfferTool() {
  const [salary, setSalary] = useState('');
  const [city, setCity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [otherState, setOtherState] = useState('');
  const [debtEnabled, setDebtEnabled] = useState(false);
  const [debtMonthly, setDebtMonthly] = useState('');
  const [isCalculating, setIsCalculating] = useState(false);
  const [results, setResults] = useState<TaxCalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const availableCities = getAvailableCities();
  const showOtherState = city === 'Other';

  const calculateDaysUntilStart = (dateString: string): number => {
    if (!dateString) return 0;
    const start = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    const diffTime = start.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const handleCalculate = async () => {
    setError(null);
    
    if (!salary || !city || !startDate) {
      setError('Please fill in all required fields');
      return;
    }

    if (showOtherState && !otherState) {
      setError('Please select a state');
      return;
    }

    const salaryNum = parseFloat(salary);
    if (isNaN(salaryNum) || salaryNum <= 0) {
      setError('Please enter a valid salary');
      return;
    }

    setIsCalculating(true);

    try {
      // Get state code
      const stateCode = showOtherState ? otherState : getStateCodeForCity(city);
      if (!stateCode) {
        throw new Error('Unable to determine state for selected city');
      }

      // Call tax API
      const taxResponse = await fetch('/api/tax', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          salaryAnnual: salaryNum,
          state: stateCode,
        }),
      });

      if (!taxResponse.ok) {
        const errorData = await taxResponse.json();
        throw new Error(errorData.error || 'Failed to calculate taxes');
      }

      const taxData: TaxCalculationResult = await taxResponse.json();
      setResults(taxData);
      track('offer_tool_calculated', {
        salary: salaryNum,
        city,
        state: stateCode,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsCalculating(false);
    }
  };

  // Calculate derived values
  const takeHomeMonthly = results ? results.netIncomeAnnual / 12 : 0;
  const takeHomeAnnual = results?.netIncomeAnnual || 0;
  const debtAmount = debtEnabled ? parseFloat(debtMonthly) || 0 : 0;
  const rentRange = results
    ? calculateRentRange(takeHomeMonthly, debtAmount).formatted
    : '';
  const daysUntilStart = calculateDaysUntilStart(startDate);
  const budgetBreakdown = results ? calculateBudgetBreakdown(takeHomeMonthly) : null;

  return (
    <div className="space-y-8">
      {/* Input Form */}
      <Card className="border-[#D1D5DB] bg-white">
        <CardHeader>
          <CardTitle className="text-xl text-[#111827]">Calculate Your Rent Range</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Salary Input */}
          <div className="space-y-2">
            <Label htmlFor="salary" className="text-[#111827]">
              Offer Salary (annual, USD) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="salary"
              type="number"
              placeholder="75000"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              className="border-[#D1D5DB]"
            />
          </div>

          {/* City Select */}
          <div className="space-y-2">
            <Label htmlFor="city" className="text-[#111827]">
              City <span className="text-red-500">*</span>
            </Label>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger id="city" className="border-[#D1D5DB]">
                <SelectValue placeholder="Select a city" />
              </SelectTrigger>
              <SelectContent>
                {availableCities.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* State Select (if Other selected) */}
          {showOtherState && (
            <div className="space-y-2">
              <Label htmlFor="state" className="text-[#111827]">
                State (2-letter code) <span className="text-red-500">*</span>
              </Label>
              <Select value={otherState} onValueChange={setOtherState}>
                <SelectTrigger id="state" className="border-[#D1D5DB]">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Start Date */}
          <div className="space-y-2">
            <Label htmlFor="startDate" className="text-[#111827]">
              Start Date <span className="text-red-500">*</span>
            </Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border-[#D1D5DB]"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 border border-red-200">
              {error}
            </div>
          )}

          <Button
            onClick={handleCalculate}
            disabled={isCalculating}
            className="w-full bg-[#3F6B42] text-white hover:bg-[#3F6B42]/90"
          >
            {isCalculating ? 'Calculating...' : 'See my numbers'}
          </Button>
        </CardContent>
      </Card>

      {/* Results Section */}
      {results && (
        <div className="space-y-8">
          <ResultsCards
            takeHomeMonthly={takeHomeMonthly}
            takeHomeAnnual={takeHomeAnnual}
            rentRange={rentRange}
            daysUntilStart={daysUntilStart}
            taxBreakdown={results ? {
              grossAnnual: parseFloat(salary),
              federalTaxAnnual: results.federalTaxAnnual,
              stateTaxAnnual: results.stateTaxAnnual,
              ficaTaxAnnual: results.ficaTaxAnnual,
              totalTaxAnnual: results.totalTaxAnnual,
              netIncomeAnnual: results.netIncomeAnnual,
            } : undefined}
          />

          {/* Budget Breakdown Card */}
          {budgetBreakdown && (
            <Card className="border-[#D1D5DB] bg-white">
              <CardHeader>
                <CardTitle className="text-lg text-[#111827]">
                  Suggested monthly breakdown (starting point)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[#111827]">Needs (50%)</span>
                    <span className="text-xl font-semibold text-[#111827]">
                      {formatCurrency(budgetBreakdown.needs)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#111827]">Wants (30%)</span>
                    <span className="text-xl font-semibold text-[#111827]">
                      {formatCurrency(budgetBreakdown.wants)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t border-[#D1D5DB] pt-4">
                    <span className="text-[#111827]">Savings (20%)</span>
                    <span className="text-xl font-semibold text-[#111827]">
                      {formatCurrency(budgetBreakdown.savings)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Debt Adjustment Accordion */}
          <Card className="border-[#D1D5DB] bg-white">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="debt-toggle" className="text-[#111827] cursor-pointer">
                    Adjust for debt payments (optional)
                  </Label>
                  <button
                    type="button"
                    onClick={() => {
                      setDebtEnabled(!debtEnabled);
                      if (!debtEnabled) {
                        track('offer_tool_debt_enabled');
                      }
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      debtEnabled ? 'bg-[#3F6B42]' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        debtEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {debtEnabled && (
                  <div className="space-y-2">
                    <Label htmlFor="debt" className="text-[#111827]">
                      Total monthly minimum payments ($/mo)
                    </Label>
                    <Input
                      id="debt"
                      type="number"
                      placeholder="300"
                      value={debtMonthly}
                      onChange={(e) => setDebtMonthly(e.target.value)}
                      className="border-[#D1D5DB]"
                    />
                    {debtAmount > 0 && (
                      <p className="text-sm text-[#111827]/70">
                        Updated rent range: {calculateRentRange(takeHomeMonthly, debtAmount).formatted} / month
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Assumptions Accordion */}
          <div onClick={() => track('offer_tool_assumptions_opened')}>
            <AssumptionsAccordion taxSource={results.taxSource} />
          </div>

          {/* Waitlist Form */}
          <WaitlistForm />
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-sm text-[#111827]/70 space-y-2 pt-8 border-t border-[#D1D5DB]">
        <p>Educational estimates — not financial advice.</p>
      </div>
    </div>
  );
}
