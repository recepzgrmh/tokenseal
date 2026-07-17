# Troubleshooting

Start with:

```bash
npx tokenseal doctor          # or: npx tokenseal doctor --json
```

`doctor` validates Claude Code presence/version, config, the plugin source +
install, the marketplace copy, the status line, git/worktree support, and the
data/state dirs.

## "Claude Code CLI not found"

Install Claude Code and ensure `claude` is on your PATH, then re-run
`tokenseal setup`. Check with `claude --version` (TokenSeal needs ≥ 2.0.0).

## The plugin isn't active in my session

- `npx tokenseal doctor` — check `plugin-installed` and `plugin-valid`.
- `claude plugin list` — confirm `tokenseal@tokenseal-marketplace` is enabled.
- Restart your `claude` session; plugin changes apply on the next session.

## The status line didn't change

TokenSeal only sets a `statusLine` if you don't already have one (it won't
clobber yours). If you had one, keep it — or point it at
`~/.claude/tokenseal/marketplace/plugin/scripts/statusline.mjs` yourself.

## Claude seems "stuck" finishing a task

The completion gate blocks turn-end until an active code task is verified and
review-approved. It releases automatically after 3 blocks (loop guard) and always
allows stopping on a genuine external blocker. If you believe a stop is wrong, the
block reason on screen explains what's missing (verification or approval).

## Uninstall / reset

```bash
npx tokenseal uninstall                # reverse install, restore settings, keep data
npx tokenseal uninstall --purge --yes  # also delete ~/.claude/tokenseal/
```

Both are idempotent — safe to run again if a previous run was interrupted.

## Filed output looks truncated

Filtering is adaptive and the **full output is always recoverable** from the temp
path shown in the filtered summary. Ask Claude for the full output, or set the
detail level to full. Failing output is never truncated past its error.

## Config problems

`npx tokenseal config --show` prints the active config; `--path` prints its
location (`~/.claude/tokenseal/config.json`). A corrupt config is auto-reset to
safe defaults on load (doctor will note it).
