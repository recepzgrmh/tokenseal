<p align="center">
  <img src="https://raw.githubusercontent.com/recepzgrmh/tokenseal/main/assets/logo.png" alt="TokenSeal" width="360">
</p>

<h1 align="center">TokenSeal&nbsp;🦭</h1>

<p align="center">
  <b>Seal token leaks. Ship reviewed code.</b><br>
  Install once, keep using <code>claude</code> — spend less, ship only reviewed AI code.
</p>

<p align="center">
  <img alt="License MIT" src="https://img.shields.io/badge/license-MIT-blue">
  <img alt="Node 20.11 plus" src="https://img.shields.io/badge/node-20.11%2B-brightgreen">
  <img alt="Claude Code 2.x" src="https://img.shields.io/badge/Claude%20Code-2.x-8A63D2">
  <img alt="Runtime deps 0" src="https://img.shields.io/badge/runtime%20deps-0-success">
</p>

---

## What it does, in one screen

TokenSeal is a **plugin for Claude Code**. You install it once and keep running
`claude` exactly as before. It does two things:

1. **Spends less** — routes the heavy grunt work (reading/searching your codebase)
   to a **cheap model (Haiku)** and keeps only the thinking on the expensive one
   (Opus). Same answer, much lower bill.
2. **Won't fake "done"** — an AI code change isn't finished until it's been
   independently **verified and reviewed** by a separate agent.

## 💸 Measured result (real test, not a claim)

Same prompt — *"analyze this codebase's architecture"* — on a **real 75,000-line
Flutter app**, run with the real `claude` CLI:

| | Without TokenSeal | **With TokenSeal** |
| --- | --- | --- |
| **Cost** | **$4.07** | **$1.28** &nbsp;→&nbsp; **−68.5%** |
| Who does the work | Opus does everything | Opus thinks · **Haiku reads** |
| Answer quality | all 5 sections ✓ | **all 5 sections ✓ (equal)** |

Where the money went:

```
Without TokenSeal   Opus reads all 196 files + writes report ........ $4.07

With TokenSeal      Opus   plan + synthesize the report ..... $0.70
                    Haiku  read all 196 files (~15× cheaper)  $0.58
                    ──────────────────────────────────────────────
                    Total ............................. $1.28  (−68.5%)
```

