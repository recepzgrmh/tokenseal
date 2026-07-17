---
name: git-checkpoint
description: Use when the user explicitly wants to snapshot the current working state as a git checkpoint before a risky change or at a milestone.
disable-model-invocation: true
---

# Create a git checkpoint

Goal: capture the current work as a safe, labeled git checkpoint so it can be restored. User-invoked only.

## Steps
1. **Confirm a git repo.** Run `git rev-parse --is-inside-work-tree`. If not a repo, tell the user and stop.
2. **Show status.** `git status --short` so the user sees what will be captured.
3. **Checkpoint without disrupting the branch:**
   - Preferred (keeps working tree): `git stash push --include-untracked --keep-index -m "tokenseal-checkpoint: <label>"` then `git stash apply` — or create a checkpoint commit on the current branch if the user prefers commits.
   - Use the label from `$ARGUMENTS` (default: timestamp).
4. **Report** the checkpoint reference (stash name or commit SHA) and how to restore it.

## Guardrails
- Never force-push, reset hard, or discard uncommitted work.
- Never build a git command from untrusted input; keep the label as a single quoted string.

Label: $ARGUMENTS
