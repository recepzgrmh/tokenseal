import { test } from 'node:test';
import assert from 'node:assert/strict';
// gate.mjs is a pure, dependency-free module shared with the Stop hook script.
import { decideStop } from '../../plugin/scripts/lib/gate.mjs';

test('no state at all → never blocks', () => {
  assert.deepEqual(decideStop(undefined), { block: false, reason: '' });
  assert.deepEqual(decideStop(null), { block: false, reason: '' });
  assert.equal(decideStop({}).block, false);
});

test('non-code active task → never blocks', () => {
  assert.equal(
    decideStop({ active: true, kind: 'other', verificationState: 'unverified' }).block,
    false,
  );
});

test('unverified active code task → blocks with a reason', () => {
  const d = decideStop({
    kind: 'code',
    active: true,
    verificationState: 'unverified',
    reviewState: 'pending',
    stopCount: 0,
  });
  assert.equal(d.block, true);
  assert.match(d.reason, /verif/i);
});

test('verified but not-approved active code task → blocks', () => {
  const d = decideStop({
    kind: 'code',
    active: true,
    verificationState: 'verified',
    reviewState: 'revise',
    stopCount: 0,
  });
  assert.equal(d.block, true);
  assert.match(d.reason, /review/i);
});

test('verified and approved active code task → does not block', () => {
  const d = decideStop({
    kind: 'code',
    active: true,
    verificationState: 'verified',
    reviewState: 'approve',
    stopCount: 0,
  });
  assert.equal(d.block, false);
});

test('externalBlocker → never blocks even if unverified', () => {
  const d = decideStop({
    kind: 'code',
    active: true,
    verificationState: 'unverified',
    reviewState: 'pending',
    externalBlocker: true,
    stopCount: 0,
  });
  assert.equal(d.block, false);
});

test('loop guard: stopCount >= 3 → never blocks', () => {
  const d = decideStop({
    kind: 'code',
    active: true,
    verificationState: 'unverified',
    reviewState: 'pending',
    stopCount: 3,
  });
  assert.equal(d.block, false);
});
