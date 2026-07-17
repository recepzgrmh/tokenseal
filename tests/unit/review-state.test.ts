import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateCompletion,
  nextAction,
  MAX_REVISIONS,
  MAX_ESCALATIONS,
  type ReviewState,
} from '../../src/review/state-machine.ts';
import { newVerification } from '../../src/receipts/schema.ts';

function state(partial: Partial<ReviewState> = {}): ReviewState {
  return {
    retryCount: 0,
    escalated: false,
    verificationPassed: false,
    finalReviewDecision: null,
    externalBlocker: false,
    ...partial,
  };
}

test('limits are as specified', () => {
  assert.equal(MAX_REVISIONS, 2);
  assert.equal(MAX_ESCALATIONS, 1);
});

test('approve leads to complete', () => {
  assert.equal(nextAction(state({ finalReviewDecision: 'approve' })), 'complete');
});

test('revise below the limit revises; two revises then escalates', () => {
  assert.equal(nextAction(state({ finalReviewDecision: 'revise', retryCount: 0 })), 'revise');
  assert.equal(nextAction(state({ finalReviewDecision: 'revise', retryCount: 1 })), 'revise');
  // Revisions exhausted -> escalate (still have the one escalation).
  assert.equal(nextAction(state({ finalReviewDecision: 'revise', retryCount: 2 })), 'escalate');
});

test('explicit escalate decision escalates when not yet escalated', () => {
  assert.equal(nextAction(state({ finalReviewDecision: 'escalate' })), 'escalate');
});

test('escalation exhausted returns to user', () => {
  assert.equal(
    nextAction(state({ finalReviewDecision: 'revise', retryCount: 2, escalated: true })),
    'return-to-user',
  );
  assert.equal(
    nextAction(state({ finalReviewDecision: 'escalate', escalated: true })),
    'return-to-user',
  );
});

test('external blocker always returns to user', () => {
  assert.equal(
    nextAction(state({ finalReviewDecision: 'approve', externalBlocker: true })),
    'return-to-user',
  );
});

test('null decision returns to user (never silently completes)', () => {
  assert.equal(nextAction(state({ finalReviewDecision: null })), 'return-to-user');
});

test('completion gate blocks when review is not approved', () => {
  const check = evaluateCompletion(
    state({ verificationPassed: true, finalReviewDecision: 'revise' }),
    newVerification({ testsPassed: 5 }),
  );
  assert.equal(check.canComplete, false);
  assert.ok(check.reasons.some((r) => r.includes('approve')));
});

test('completion gate blocks when verification has not passed', () => {
  const check = evaluateCompletion(
    state({ verificationPassed: false, finalReviewDecision: 'approve' }),
    newVerification({ testsFailed: 1 }),
  );
  assert.equal(check.canComplete, false);
  assert.ok(check.reasons.some((r) => r.includes('verification')));
  assert.ok(check.reasons.some((r) => r.includes('test')));
});

test('completion gate blocks on an external blocker', () => {
  const check = evaluateCompletion(
    state({ verificationPassed: true, finalReviewDecision: 'approve', externalBlocker: true }),
    newVerification(),
  );
  assert.equal(check.canComplete, false);
  assert.ok(check.reasons.some((r) => r.includes('blocker')));
});

test('completion gate passes when everything is green', () => {
  const check = evaluateCompletion(
    state({ verificationPassed: true, finalReviewDecision: 'approve' }),
    newVerification({
      testsPassed: 10,
      lintPassed: true,
      typeCheckPassed: true,
      buildPassed: true,
    }),
  );
  assert.equal(check.canComplete, true);
  assert.deepEqual(check.reasons, []);
});

test('the loop is bounded: it always reaches a terminal state', () => {
  // Simulate a worst-case adversarial reviewer that keeps demanding revise/escalate.
  let s = state({ finalReviewDecision: 'revise' });
  const terminal = new Set(['complete', 'return-to-user']);
  let steps = 0;
  const maxSteps = 20; // generous upper bound; must terminate well before this.

  for (; steps < maxSteps; steps++) {
    const action = nextAction(s);
    if (terminal.has(action)) break;
    if (action === 'revise') {
      s = { ...s, retryCount: s.retryCount + 1 };
    } else if (action === 'escalate') {
      s = { ...s, escalated: true, finalReviewDecision: 'escalate' };
    }
  }

  assert.ok(steps < maxSteps, 'state machine must terminate (no infinite loop)');
  assert.ok(terminal.has(nextAction(s)));
});
