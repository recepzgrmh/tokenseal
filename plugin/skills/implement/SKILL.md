---
name: implement
description: Use when the goal and target files of a code change are already clear and you are ready to make the actual edit.
---

# Implement a change

Goal: make the smallest sufficient, surgical change that satisfies the objective, then leave it verifiable.

## Steps
1. **Confirm the goal is verifiable.** If it is not a checkable statement yet, run the `plan` skill first.
2. **Read before writing.** Read the target files and their immediate contracts so the edit fits existing patterns.
3. **Make the surgical change** via the `implementation-agent` (write-capable, isolated worktree) or directly. Address the root cause; do not patch symptoms or expand scope.
4. **Keep it building.** Run the narrowest relevant build/check tied to your change.
5. **Do not declare done here.** Hand off to `verify`, then `review`. Implementation alone is never "done".

## Guardrails
- No unrelated refactors, reformatting, or speculative options.
- Never weaken permissions or security to make something pass.
- Record changed files so verification and review can target them.

Context for this run: $ARGUMENTS
