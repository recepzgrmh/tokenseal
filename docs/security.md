# Security Design

See [`../SECURITY.md`](../SECURITY.md) for the policy and reporting process. This
document describes how the guarantees are implemented.

## Process execution — no shell injection

All subprocesses go through `run()` in `src/utils/proc.ts`, which uses `execFile`
semantics with an explicit argv array and `shell: false`. `run()` rejects a
non-array `args` argument, so a caller can't accidentally pass a joined string.
User/tool input is never concatenated into a command line.

## Path safety — traversal & symlink guard

`src/utils/paths.ts`:

- `canonicalize` / `realpathBestEffort` resolve a path, following symlinks for the
  existing ancestor even when the leaf is new.
- `assertWithinRoot(target, root)` throws unless the resolved target is inside the
  resolved root — the single choke point for destructive operations.
- `looksLikeTraversal` flags absolute or `..`-climbing inputs.

## Secret masking

`src/security/masking.ts` redacts high-signal shapes (Anthropic/OpenAI/GitHub/AWS/
Google/Slack keys, JWTs, private-key blocks, bearer tokens, `basic-auth` URLs) and
`KEY=secret` / `KEY: secret` assignments (keeping the key name, masking the
value). `maskDeep` walks objects/arrays. Applied before writing receipts, filtered
output, and temp files. It is defense-in-depth, not a guarantee — never store a
secret intentionally.

## Filesystem writes

Config and receipts are written atomically (`src/utils/fs-atomic.ts`: temp file +
rename) with restrictive permissions (`0600` for config). Install backs up any
file it edits and can restore it.

## Install / uninstall

Installation uses Claude Code's own marketplace + plugin machinery, so it is
idempotent and reversible via `claude plugin uninstall`. `~/.claude/settings.json`
is backed up before edit; only a `statusLine` is added, and only if you have none.
Uninstall restores the pre-install state and tidies the empty containers Claude
Code leaves behind.

## Telemetry

Off and local-only in v0.1.0. The config schema pins
`telemetry: { enabled: false, localOnly: true }` and validation **rejects** a
config that tries to enable it. No network calls are made by the CLI except the
`claude` subcommands it shells out to during install.

## Supply chain

Zero runtime dependencies; committed lockfile. CI runs CodeQL and `npm audit`.
The release workflow verifies the tag matches `package.json` and that the packed
tarball contains only `dist/` + `plugin/` + docs (no tests, receipts, or env).
