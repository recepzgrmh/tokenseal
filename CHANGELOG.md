# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-07-17

Initial release.

### Added

- **CLI** (`tokenseal`) with zero runtime dependencies:
  `setup`, `doctor`, `status`, `config`, `audit`, `explain-last`, `benchmark`,
  `uninstall`. `--json` output on the read-only commands.
- **User-scope installer** built on Claude Code's own marketplace + plugin
  machinery (`marketplace add` + `plugin install --scope user`), idempotent with
  rollback and `settings.json` backup/restore.
- **Claude Code plugin**: 8 agents, 8 skills, deterministic hooks (SessionStart,
  UserPromptSubmit, PostToolUse, Stop completion-gate, PreCompact), a status
  line, and 4 verbosity output styles.
- **Adaptive output filters** with full-output recovery and secret masking;
  failing output is always preserved.
- **Task receipts** (schema v1), secret-masked and rotated (newest 50).
- **Git snapshot / checkpoint** with user-vs-agent change separation.
- **Completion gate** state machine with bounded retries (≤2 revisions,
  1 escalation).
- **Capability matrix** driving progressive enhancement + safe fallbacks.
- **Central model-class + effort routing** policy.
- Deterministic **eval suite** (15 scenarios, two-sided) + runner.
- Docs, ADRs, CI (multi-OS), CodeQL, release workflow, issue/PR templates.

### Security

- Telemetry off and local-only. No shell-string injection (argv arrays only).
  Path canonicalization + symlink guard. Committed lockfile.

[Unreleased]: https://github.com/tokenseal/tokenseal/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/tokenseal/tokenseal/releases/tag/v0.1.0
