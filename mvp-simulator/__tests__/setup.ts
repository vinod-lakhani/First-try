import * as fs from 'fs';
import * as path from 'path';
import { afterAll } from 'vitest';
import { getRecordedCases } from './testLogger';

afterAll(() => {
  const cases = getRecordedCases();
  if (cases.length === 0) return;

  const outDir = path.resolve(process.cwd(), 'test-results');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const casesPath = path.join(outDir, 'test-cases.json');
  fs.writeFileSync(casesPath, JSON.stringify(cases, null, 2), 'utf-8');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const summaryPath = path.join(outDir, `test-summary-${timestamp}.txt`);
  const summaryLines: string[] = [
    `MVP Simulator Test Summary – ${new Date().toISOString()}`,
    `Total recorded cases: ${cases.length}`,
    '',
    '--- Cases ---',
  ];
  for (const c of cases) {
    summaryLines.push(`[${c.category}] ${c.name}`);
    summaryLines.push(`  inputs: ${JSON.stringify(c.inputs).slice(0, 120)}${JSON.stringify(c.inputs).length > 120 ? '...' : ''}`);
    summaryLines.push(`  outputs: ${JSON.stringify(c.outputs).slice(0, 120)}${JSON.stringify(c.outputs).length > 120 ? '...' : ''}`);
    if (c.notes) summaryLines.push(`  notes: ${c.notes}`);
    summaryLines.push('');
  }
  fs.writeFileSync(summaryPath, summaryLines.join('\n'), 'utf-8');
});
