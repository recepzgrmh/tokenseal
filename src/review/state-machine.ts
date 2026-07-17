/**
 * Retry / escalation / completion state machine.
 *
 * Models the review loop from the spec:
 *   initial implementation
 *     → up to MAX_REVISIONS evidence-based revisions
 *       → up to MAX_ESCALATIONS jump to the strongest model class
 *         → final verification / return to user
 *
 * The transitions are deliberately bounded: there is no state from which the
 * machine can revise or escalate forever. Once revisions and the single
 * escalation are exhausted, the only remaining exit is back to the user.
 */
import type { VerificationResult } from '../receipts/schema.ts';

export const MAX_REVISIONS = 2 as const;
export const MAX_ESCALATIONS = 1 as const;

export type ReviewDecision = 'approve' | 'revise' | 'escalate';

export interface ReviewState {
  retryCount: number;
  escalated: boolean;
  verificationPassed: boolean;
  finalReviewDecision: ReviewDecision | null;
  externalBlocker: boolean;
}

export interface CompletionCheck {
  canComplete: boolean;
  reasons: string[];
}

export type NextAction = 'complete' | 'revise' | 'escalate' | 'return-to-user';

/**
 * The Stop-hook completion gate. A task may only complete when verification
 * passed, the final review approved, and no critical/external blocker is
 * present. Every failing precondition is reported so the gate can explain
 * itself.
 */
export function evaluateCompletion(
  state: ReviewState,
  verification: VerificationResult,
): CompletionCheck {
  const reasons: string[] = [];

  if (!state.verificationPassed) {
    reasons.push('verification has not passed');
  }
  if (state.finalReviewDecision !== 'approve') {
    reasons.push(`final review decision is ${state.finalReviewDecision ?? 'pending'}, not approve`);
  }
  if (state.externalBlocker) {
    reasons.push('an external blocker is present');
  }
  if (verification.testsFailed > 0) {
    reasons.push(`${verification.testsFailed} test(s) failing`);
  }
  if (verification.lintPassed === false) {
    reasons.push('lint failed');
  }
  if (verification.typeCheckPassed === false) {
    reasons.push('type check failed');
  }
  if (verification.buildPassed === false) {
    reasons.push('build failed');
  }

  return { canComplete: reasons.length === 0, reasons };
}

/**
 * Decide the next action for the loop given the current state. Bounded by
 * {@link MAX_REVISIONS} and {@link MAX_ESCALATIONS} so it can never cycle
 * indefinitely.
 */
export function nextAction(state: ReviewState): NextAction {
  // A blocker only the user can clear always short-circuits the loop.
  if (state.externalBlocker) return 'return-to-user';

  const decision = state.finalReviewDecision;

  if (decision === 'approve') return 'complete';

  if (decision === 'revise') {
    if (state.retryCount < MAX_REVISIONS) return 'revise';
    // Revisions exhausted: try the single escalation if we still have it.
    if (!state.escalated) return 'escalate';
    // Escalation already spent and still not approved.
    return 'return-to-user';
  }

  if (decision === 'escalate') {
    if (!state.escalated) return 'escalate';
    return 'return-to-user';
  }

  // decision === null: nothing to approve yet and no explicit revise/escalate.
  return 'return-to-user';
}
