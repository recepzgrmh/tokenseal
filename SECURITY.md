# Security Policy

## Reporting a vulnerability

Please report suspected vulnerabilities privately via GitHub Security Advisories
("Report a vulnerability" on the repository's Security tab). Do not open a public
issue for a security report. We aim to acknowledge within a few business days.

## Supported versions

TokenSeal is pre-1.0. Security fixes land on the latest `0.x` release.

## Security guarantees (v0.1.0)

- **No telemetry.** Nothing is sent to any external server. All data stays under
  `~/.claude/tokenseal/`. (`docs/security.md` has the details.)
- **Permission system intact.** TokenSeal never disables Claude Code's permission
  system and never sets `--dangerously-skip-permissions`. It cannot approve
  actions on your behalf.
- **No shell injection.** Subprocesses are spawned with an explicit argv array
  (`src/utils/proc.ts`), never a concatenated shell string. `run()` rejects a
  non-array argument defensively.
- **Path safety.** Destructive filesystem operations pass through
  `assertWithinRoot` (`src/utils/paths.ts`), which canonicalizes the path,
  resolves symlinks in the existing ancestor, and refuses anything escaping the
  allowed root.
- **Secret masking.** `src/security/masking.ts` redacts common credential shapes
  (API keys, tokens, private-key blocks, `KEY=secret` assignments) before any
  text is written to a receipt, a filtered-output temp file, or a log.
- **Reversible install.** Setup backs up `~/.claude/settings.json` before editing
  and only adds a `statusLine` if you have none. Uninstall restores the
  pre-install state and is idempotent.
- **Supply chain.** Zero runtime dependencies; the lockfile is committed; CI runs
  CodeQL and `npm audit`.

## Scope / non-goals

TokenSeal is a local developer tool. It does not sandbox the code your agent
writes, and it relies on Claude Code's own permission prompts for approval of
risky actions. Masking is defense-in-depth, not a guarantee that every possible
secret shape is caught — never rely on it as your only safeguard.
