# CLAUDE.md — TokenSeal

TokenSeal is an always-on efficiency + assurance layer for Claude Code: a
user-scope **plugin** plus a **Node/TypeScript CLI** that installs it. It wastes
fewer tokens and never lets AI-modified code be called "done" without independent
review.

## Core commands

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # node --test (unit + integration)
npm run build       # tsc -> dist/
npm run eval        # eval harness (simulated; no live API by default)
```

Run the CLI in dev without building: `npm run dev -- <command>`.

## Non-negotiable quality rules

- Zero runtime dependencies. Dev-only deps stay minimal.
- No `--dangerously-skip-permissions`; never disable Claude Code's permission system.
- Never build a shell command from untrusted input — use `run()` in `src/utils/proc.ts`.
- Every destructive filesystem op goes through `assertWithinRoot` (`src/utils/paths.ts`).
- Mask secrets (`src/security/masking.ts`) before persisting anything.
- Telemetry is off and local-only in v0.1.0.
- No "done" without evidence: tests/lint/typecheck/build must actually pass.

## Architecture boundaries (file ownership)

- `src/**` = the CLI + local analysis libraries (no LLM calls).
- `plugin/**` = Claude Code runtime (core instructions, skills, agents, hooks,
  status line, output styles). Hook scripts in `plugin/scripts/` stay dependency-free.
- Shared user data lives under `~/.claude/tokenseal/` (config, receipts) — never in
  a user's project source tree.

## How TokenSeal itself is built

TokenSeal's own development follows the rules it enforces: think before coding,
simplest sufficient solution, surgical changes, verifiable goals, root-cause fixes,
evidence before completion. Long procedures live in `plugin/skills/`, not here.

See `docs/IMPLEMENTATION_PLAN.md` and `docs/adr/` for design decisions.
