---
name: debug
description: Use when something is broken or failing and the root cause is not yet identified — before attempting any fix.
---

# Debug to root cause

Goal: find the actual root cause with evidence before changing anything. No speculative fixes.

## Steps
1. **Reproduce.** Establish the exact failing command/flow and the observed vs expected result. Capture the real error.
2. **Localize.** Use Grep/Glob and the `codebase-explorer` agent to trace from the symptom to the code path that produces it.
3. **Form one hypothesis** about the root cause and state how you will confirm it (log, test, minimal probe).
4. **Confirm before fixing.** Prove the hypothesis with evidence. If wrong, revise the hypothesis — do not start editing on a guess.
5. **Hand off.** Once the root cause is confirmed, route to `implement` for the surgical fix, then `verify`.

## Guardrails
- Fix the cause, not the symptom. A passing test that hides the cause is not a fix.
- If the cause spans multiple subsystems, escalate to `plan`.

Context for this run: $ARGUMENTS
