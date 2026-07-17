# Architecture

TokenSeal is two cooperating pieces plus a shared data directory.

```
                 you run
                 ┌────────┐
                 │ claude │
                 └───┬────┘
                     │ loads (user scope)
          ┌──────────▼───────────┐        installs / manages
          │  TokenSeal plugin    │◀───────────────────────────┐
          │  plugin/**           │                            │
          └──────────┬───────────┘                    ┌───────┴─────────┐
                     │ reads/writes                    │  tokenseal CLI  │
                     ▼                                 │  src/**         │
          ┌──────────────────────┐                    └───────┬─────────┘
          │  ~/.claude/tokenseal/ │◀────────────────────────────┘
          └──────────────────────┘
```

## 1. The CLI (`src/**`)

A Node/TypeScript CLI with **zero runtime dependencies**. It never makes LLM
calls; it does local analysis and installation only. Entry point:
`src/cli/index.ts`, dispatching to handlers in `src/cli/commands.ts`.

Commands: `setup`, `doctor`, `status`, `config`, `audit`, `explain-last`,
`benchmark`, `uninstall` (plus `version`/`help`).

Key libraries under `src/`:

| Area | Path | Responsibility |
| --- | --- | --- |
| Installer | `src/installer/` | marketplace build, plugin install/uninstall, settings merge |
| Filters | `src/filters/` | adaptive output filtering + failure preservation |
| Context | `src/context/` | context budget accounting |
| Capabilities | `src/capabilities/` | detect installed Claude Code features + fallbacks |
| Config | `src/config/` | schema, store, validate, migrate, model routing |
| Review | `src/review/` | bounded retry/escalation + completion state machine |
| Receipts | `src/receipts/` | task receipt schema + rotated store |
| Security | `src/security/` | secret masking |
| Git | `src/git/` | working-tree snapshots + porcelain parsing |
| Audit | `src/audit/` | read-only context inefficiency report |
| Benchmark | `src/benchmark/` | filter reduction on built-in samples |
| Utils | `src/utils/` | argv-array process runner, path guards, atomic FS, text |

## 2. The plugin (`plugin/**`)

The Claude Code runtime surface. Verified present and passes `claude plugin
validate`:

- **Manifest:** `plugin/.claude-plugin/plugin.json`.
- **8 agents** (`plugin/agents/<name>/claude.md`): `task-router`,
  `codebase-explorer`, `implementation-agent`, `verifier`, `final-reviewer`,
  `review-fixer`, `security-reviewer`, `receipt-explainer`. Each declares a
  `model` mapped to a class — low-cost = `haiku`, balanced = `sonnet`,
  strongest = `opus`.
- **8 skills** (`plugin/skills/<name>/SKILL.md`): `plan`, `implement`, `debug`,
  `verify`, `review`, `explain-last`, `context-audit`, `git-checkpoint`.
- **Deterministic hooks** (`plugin/hooks/hooks.json` + `plugin/scripts/`):
  `SessionStart`, `UserPromptSubmit`, `PostToolUse:Bash`, `Stop` (completion
  gate), `PreCompact`. Hook scripts are dependency-free `.mjs`.
- **Status line:** `plugin/scripts/statusline.mjs`.
- **4 output styles** (`plugin/output-styles/`): `detailed`, `summary`, `brief`,
  `silent`.

The completion-gate decision is pure and unit-tested in
`plugin/scripts/lib/gate.mjs` (`decideStop`); the `Stop` hook script reads task
state and delegates to it.

## 3. Shared data (`~/.claude/tokenseal/`)

- `config.json` — presentation preferences and mode (mode `0600` expected).
- `receipts/` — per-task JSON receipts (schema v1, masked, newest 50 kept).
- `marketplace/` — the local marketplace copy the installer builds.

Nothing TokenSeal owns is written into a user's project source tree.

## Boundaries (file ownership)

- `src/**` = CLI + local analysis libraries (no LLM calls).
- `plugin/**` = Claude Code runtime (instructions, skills, agents, hooks,
  status line, output styles). Hook scripts stay dependency-free.
- Shared user data lives under `~/.claude/tokenseal/`.

See [`context-management.md`](context-management.md),
[`model-routing.md`](model-routing.md), [`final-review.md`](final-review.md),
[`git-checkpoints.md`](git-checkpoints.md), [`security.md`](security.md), and the
ADRs in [`adr/`](adr/).
