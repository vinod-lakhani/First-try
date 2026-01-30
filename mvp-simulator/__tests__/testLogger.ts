/**
 * Test case logger for shareable inputs/outputs.
 * Call recordTestCase() in tests; setup.ts writes test-results/ after all tests.
 */

export interface TestCaseRecord {
  id: string;
  name: string;
  category: 'unit' | 'integration' | 'regression';
  inputs: unknown;
  outputs: unknown;
  notes?: string;
}

const records: TestCaseRecord[] = [];

export function recordTestCase(
  name: string,
  inputs: unknown,
  outputs: unknown,
  options?: { category?: TestCaseRecord['category']; notes?: string }
): void {
  const id = name.replace(/\s+/g, '-').toLowerCase();
  records.push({
    id,
    name,
    category: options?.category ?? 'unit',
    inputs,
    outputs,
    notes: options?.notes,
  });
}

export function getRecordedCases(): TestCaseRecord[] {
  return records;
}

export function clearRecordedCases(): void {
  records.length = 0;
}
