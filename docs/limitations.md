# Limitations

TokenSeal aims to be honest about what it does and does not do in v0.1.0.

## Measurement

- **End-to-end token savings are unmeasured.** Only filter-on-sample reduction is
  measured (`tokenseal benchmark`). We publish no session-level percentage.
- Filter thresholds and context budgets are **safe, best-effort heuristics**, not
  proven-optimal values. They are tunable and benchmarkable.

## Runtime behavior we can't fully test offline

- Hook execution, skill triggering, subagent delegation, and worktree creation
  depend on a **live Claude Code session**. TokenSeal's deterministic *decision*
  logic (gate, routing, filters, state machine, parsing) is unit-tested, and the
  install/uninstall path is integration-tested against a fake `claude` binary and
  dogfooded against the real one — but true end-to-end orchestration is exercised
  by the runtime, not by CI.
- Output-filter heuristics recognize common test-runner/JSON/bash shapes; unusual
  formats fall back to safe passthrough or generic truncation.

## Environment

- **Windows install path is not yet verified.** The CLI logic, filters, config,
  and analysis are cross-platform and unit-tested, but the `tokenseal setup`
  installer shells out to the `claude` CLI, which on Windows is typically a
  `claude.cmd` shim that `execFile` (shell-less, by design) cannot resolve. The
  installer path is verified on **macOS and Linux**; a Windows installer fixture
  is tracked as work in progress (see `CONTRIBUTING.md`). Prefer WSL on Windows
  for now.
- **Worktree isolation** needs git and a recent Claude Code (≥ 2.1.128). Below
  that, or outside a git repo, TokenSeal degrades to snapshot-diff checkpoints.
- The completion gate relies on task state written by the plugin at runtime; if
  that state file is unwritable, the gate falls back to non-interference (it will
  not trap you) rather than blocking.
- Overlapping user + agent edits in the **same file** cannot be reliably
  attributed; TokenSeal flags this as a risk instead of guessing.

## Boundaries by design

- TokenSeal **never disables Claude Code's permission system** and cannot bypass
  approvals you would normally see.
- Secret masking is defense-in-depth, not a guarantee that every secret shape is
  caught.
- Temp files holding full (masked) output rely on the OS temp cleanup; they are
  not garbage-collected by TokenSeal in v0.1.0.
- No telemetry means TokenSeal cannot learn cross-session automatically; local
  `shadow`-mode observations only produce *suggestions*, never silent policy
  changes.
