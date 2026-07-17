/**
 * Pure completion-gate decision for the TokenSeal `Stop` hook.
 *
 * No I/O, no side effects — this is what the unit test drives. The Stop hook
 * script reads the session state file and passes the parsed object here.
 *
 * Expected `state` shape (all fields optional; missing → safe defaults):
 *   {
 *     taskId?: string,
 *     kind?: 'code' | 'other',          // only 'code' tasks are gated
 *     active?: boolean,                  // is the task still in progress?
 *     verificationState?: 'unverified' | 'verified' | 'n/a',
 *     reviewState?: 'pending' | 'approve' | 'revise' | 'escalate' | 'n/a',
 *     externalBlocker?: boolean,         // waiting on user / dependency → allow
 *     stopCount?: number                 // how many times Stop was already blocked
 *   }
 *
 * @param {unknown} state
 * @returns {{ block: boolean, reason: string }}
 */
export function decideStop(state) {
  // No state (absent file) or malformed → never disrupt an ordinary session.
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return { block: false, reason: '' };
  }

  const s = /** @type {Record<string, unknown>} */ (state);

  // Loop guard: after 3 blocks, always allow to avoid an infinite Stop loop.
  const stopCount = typeof s.stopCount === 'number' && Number.isFinite(s.stopCount) ? s.stopCount : 0;
  if (stopCount >= 3) {
    return { block: false, reason: '' };
  }

  // An explicit external blocker (waiting on the user or a dependency) → allow.
  if (s.externalBlocker === true) {
    return { block: false, reason: '' };
  }

  // Only active *code* tasks are gated. Everything else stops freely.
  const isActiveCodeTask = s.active === true && s.kind === 'code';
  if (!isActiveCodeTask) {
    return { block: false, reason: '' };
  }

  // Verification must have succeeded.
  if (s.verificationState !== 'verified') {
    return {
      block: true,
      reason:
        'TokenSeal gate: active code task is not verified. Exercise the change end-to-end ' +
        '(the `verify` skill) before stopping. If you are waiting on the user or a dependency, ' +
        'set externalBlocker=true in the task state.',
    };
  }

  // Final review must be an explicit approval.
  if (s.reviewState !== 'approve') {
    const current = typeof s.reviewState === 'string' ? s.reviewState : 'pending';
    return {
      block: true,
      reason:
        'TokenSeal gate: task is verified but final review is not `approve` (current: ' +
        current +
        '). Run the `review` skill and resolve blocking issues, or set externalBlocker=true if blocked externally.',
    };
  }

  return { block: false, reason: '' };
}
