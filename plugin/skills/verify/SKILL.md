---
name: verify
description: Use when a code change is complete and needs evidence that it actually works before it can be reviewed or called done.
---

# Verify a change (evidence, not assertion)

Goal: produce real evidence the change does what it should. This is the first half of the completion gate.

## Steps
1. **Exercise the real behavior.** Drive the affected flow end-to-end, not just unit tests. Use the `verifier` agent.
2. **Run the project's checks** relevant to the change (tests, lint, typecheck, build). Capture pass/fail per command.
3. **Judge the result:**
   - All checks pass and behavior observed correct → mark task state `verificationState: verified`, then run the `review` skill.
   - Any failure or unexercisable behavior → mark `verificationState: unverified` and route back to `implement`/`debug`.
4. **Record evidence** (commands + results) into the task state so the `Stop` gate and final review can see it.

## Completion gate
- Verified is necessary but not sufficient. The task is not "done" until `review` returns `approve`.
- If you are blocked waiting on the user or a dependency, set `externalBlocker: true` in task state so the Stop gate allows stopping.

Context for this run: $ARGUMENTS
