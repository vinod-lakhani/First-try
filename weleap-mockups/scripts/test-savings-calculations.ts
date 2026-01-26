/**
 * Comprehensive Savings Calculations Test Script
 * 
 * This script validates that all savings calculations are consistent
 * across different scenarios and pages.
 * 
 * Run with: npx tsx scripts/test-savings-calculations.ts
 */

import { calculateSavingsBreakdown, calculatePreTaxSavings, calculateBaseSavingsMonthly } from '../lib/utils/savingsCalculations';
import type { IncomeState, PayrollContributions } from '../lib/onboarding/types';

interface TestCase {
  name: string;
  income: IncomeState;
  payrollContributions: PayrollContributions | undefined;
  monthlyNeeds: number;
  monthlyWants: number;
  expected: {
    baseSavingsMonthly: number;
    cashSavingsMTD: number;
    payrollSavingsMTD: number;
    employerMatchMTD: number;
    totalSavingsMTD: number;
  };
}

const testCases: TestCase[] = [
  {
    name: 'No 401k contribution - Base case',
    income: {
      netIncome$: 4000,
      payFrequency: 'biweekly',
    },
    payrollContributions: {
      has401k: true,
      hasEmployerMatch: 'yes',
      employerMatchPct: 50,
      employerMatchCapPct: 6,
      currentlyContributing401k: 'no',
    },
    monthlyNeeds: 2868,
    monthlyWants: 2400,
    expected: {
      baseSavingsMonthly: 3412, // 4000 * 2.17 - 2868 - 2400 = 8680 - 2868 - 2400 = 3412
      cashSavingsMTD: 3412, // No pre-tax deductions, so cash = base
      payrollSavingsMTD: 0, // Not contributing
      employerMatchMTD: 0, // No contribution = no match
      totalSavingsMTD: 3412, // Cash only
    },
  },
  {
    name: 'With 6% 401k contribution and match',
    income: {
      netIncome$: 4000,
      grossIncome$: 5200, // Gross income for 401k calculation
      payFrequency: 'biweekly',
    },
    payrollContributions: {
      has401k: true,
      hasEmployerMatch: 'yes',
      employerMatchPct: 50,
      employerMatchCapPct: 6,
      currentlyContributing401k: 'yes',
      contributionType401k: 'percent_gross',
      contributionValue401k: 6,
    },
    monthlyNeeds: 2868,
    monthlyWants: 2400,
    expected: {
      baseSavingsMonthly: 3412, // Original: 4000 * 2.17 - 2868 - 2400 = 8680 - 5268 = 3412
      cashSavingsMTD: 2904, // 3412 - (677 - 169) = 3412 - 508 = 2904
      payrollSavingsMTD: 677, // 6% of 5200 * 2.17 = 6% of 11284 = 677.04
      employerMatchMTD: 339, // 50% of 677 = 338.5 (rounded to 339)
      totalSavingsMTD: 3920, // 2904 + 677 + 339 = 3920
    },
  },
  {
    name: 'Remove 401k contribution - Should return to base',
    income: {
      netIncome$: 4000,
      grossIncome$: 5500,
      payFrequency: 'biweekly',
    },
    payrollContributions: {
      has401k: true,
      hasEmployerMatch: 'yes',
      employerMatchPct: 50,
      employerMatchCapPct: 6,
      currentlyContributing401k: 'no', // Removed contribution
    },
    monthlyNeeds: 2868,
    monthlyWants: 2400,
    expected: {
      baseSavingsMonthly: 3412,
      cashSavingsMTD: 3412, // Should return to base when contribution removed
      payrollSavingsMTD: 0,
      employerMatchMTD: 0,
      totalSavingsMTD: 3412,
    },
  },
];

