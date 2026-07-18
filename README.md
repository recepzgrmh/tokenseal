<p align="center">
  <img src="https://raw.githubusercontent.com/recepzgrmh/tokenseal/main/assets/logo.png" alt="TokenSeal" width="380">
</p>

<h1 align="center">TokenSeal&nbsp;🦭</h1>

<p align="center">
  <b>Seal token leaks. Ship reviewed code.</b><br>
  An always-on efficiency &amp; assurance layer for Claude Code.
</p>

<p align="center">
  <code>tokenseal setup</code> &nbsp;·&nbsp; then keep using <code>claude</code>
</p>

<p align="center">
  <img alt="License MIT" src="https://img.shields.io/badge/license-MIT-blue">
  <img alt="Node 20.11 plus" src="https://img.shields.io/badge/node-20.11%2B-brightgreen">
  <img alt="Claude Code 2.x" src="https://img.shields.io/badge/Claude%20Code-2.x-8A63D2">
  <img alt="Runtime deps 0" src="https://img.shields.io/badge/runtime%20deps-0-success">
</p>

---

> **Install once. Keep using Claude Code normally. Waste fewer tokens. Never ship
> unreviewed AI code.**

TokenSeal is not a new agent, a new chat UI, or a wrapper you have to route your
work through. You install it once, then keep running `claude` exactly as you do
today. It works in the background to (1) stop verbose tool output from silently
burning your context window and (2) refuse to call an AI code change "done"
until it has been independently verified and reviewed.

## The problem

Two things quietly cost you when coding with an AI agent:

- **Token leaks.** A single `cat data.json`, a 300-line passing test log, or a
  noisy install script can dump thousands of tokens into your context window.
  You pay for them, and they crowd out the code that actually matters.
- **Unreviewed "done".** An agent that both writes code *and* declares it
  finished has an obvious conflict of interest. "All done!" is not the same as
  "verified and reviewed."

TokenSeal addresses both with deterministic machinery, not vibes.

## What it is

TokenSeal has two parts:

1. **A Claude Code plugin** (installed at *user* scope) — agents, skills,
   deterministic hooks, a status line, and output styles that shape how your
   sessions run.
2. **A Node/TypeScript CLI** (`tokenseal`) — installs and manages the plugin,
   and gives you local, read-only tools (`doctor`, `status`, `audit`,
   `explain-last`, `benchmark`). Zero runtime dependencies.

## Installation

> **Not on npm yet.** `npx tokenseal` will work once v0.1.0 is published. Until
> then, install from GitHub or from a local clone:

```bash
# From GitHub (builds on install)
npm install -g github:recepzgrmh/tokenseal

# …or from a local clone
git clone https://github.com/recepzgrmh/tokenseal
cd tokenseal && npm install && npm link
```

Either way you then have a global `tokenseal` command.

## 30-second quickstart

```bash
# 1. Install the plugin at user scope (interactive; asks a few presentation questions)
tokenseal setup

# 2. Keep working exactly as before
claude

# 3. Anytime, inspect what TokenSeal is doing (all read-only)
tokenseal status        # plugin + last task
tokenseal doctor        # validate the installation
tokenseal audit         # report context inefficiencies (changes nothing)
tokenseal explain-last  # summarize the most recent task receipt
tokenseal benchmark     # filter token reduction on sample outputs
```

Non-interactive install: `tokenseal setup --yes`.

## Architecture

```
                 you run
                 ┌────────┐
                 │ claude │  ← unchanged; you keep using Claude Code normally
                 └───┬────┘
                     │ loads (user scope)
          ┌──────────▼───────────┐        installs / manages
          │  TokenSeal plugin    │◀───────────────────────────┐
          │  ──────────────────  │                            │
          │  8 agents            │                    ┌────────┴────────┐
          │  8 skills            │                    │  tokenseal CLI  │
          │  hooks (Stop gate,   │                    │  (zero deps)    │
          │   SessionStart, …)   │                    │  setup/doctor/  │
          │  status line         │                    │  status/audit/  │
          │  4 output styles     │                    │  explain-last/  │
          └──────────┬───────────┘                    │  benchmark/     │
                     │ reads/writes                    │  uninstall      │
                     ▼                                 └────────┬────────┘
          ┌──────────────────────┐                             │
          │  ~/.claude/tokenseal/ │◀────────────────────────────┘
          │  ──────────────────  │
          │  config.json          │  presentation prefs
          │  receipts/            │  per-task JSON (masked, rotated, newest 50)
          │  marketplace/         │  local plugin marketplace copy
          └──────────────────────┘
```

The CLI never makes LLM calls — it only does local analysis and installation.
All shared user data lives under `~/.claude/tokenseal/`, never inside your
project source tree.

## How it saves tokens (and where it doesn't)