> Honest print: single trial (n=1), directional not a controlled study, and it
> only pays off on **big** tasks (a one-line answer has nothing to delegate — see
> [Limits](#honest-limits)). Run it on your own project: `tokenseal benchmark`.

## 🤖 How the agents work

Your prompt goes to the main model. For anything that needs heavy reading,
it **delegates to a cheaper-tier sub-agent** and keeps only the decisions:

```
your prompt
    │
    ▼
main model (Opus) ── plans, decides, synthesizes
    │  "go read the codebase"
    ▼
codebase-explorer (Haiku, ~15× cheaper) ── reads 196 files → returns a short summary
    │  compact summary (not the raw files)
    ▼
main model (Opus) ── writes the final answer
```

The bulk tokens burn on Haiku; Opus only sees a summary. Each built-in agent has a
fixed model tier so cheap work never touches an expensive model:

| Agent | Model tier | What it does |
| --- | --- | --- |
| `task-router` | Haiku · cheap | classify the request |
| `codebase-explorer` | Haiku · cheap | read/search files → summary |
| `receipt-explainer` | Haiku · cheap | answer "what did you do?" from the receipt |
| `implementation-agent` | Sonnet · mid | write the change (isolated worktree) |
| `verifier` | Sonnet · mid | run tests/lint/build, collect evidence |
| `review-fixer` | Sonnet · mid | apply the reviewer's required changes |
| `final-reviewer` | Opus · strong | approve / revise / escalate |
| `security-reviewer` | Opus · strong | security review of the diff |

Routing rule: **cheap** for search/log/receipt work, **mid** for implementation &
verification, **strong** for architecture, security, and the final review.

## ✅ The other half: no fake "done"

A model that writes code *and* declares it finished has a conflict of interest.
TokenSeal gates completion with **deterministic code**, not vibes:

```
implement → verify (tests/lint/build) → independent review
   approve  → done
   revise   → fixer agent  (max 2 tries)
   escalate → strongest model (max 1 try)
```

- A `Stop` hook **blocks turn-end** while a code task is unverified or not yet
  `approve`d (with a loop guard so it can never trap you).
- A **fresh-context reviewer** judges the diff and returns
  `approve | revise | escalate` — only `approve` clears the gate.
- The loop is provably bounded; it can't revise/escalate forever.

## Install

> Not on npm yet (publishing pending). Install from GitHub:

```bash
npm install -g github:recepzgrmh/tokenseal
# …or from a clone:  git clone … && cd tokenseal && npm install && npm link
```

Then set it up once (asks 4 quick questions about how chatty Claude should be):

```bash
tokenseal setup     # installs the plugin into ~/.claude, reversible
claude              # keep working exactly as before
```

Restart any open `claude` session so the plugin loads. You'll see a short
`🦭 TokenSeal active` line.

## Commands

```bash
tokenseal setup         # install + choose presentation profile
tokenseal doctor        # validate the install (--json)
tokenseal status        # plugin state + last task (--json)
tokenseal config        # change your presentation profile
tokenseal audit         # report context bloat (CLAUDE.md/MCP/memory) — read only
tokenseal explain-last  # summarize the most recent task from its receipt
tokenseal benchmark     # measure filter token reduction on samples (--json)
tokenseal uninstall     # remove + restore settings ( --purge --yes to wipe data )
```

## Profiles (verbosity only)

Four output styles — `detailed`, `summary`, `brief`, `silent`. They change **only
how much Claude talks**; quality, verification, and security are identical on all
of them. `brief`/`silent` also compress the model's prose — measured **~37% fewer
output tokens** on a verbose task, code/commands/errors kept byte-exact.

## Honest limits

- **Cost routing only pays off on big, exploration-heavy tasks.** On a one-line
  answer there's nothing to delegate, and TokenSeal's small per-session injection
  makes it slightly net-negative (~+3.6% measured). Savings vary by workload.
- **No automatic tool-output filtering.** Claude Code already caps >10k-char
  outputs, and (verified empirically) a `PostToolUse` hook can't replace tool
  output in 2.1.212. The filter library powers `tokenseal benchmark`/receipts, not
  a live interceptor.
- Delegation depends on the model actually choosing to delegate (TokenSeal nudges
  it, big tasks trigger it reliably).
- Windows installer path not verified yet — use WSL. Numbers here are n=1.

Full detail: [`docs/limitations.md`](docs/limitations.md),
[`docs/benchmarks.md`](docs/benchmarks.md).

## Security & privacy

- **Telemetry off, local-only.** Nothing leaves your machine; all data lives under
  `~/.claude/tokenseal/`.
- Never disables Claude Code's permissions; no `--dangerously-skip-permissions`.
- No shell-string injection (argv arrays only), path/symlink guards on deletes,
  secret masking before anything is written. Zero runtime deps, committed lockfile.

See [`SECURITY.md`](SECURITY.md) · [`docs/security.md`](docs/security.md).

## FAQ

**Do I run `tokenseal` per task?** No — `tokenseal setup` once, then just `claude`.

**Does it change my code or settings?** It installs a user-scope plugin via Claude
Code's own machinery, and only adds a `statusLine` if you have none (backed up
first). `audit`/`explain-last` are read-only. Uninstall restores everything.

**Does it send my code anywhere?** No. Telemetry is off and local-only.

**Not in a git repo?** Still works — git checkpointing falls back safely.

## Requirements

- **Node ≥ 20.11** to run (build-from-source needs ≥ 22.6). **Claude Code ≥ 2.0.0**
  (full features ≥ 2.1.128; verified on 2.1.212). macOS/Linux (Windows via WSL).

## More

Architecture, model routing, git checkpoints, and ADRs are in [`docs/`](docs/).
Contributions welcome — see [`CONTRIBUTING.md`](CONTRIBUTING.md).
Out-of-scope-for-v0.1 ideas are in [`ROADMAP.md`](ROADMAP.md).

MIT — see [`LICENSE`](LICENSE). Design attributions in
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
