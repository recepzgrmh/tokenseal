# TokenSeal plugin

The Claude Code runtime for TokenSeal — an always-on efficiency and assurance
layer. It wastes fewer tokens and never lets AI-modified code be called "done"
without independent verification and review.

Target: Claude Code **2.1.212**.

## What's inside

```
.claude-plugin/plugin.json   Manifest (name: tokenseal)
agents/                      Subagent roles (router, explorer, implementer, verifier, reviewers, fixer, explainer)
skills/                      Workflows (plan, implement, debug, verify, review, explain-last, context-audit, git-checkpoint)
hooks/hooks.json             Deterministic hooks (SessionStart, UserPromptSubmit, PostToolUse:Bash, Stop, PreCompact)
scripts/                     Dependency-free Node hook scripts + statusline
scripts/lib/gate.mjs         Pure Stop-gate decision (unit-tested)
output-styles/               Presentation profiles (detailed, summary, brief, silent)
```

## The completion gate

The core guarantee: a code task is not "done" until it is **verified** (evidence,
not assertion) and its independent **final review** returns `approve`.

- `verify` skill → drives the real behavior + checks → `verificationState: verified`.
- `review` skill → `final-reviewer` (opus, read-only) returns
  `approve | revise | escalate`. Bounded retries: ≤2 revisions, 1 escalation.
- The `Stop` hook enforces it. It reads task state and blocks stopping while an
  active code task is unverified or not approved — unless `externalBlocker` is
  set. A loop guard releases after 3 blocks so sessions can never hang.

## Task state

Written by the CLI / skills at `~/.claude/tokenseal/state/<session_id>.json`:

```json
{
  "taskId": "string",
  "kind": "code",
  "active": true,
  "objective": "one-line goal",
  "completed": [],
  "pending": [],
  "changedFiles": [],
  "verificationState": "unverified",
  "reviewState": "pending",
  "externalBlocker": false,
  "stopCount": 0
}
```

Only `kind: "code"` tasks with `active: true` are gated. `PreCompact` mirrors a
compact resume packet to `<session_id>.resume.json`.

## Hooks are safe by design

Every script wraps stdin parsing in try/catch, never throws, and defaults to the
safe non-disruptive action (exit 0) on any error — the single exception being the
deliberate `Stop` gate block (exit 2 with a stderr reason). Scripts use only Node
built-ins. Config is read from `~/.claude/tokenseal/config.json`; if absent or
invalid, defaults apply.

## Presentation profiles

`config.presentation.verbosity` selects one of `detailed | summary | brief |
silent`. Profiles change only how much is explained — quality, verification, and
security behavior are identical across all of them.