**Primary lever — cost-aware model routing.** For substantial exploration,
search, and analysis, TokenSeal delegates the grunt work to a cheaper-tier
subagent (`codebase-explorer` on Haiku) and keeps only synthesis and decisions
on the expensive model. Because Haiku is ~15× cheaper per token than Opus,
moving the bulk reading off the main model cuts cost sharply.

Measured A/B on a **real 75k-line Flutter codebase** (real `claude -p`,
"analyze the architecture" task, same prompt, single trial each):

| | Baseline (all Opus) | TokenSeal (delegation) |
| --- | --- | --- |
| Cost | **$4.07** | **$1.28** (**−68.5%**) |
| Models | Opus only | Opus (orchestrate) + Haiku (24k-token exploration) |
| Quality | all 5 report sections | **all 5 — equal** |

The saving only materializes when the task is **big enough to delegate**; on a
small task the model just does it directly and there is nothing to route
(single trial, n=1 — directional, not a controlled study; run your own).

**Secondary lever — output-verbosity compression.** The `brief`/`silent`
profiles inject concrete rules that cut the model's prose — no preamble, no
restating the question, terse lists — while keeping all code, commands, and
errors byte-for-byte exact. Measured **~37% fewer output tokens** on a verbose
task with full quality retention (the same mechanism `caveman` uses).

**Honest scope of that saving:**

- It only helps on **output-heavy** work. On a task whose answer is one line,
  there is nothing to compress and TokenSeal's small per-session context
  injection makes it **net-negative** (we measured ~+3.6% on a single-number
  task). Savings vary by workload — run `tokenseal benchmark` and measure your own.
- TokenSeal does **not** automatically filter/replace tool output in a live
  session. Claude Code already caps tool results over ~10,000 chars to a file +
  preview, and in 2.1.212 a `PostToolUse` hook cannot replace the result the
  model ingests (we verified this empirically). The filter library
  (`src/filters`) powers `tokenseal benchmark` and receipts, not an automatic
  session interceptor.

Secondary levers:

- **Context hygiene.** `tokenseal audit` (read-only) flags an oversized
  CLAUDE.md, too many MCP servers, or bloated memory that inflate every session's
  input tokens — you decide what to trim.
- **Subagent isolation.** Exploration/review run as scoped subagents so bulk
  reading stays out of your main thread (reduces context *pressure*; total tokens
  depend on delegation actually happening).
- **Receipts instead of re-reading.** "What did you just do?" is answered from a
  small JSON receipt, not by re-scanning the session. Receipts are never
  auto-loaded and are **secret-masked**.

See [`docs/benchmarks.md`](docs/benchmarks.md) for the measured numbers and
method, and [`docs/limitations.md`](docs/limitations.md) for the empirical hook
finding.

## How it protects quality

Completion is gated by deterministic code, not by the model deciding it feels
finished.

- **Deterministic Stop completion gate.** A `Stop` hook blocks turn-end while an
  active *code* task is either unverified or its final review is not `approve`.
  It has a loop guard (releases after 3 blocks) and always allows stop when an
  external blocker is set (you or a dependency). If there is no task state, it
  never interferes with an ordinary session.
- **Fresh-context final review.** An independent reviewer agent judges the
  verified change and returns structured JSON:

  ```json
  {
    "decision": "approve",
    "confidence": 0.9,
    "blockingIssues": [],
    "nonBlockingIssues": ["consider a follow-up test for the empty-input case"],
    "requiredChanges": [],
    "verificationRequired": false,
    "recommendedModelClass": "balanced"
  }
  ```

  `decision` is one of `approve | revise | escalate`. Only `approve` clears the
  gate.
- **Bounded retries and escalation.** At most **2** evidence-based revisions,
  then **1** escalation to the strongest model class. The loop is provably
  bounded — it can never revise or escalate forever; the only remaining exit is
  back to you.

See [`docs/final-review.md`](docs/final-review.md).

## Silent mode

TokenSeal ships four output styles — `detailed`, `summary`, `brief`, and
`silent`. Presentation is the *only* thing these change: **quality,
verification, and security are identical on every profile.** Silent mode keeps
the machinery fully active while staying out of your way:

```
$ claude
> add pagination to the users endpoint

  … (TokenSeal runs plan → implement → verify → review silently) …

  ✔ done · verified · reviewed (approve)
```

Pick your profile during `tokenseal setup`, or change it later with
`tokenseal config`.

## Git checkpoints

Before an agent task modifies your tree, TokenSeal captures a snapshot of the
working tree (staged / unstaged / untracked) so the files *you* had already
dirtied can be told apart from the files the *agent* changed. Where the installed
Claude Code supports worktree isolation, subagents run isolated; where it does
not (or you are not in a git repo), TokenSeal falls back to **snapshot-diff
checkpoints**. Snapshots are best-effort: a missing `git` binary or a non-repo
yields an inert snapshot rather than an error, so a checkpoint can never break a
task. See [`docs/git-checkpoints.md`](docs/git-checkpoints.md).

