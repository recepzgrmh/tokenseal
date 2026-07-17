# Implementation Plan

This records the workstreams as actually built for v0.1.0. Each was owned by a
subagent or the orchestrator with strict file ownership and an evidence gate.

## Workstreams

### Foundation (orchestrator)
- **Files:** `package.json`, `tsconfig*.json`, `eslint.config.js`, `.prettierrc`,
  `src/utils/**`, `src/security/masking.ts`, `src/capabilities/**`,
  `src/config/**`.
- **Acceptance:** zero runtime deps; Node-native TS; config schema/validate/
  migrate/store; path/proc/fs safety; capability matrix; model routing.
- **Verification:** `npm run typecheck/lint/test/build`. ✅

### Context filters + budget (`context-efficiency-engineer`)
- **Files:** `src/filters/**`, `src/context/**`, filter tests.
- **Acceptance:** adaptive strategies; failing output preserved; full output
  recoverable; secrets masked; CRLF-safe; budget checks.
- **Verification:** filter/budget unit tests. ✅ (16 tests)

### Git + receipts + review (`git-receipts-review-engineer`)
- **Files:** `src/git/**`, `src/receipts/**`, `src/review/**`, their tests.
- **Acceptance:** porcelain-v2 parsing; non-repo safe; receipt schema v1 +
  rotation + masking; bounded retry/escalation state machine + completion gate.
- **Verification:** git/receipts/review unit tests. ✅ (28 tests)

### Plugin (`plugin-engineer`)
- **Files:** `plugin/**`, plugin-hook test.
- **Acceptance:** manifest; 8 agents; 8 skills; deterministic hooks incl. Stop
  gate with loop guard; status line; 4 output styles; `claude plugin validate`
  passes.
- **Verification:** `node --check` on scripts; gate unit test; real validation. ✅

### CLI + installer + audit + benchmark (orchestrator)
- **Files:** `src/cli/**`, `src/installer/**`, `src/audit/**`, `src/benchmark/**`,
  their tests.
- **Acceptance:** 8 commands; wizard asks only the 4 UX/permission questions;
  install via Claude Code marketplace/plugin machinery; idempotent uninstall with
  rollback + settings restore.
- **Verification:** settings/install unit + integration tests (fake `claude`);
  real dogfood in a temp HOME. ✅

### Tests + evals (orchestrator)
- **Files:** `tests/**`.
- **Acceptance:** unit + integration + 15-scenario two-sided eval suite + runner.
- **Verification:** `npm test` (87), `npm run eval` (15/15). ✅

### Docs + release (orchestrator; docs subagent started, then completed by orchestrator after an API outage)
- **Files:** `README.md`, `docs/**`, `CHANGELOG/CONTRIBUTING/SECURITY/ROADMAP/
  THIRD_PARTY_NOTICES`, `.github/**`.
- **Acceptance:** only verified behavior documented; no fabricated numbers.

## Evidence gate

No workstream is "done" without: typecheck, lint, tests, build, and (for the
installer) a real setup/uninstall dogfood in an isolated HOME.
