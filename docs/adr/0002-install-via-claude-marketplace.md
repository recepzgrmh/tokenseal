# ADR 0002: Install via Claude Code's own marketplace/plugin machinery

## Status
Accepted

## Context
A user-scope plugin needs a reliable, reversible install. Two options: (a)
hand-edit `~/.claude/` (copy agents/skills, merge hooks into settings.json), or
(b) use Claude Code's own `claude plugin` machinery. Option (a) is fragile
(format drift, messy uninstall, `${CLAUDE_PLUGIN_ROOT}` won't resolve). Probing
2.1.212 confirmed `claude plugin marketplace add <path> --scope user` and
`claude plugin install <name>@<marketplace> --scope user` work non-interactively
from a local directory, and `claude plugin validate` validates manifests.

## Decision
Copy the shipped `plugin/` into a stable, user-owned marketplace at
`~/.claude/tokenseal/marketplace/`, then drive `marketplace add` + `install
--scope user` + `validate`. The only direct `settings.json` edit is adding a
`statusLine` (with backup) when the user has none. Uninstall reverses via
`plugin uninstall` + `marketplace remove`, tidies the empty containers Claude
Code leaves, and restores settings.

## Consequences
- Install/uninstall is idempotent and reversible; hooks resolve
  `${CLAUDE_PLUGIN_ROOT}` correctly because it's a real plugin.
- We depend on the `claude plugin` CLI surface; the capability matrix + doctor
  detect and report when it's unavailable.
- Verified end-to-end in an isolated HOME and by a fake-`claude` integration test.
