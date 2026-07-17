---
name: review
description: Use when a change has been verified and needs the independent completion gate — the final approve/revise/escalate decision — before the task can stop.
---

# Independent completion review (the gate)

Goal: run the completion gate so no AI-modified code is called "done" without independent review. Second half of the gate.

## Preconditions
Task state shows `verificationState: verified`. If not, run `verify` first.

## Loop (bounded)
1. **Independent review.** Invoke the `final-reviewer` agent (it must NOT edit code). It returns:
   `{decision, confidence, blockingIssues, nonBlockingIssues, requiredChanges, verificationRequired, recommendedModelClass}`.
2. **Act on the decision:**
   - `approve` → set task state `reviewState: approve`. The task may now stop. Done.
   - `revise` → invoke `review-fixer` with the exact `requiredChanges`, then re-run `verify` and return to step 1. **Max 2 revision cycles.**
   - `escalate` → escalate once to the strongest model class with the reviewer's notes, then re-review. **Max 1 escalation.**
3. **If security-sensitive** surfaces changed (exec, fs, secrets, input, permissions), run the `security-reviewer` agent; any high/critical finding blocks `approve`.

## Bounds & safety
- After 2 revisions or 1 escalation without `approve`, stop and report honestly to the user with the outstanding `blockingIssues` — do not loop forever, and do not self-approve.
- Never weaken tests, permissions, or security to obtain approval.

Context for this run: $ARGUMENTS