function runTests() {
  console.log('🧪 Running Savings Calculations Tests\n');
  console.log('='.repeat(80));
  
  let passed = 0;
  let failed = 0;
  const failures: string[] = [];
  
  for (const testCase of testCases) {
    console.log(`\n📋 Test: ${testCase.name}`);
    console.log('-'.repeat(80));
    
    try {
      // Calculate base savings
      const baseSavingsMonthly = calculateBaseSavingsMonthly(
        testCase.income,
        testCase.monthlyNeeds,
        testCase.monthlyWants
      );
      
      // Calculate full breakdown
      const breakdown = calculateSavingsBreakdown(
        testCase.income,
        testCase.payrollContributions,
        testCase.monthlyNeeds,
        testCase.monthlyWants
      );
      
      // Validate each expected value
      const checks = [
        {
          name: 'Base Savings Monthly',
          expected: testCase.expected.baseSavingsMonthly,
          actual: baseSavingsMonthly,
          tolerance: 1,
        },
        {
          name: 'Cash Savings MTD',
          expected: testCase.expected.cashSavingsMTD,
          actual: breakdown.cashSavingsMTD,
          tolerance: 1,
        },
        {
          name: 'Payroll Savings MTD',
          expected: testCase.expected.payrollSavingsMTD,
          actual: breakdown.payrollSavingsMTD,
          tolerance: 1,
        },
        {
          name: 'Employer Match MTD',
          expected: testCase.expected.employerMatchMTD,
          actual: breakdown.employerMatchMTD,
          tolerance: 1,
        },
        {
          name: 'Total Savings MTD',
          expected: testCase.expected.totalSavingsMTD,
          actual: breakdown.totalSavingsMTD,
          tolerance: 1,
        },
      ];
      
      let testPassed = true;
      for (const check of checks) {
        const diff = Math.abs(check.expected - check.actual);
        if (diff > check.tolerance) {
          console.log(`  ❌ ${check.name}: Expected ${check.expected}, got ${check.actual} (diff: ${diff.toFixed(2)})`);
          testPassed = false;
        } else {
          console.log(`  ✅ ${check.name}: ${check.actual} (expected: ${check.expected})`);
        }
      }
      
      // Additional validation: Total should equal sum
      const calculatedTotal = breakdown.cashSavingsMTD + breakdown.payrollSavingsMTD + breakdown.employerMatchMTD;
      if (Math.abs(calculatedTotal - breakdown.totalSavingsMTD) > 0.01) {
        console.log(`  ❌ Total validation: Sum (${calculatedTotal}) != totalSavingsMTD (${breakdown.totalSavingsMTD})`);
        testPassed = false;
      } else {
        console.log(`  ✅ Total validation: Sum matches totalSavingsMTD`);
      }
      
      // Additional validation: Cash should be base - netPreTaxImpact
      const expectedCash = Math.max(0, breakdown.baseSavingsMonthly - breakdown.netPreTaxImpact);
      if (Math.abs(expectedCash - breakdown.cashSavingsMTD) > 0.01) {
        console.log(`  ❌ Cash calculation: Expected ${expectedCash}, got ${breakdown.cashSavingsMTD}`);
        testPassed = false;
      } else {
        console.log(`  ✅ Cash calculation: Formula is correct`);
      }
      
      if (testPassed) {
        passed++;
        console.log(`\n  ✅ Test PASSED`);
      } else {
        failed++;
        failures.push(testCase.name);
        console.log(`\n  ❌ Test FAILED`);
      }
      
      // Print detailed breakdown
      console.log(`\n  📊 Detailed Breakdown:`);
      console.log(`     Base Savings: $${breakdown.baseSavingsMonthly.toFixed(2)}`);
      console.log(`     Pre-tax Total: $${breakdown.preTaxSavingsTotal.toFixed(2)}`);
      console.log(`     Tax Savings: $${breakdown.taxSavingsMonthly.toFixed(2)}`);
      console.log(`     Net Pre-tax Impact: $${breakdown.netPreTaxImpact.toFixed(2)}`);
      console.log(`     Cash Savings: $${breakdown.cashSavingsMTD.toFixed(2)}`);
      console.log(`     Payroll Savings: $${breakdown.payrollSavingsMTD.toFixed(2)}`);
      console.log(`     Employer Match: $${breakdown.employerMatchMTD.toFixed(2)}`);
      console.log(`     Total Savings: $${breakdown.totalSavingsMTD.toFixed(2)}`);
      
    } catch (error) {
      failed++;
      failures.push(testCase.name);
      console.log(`  ❌ Test FAILED with error: ${error}`);
      if (error instanceof Error) {
        console.log(`     ${error.message}`);
        console.log(`     ${error.stack}`);
      }
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 Test Summary:`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Total: ${passed + failed}`);
  
  if (failures.length > 0) {
    console.log(`\n❌ Failed Tests:`);
    failures.forEach(name => console.log(`   - ${name}`));
    process.exit(1);
  } else {
    console.log(`\n✅ All tests passed!`);
    process.exit(0);
  }
}

// Run tests if this file is executed directly
// Note: This requires tsx or ts-node to run TypeScript directly
// Install with: npm install -D tsx
// Or use: npx tsx scripts/test-savings-calculations.ts
if (typeof require !== 'undefined' && require.main === module) {
  runTests();
}

export { runTests, testCases };
