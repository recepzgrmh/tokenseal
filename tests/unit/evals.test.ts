import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAll } from '../evals/run.ts';
import { CASES } from '../evals/cases.ts';

test('all eval cases pass and are stable across trials', () => {
  const { results, allPassed } = runAll(3);
  const failures = results.filter((r) => r.passes !== r.trials || !r.stable);
  assert.equal(
    allPassed,
    true,
    `failing evals: ${failures.map((f) => `${f.id}(${f.detail})`).join('; ')}`,
  );
});

test('eval suite covers all 15 required scenario buckets', () => {
  assert.equal(CASES.length >= 15, true, `expected >=15 cases, got ${CASES.length}`);
  const categories = new Set(CASES.map((c) => c.category));
  for (const cat of ['trivial', 'standard', 'complex', 'critical', 'context']) {
    assert.ok(categories.has(cat as never), `missing category ${cat}`);
  }
});
