import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  matrixForVersion,
  parseSemVer,
  compareSemVer,
  gte,
} from '../../src/capabilities/matrix.ts';
import { resolveEffort, ROUTES, aliasFor } from '../../src/config/model-routing.ts';

test('parseSemVer extracts version from claude --version output', () => {
  assert.deepEqual(parseSemVer('2.1.212 (Claude Code)')?.raw, '2.1.212');
  assert.equal(parseSemVer('no version here'), null);
});

test('compareSemVer orders correctly and treats null as lowest', () => {
  assert.ok(compareSemVer(parseSemVer('2.1.212'), parseSemVer('2.1.128')) > 0);
  assert.ok(compareSemVer(null, parseSemVer('1.0.0')) < 0);
  assert.equal(gte('2.1.212', '2.1.128'), true);
  assert.equal(gte('2.0.5', '2.1.128'), false);
});

test('matrix enables enhanced features on 2.1.212', () => {
  const m = matrixForVersion('2.1.212');
  assert.equal(m.capabilities.subagentWorktrees, true);
  assert.equal(m.capabilities.preCompactHook, true);
  assert.deepEqual(m.capabilities.effortLevels, ['low', 'medium', 'high', 'xhigh', 'max']);
});

test('matrix degrades on an older but supported version', () => {
  const m = matrixForVersion('2.0.5');
  assert.equal(m.capabilities.plugins, true);
  assert.equal(m.capabilities.subagentWorktrees, false);
  assert.ok(m.notes.some((n) => /fall back/.test(n)));
});

test('matrix reports not-installed for null version', () => {
  const m = matrixForVersion(null);
  assert.equal(m.claudeCodeInstalled, false);
});

test('resolveEffort clamps to supported levels', () => {
  const full = matrixForVersion('2.1.212');
  assert.equal(resolveEffort('max', full), 'max');
  const old = matrixForVersion('2.0.5'); // supports up to high
  assert.equal(resolveEffort('max', old), 'high');
  assert.equal(resolveEffort('xhigh', old), 'high');
});

test('routes map to model classes and aliases', () => {
  assert.equal(ROUTES['critical-security'].modelClass, 'strongest');
  assert.equal(aliasFor('strongest'), 'opus');
  assert.equal(aliasFor('low-cost'), 'haiku');
});