## Benchmark methodology and honesty

Run it yourself:

```bash
tokenseal benchmark          # human-readable
tokenseal benchmark --json   # machine-readable
```

`tokenseal benchmark` measures exactly **one** thing: how much the output
filters shrink a set of **built-in sample outputs** (in approximate tokens),
while confirming the full output stays recoverable. On those samples you will
see, for example, a large-JSON blob summarized by roughly ~99%, passing-test
output reduced by roughly ~70%, failing-test output *preserved* (so only ~33%),
and an aggregate around ~95% **across those samples**.

**Honesty caveat.** These are **filter-only reductions on sample outputs, not an
end-to-end session guarantee.** TokenSeal does **not** claim any end-to-end token
% or success-rate improvement — none has been measured. **Savings vary by
workload. Run `tokenseal benchmark` on your own project.** See
[`docs/benchmarks.md`](docs/benchmarks.md).

## Real limitations

Read [`docs/limitations.md`](docs/limitations.md) in full. The short version:

- Hooks and agent behavior cannot be fully integration-tested without a live
  Claude Code session; the deterministic *decision* logic is unit-tested, but
  end-to-end orchestration depends on the runtime.
- Filter thresholds are safe, best-effort heuristics — not proven-optimal.
- End-to-end token savings are **unmeasured**; only filter-on-sample reduction is
  measured.
- Worktree isolation needs git and a recent Claude Code; otherwise TokenSeal
  degrades to snapshot-diff checkpoints.
- TokenSeal never disables Claude Code's permission system, so it cannot and does
  not bypass any approval you would normally see.

## Security and privacy

- **Telemetry is off and local-only** in v0.1.0. Nothing is phoned home.
- Never disables Claude Code's permission system; no
  `--dangerously-skip-permissions`.
- No shell-string injection — subprocesses are invoked with argv arrays, never a
  concatenated shell string.
- Path canonicalization + allowed-root + symlink guard on destructive filesystem
  ops.
- Secret masking before anything is stored (receipts, filtered output, temp
  files).
- The lockfile is committed. Zero runtime dependencies.

See [`SECURITY.md`](SECURITY.md) and [`docs/security.md`](docs/security.md).

## Uninstall

```bash
tokenseal uninstall              # remove plugin; restore settings backup; keep your data
tokenseal uninstall --purge --yes  # also delete ~/.claude/tokenseal/ (config + receipts)
```

Uninstall reverses everything setup did and restores `~/.claude/settings.json`
to its pre-install state. It is idempotent.

## Requirements

- **Node.js >= 20.11** to run the published CLI (developed and verified on Node
  26). Building/testing from source needs **Node >= 22.6** (TypeScript
  type-stripping).
- **Claude Code >= 2.0.0** minimum. Full worktree isolation and compaction-aware
  checkpoints need **>= 2.1.128**; below that, TokenSeal degrades gracefully to
  snapshot-diff fallbacks. Developed and verified against Claude Code 2.1.212.
- **OS:** the installer is verified on **macOS and Linux**. Windows support is in
  progress — use WSL for now (see [`docs/limitations.md`](docs/limitations.md)).

## FAQ

**Do I run `tokenseal` for every task?**
No. You run `tokenseal setup` once, then just use `claude`. There is no
`tokenseal run` per task.

**Does it change my code or my Claude Code settings?**
It installs a user-scope plugin via Claude Code's own plugin machinery. It only
adds a `statusLine` to `~/.claude/settings.json` if you don't already have one,
and it backs the file up first. `audit` and `explain-last` are strictly
read-only.

**Will it slow me down / get in the way?**
Presentation is configurable down to silent. The completion gate only engages
for active code tasks and has a loop guard; ordinary chats are never gated.

**Does it send my code anywhere?**
No. Telemetry is off and local-only in v0.1.0.

**What if I'm not in a git repo?**
It still works. Git-dependent checkpointing falls back to inert/snapshot
behavior; nothing breaks.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). TokenSeal follows the rules it
enforces: conventional commits, and `npm run typecheck / lint / test / build`
must pass. File-ownership boundaries are strict — `src/**` is the CLI and local
analysis (no LLM calls); `plugin/**` is the Claude Code runtime.

## Roadmap

See [`ROADMAP.md`](ROADMAP.md) for what is intentionally **out of scope** for
v0.1 (and thus candidate future work), and
[`CHANGELOG.md`](CHANGELOG.md) for release history.

## License

MIT — see [`LICENSE`](LICENSE). Third-party design attributions are in
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
