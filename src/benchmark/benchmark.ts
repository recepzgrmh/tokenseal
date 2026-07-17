/**
 * Benchmark harness.
 *
 * v0.1.0 measures ONE concrete, honest thing: how much the output filters
 * shrink representative tool output (in approximate tokens) while keeping the
 * full output recoverable. It does NOT claim an end-to-end % savings — real
 * savings depend on the workload, which is why we ship `tokenseal benchmark`
 * for users to run on their own data.
 */
import { filterOutput, type FilterInput } from '../filters/index.ts';
import { approxTokens } from '../utils/text.ts';

export interface BenchScenario {
  name: string;
  input: FilterInput;
}

export interface BenchRow {
  name: string;
  originalTokens: number;
  filteredTokens: number;
  reductionRatio: number;
  recoverable: boolean;
  strategy: string;
}

export interface BenchSummary {
  rows: BenchRow[];
  totalOriginalTokens: number;
  totalFilteredTokens: number;
  aggregateReduction: number;
  allRecoverable: boolean;
  note: string;
}

/** Deterministic, self-contained sample outputs (no external fixtures). */
export function defaultScenarios(): BenchScenario[] {
  const passingTests =
    'PASS src/a.test.ts\n'.repeat(60) + '\nTest Suites: 60 passed, 60 total\nTests: 240 passed';
  const bigJson = JSON.stringify({
    items: Array.from({ length: 500 }, (_, i) => ({ id: i, name: `item-${i}` })),
  });
  const failing =
    'PASS src/a.test.ts\n'.repeat(20) +
    '\nFAIL src/b.test.ts\n  ● b > works\n    AssertionError: expected 1 to equal 2\n      at b.test.ts:12:5\n' +
    'PASS src/c.test.ts\n'.repeat(20);
  const bashNoise = Array.from({ length: 800 }, (_, i) => `downloading chunk ${i}/800 ok`).join(
    '\n',
  );
  const small = 'Done in 1.2s';
  return [
    {
      name: 'passing-test-output',
      input: { text: passingTests, command: 'npm test', exitCode: 0, kind: 'test' },
    },
    {
      name: 'large-json',
      input: { text: bigJson, command: 'cat data.json', exitCode: 0, kind: 'json' },
    },
    {
      name: 'failing-test-output',
      input: { text: failing, command: 'npm test', exitCode: 1, kind: 'test' },
    },
    {
      name: 'noisy-bash',
      input: { text: bashNoise, command: 'download.sh', exitCode: 0, kind: 'bash' },
    },
    { name: 'small-output', input: { text: small, command: 'npm run build', exitCode: 0 } },
  ];
}

export function runBenchmark(scenarios = defaultScenarios()): BenchSummary {
  const rows: BenchRow[] = [];
  for (const s of scenarios) {
    const original = approxTokens(s.input.text);
    const result = filterOutput(s.input);
    const filtered = approxTokens(result.filtered);
    rows.push({
      name: s.name,
      originalTokens: original,
      filteredTokens: filtered,
      reductionRatio: original === 0 ? 0 : Math.max(0, 1 - filtered / original),
      recoverable: result.recoverable || result.strategy.startsWith('passthrough'),
      strategy: result.strategy,
    });
  }
  const totalOriginalTokens = rows.reduce((a, r) => a + r.originalTokens, 0);
  const totalFilteredTokens = rows.reduce((a, r) => a + r.filteredTokens, 0);
  return {
    rows,
    totalOriginalTokens,
    totalFilteredTokens,
    aggregateReduction:
      totalOriginalTokens === 0 ? 0 : 1 - totalFilteredTokens / totalOriginalTokens,
    allRecoverable: rows.every((r) => r.recoverable),
    note: 'Filter-only token reduction on sample outputs. Real savings vary by workload; failing output is always preserved.',
  };
}
