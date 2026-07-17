# ADR 0003: Deterministic Stop-hook completion gate

## Status
Accepted

## Context
The product promise is that AI code changes are not "done" until verified and
reviewed. If the guarantee depended on the model choosing to keep working, or on
an experimental LLM-based hook, it would be unreliable. Claude Code exposes a
`Stop` hook that can block turn-end (exit 2), plus `SubagentStop`/`PreCompact`.

## Decision
Enforce completion with a **deterministic command `Stop` hook** reading task
state from `~/.claude/tokenseal/state/<session>.json`, delegating to a pure
`decideStop(state)`:
- block only when an active *code* task is unverified or its final review ≠
  `approve`;
- allow when there's no state, on an `externalBlocker`, or after a 3-block loop
  guard.
The final review itself is a fresh-context subagent workflow returning structured
JSON; retries/escalation are bounded by a unit-tested state machine.

## Consequences
- The completion guarantee is deterministic and testable (`gate` unit test), not
  dependent on model whim or an experimental hook.
- Ordinary non-code sessions are never gated; the loop guard prevents traps.
- If the state file is unwritable, the gate degrades to non-interference.
