# Completion Gate & Final Review

TokenSeal's core promise: an AI code change is not "done" until it has been
independently verified and reviewed. This is enforced by **deterministic code**,
not by the model deciding it feels finished.

## The gate (`plugin/scripts/stop.mjs` + `lib/gate.mjs`)

A `Stop` hook runs a pure decision function, `decideStop(state)`, over the task
state at `~/.claude/tokenseal/state/<session>.json`:

- **Blocks** turn-end (exit 2, reason on stderr) only when the active task is a
  *code* task and it is `unverified` **or** its final review is not `approve`.
- **Allows** stop when there is no task state (ordinary sessions are never
  gated), when an `externalBlocker` is set, or after a **loop guard** of 3 blocks
  (so it can never trap you).

The guarantee lives in deterministic task state + a command hook — never in an
LLM-only hook.

## Final review (`plugin/agents/final-reviewer`)

A fresh-context reviewer agent judges the verified diff and returns structured
JSON:

```json
{
  "decision": "approve | revise | escalate",
  "confidence": 0.0,
  "blockingIssues": [],
  "nonBlockingIssues": [],
  "requiredChanges": [],
  "verificationRequired": [],
  "recommendedModelClass": "balanced | strongest"
}
```

The reviewer **does not edit code**. On `revise`/`escalate`, a separate fixer
agent makes the change, then verification and review run again. The reviewer is
scoped to correctness and requirements to avoid the "reviewer always finds gaps →
over-engineering" trap.

## Bounded loop (`src/review/state-machine.ts`)

```
implementation → verification → final review
  approve  → complete
  revise   → review-fixer            (≤ 2 evidence-based revisions)
  escalate → strongest-model fixer   (1 escalation)
  → re-run verification + final review
```

`nextAction(state)` and `evaluateCompletion(state, verification)` enforce
`MAX_REVISIONS = 2` and `MAX_ESCALATIONS = 1`. The state machine is unit-tested to
**always reach a terminal state** — no infinite loops. When the bounds are
exhausted, the only remaining exit is back to you (a genuine external blocker),
never a silent "partially done".

## What clears the gate

Requested behavior implemented · acceptance criteria met · relevant
tests/lint/type-check/build pass · verifier positive · final review `approve` ·
no critical security issue · task receipt written.
