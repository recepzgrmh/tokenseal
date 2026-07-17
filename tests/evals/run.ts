/**
 * Eval runner. `npm run eval` (optionally `-- --trials 3 --json`).
 *
 * Runs each case for N trials and reports pass/fail + token metrics. Cases are
 * deterministic, so multiple trials should agree — a disagreement is itself a
 * signal (flakiness/non-determinism) worth failing on.
 */
import { CASES, type EvalCase, type EvalResult } from './cases.ts';

interface Aggregate {
  id: string;
  name: string;
  category: string;
  trials: number;
  passes: number;
  stable: boolean;
  metrics: Record<string, number>;
  detail: string;
}

function runCase(c: EvalCase, trials: number): Aggregate {
  let passes = 0;
  let last: EvalResult = { pass: false, detail: '', metrics: {} };
  const details = new Set<string>();
  for (let i = 0; i < trials; i++) {
    last = c.run();
    if (last.pass) passes++;
    details.add(String(last.pass));
  }
  return {
    id: c.id,
    name: c.name,
    category: c.category,
    trials,
    passes,
    stable: details.size === 1,
    metrics: last.metrics,
    detail: last.detail,
  };
}

export function runAll(trials = 1): { results: Aggregate[]; allPassed: boolean } {
  const results = CASES.map((c) => runCase(c, trials));
  const allPassed = results.every((r) => r.passes === r.trials && r.stable);
  return { results, allPassed };
}

function parseTrials(argv: string[]): number {
  const i = argv.indexOf('--trials');
  if (i >= 0 && argv[i + 1]) return Math.max(1, Number(argv[i + 1]) || 1);
  return 1;
}

function main(argv: string[]): void {
  const trials = parseTrials(argv);
  const { results, allPassed } = runAll(trials);
  if (argv.includes('--json')) {
    process.stdout.write(JSON.stringify({ trials, allPassed, results }, null, 2) + '\n');
  } else {
    process.stdout.write(`\n🦭 TokenSeal evals (${results.length} cases × ${trials} trial(s))\n\n`);
    for (const r of results) {
      const mark = r.passes === r.trials && r.stable ? '✔' : '✖';
      const tok = r.metrics.inputTokens
        ? ` [${r.metrics.inputTokens}→${r.metrics.outputTokens ?? '?'} tok]`
        : '';
      process.stdout.write(`  ${mark} ${r.category.padEnd(8)} ${r.name}${tok}\n`);
    }
    const passed = results.filter((r) => r.passes === r.trials && r.stable).length;
    process.stdout.write(`\n  ${passed}/${results.length} passed\n`);
  }
  process.exitCode = allPassed ? 0 : 1;
}

// Run when invoked directly (not when imported by the unit test).
if (process.argv[1] && process.argv[1].endsWith('run.ts')) {
  main(process.argv.slice(2));
}
