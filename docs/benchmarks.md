# Benchmarks & Honesty

## What `tokenseal benchmark` measures

Exactly one thing: how much the output filters shrink a set of **built-in sample
outputs** (in approximate tokens), while confirming the full output stays
recoverable. Run it:

```bash
npx tokenseal benchmark          # human-readable
npx tokenseal benchmark --json   # machine-readable
```

The samples (`tests`/`src/benchmark/benchmark.ts`) are deterministic:
passing-test flood, large JSON, failing-test output, noisy bash, and a tiny
output. Representative results **on those samples**:

| Sample | Strategy | Approx. reduction |
| --- | --- | --- |
| large JSON | `json-summary` | ~99% |
| noisy bash | `bash-tail` | ~97% |
| passing tests | `test-passing-compact` | ~70% |
| failing tests | `failure-preserve` | ~33% (error preserved) |
| tiny output | `passthrough` | 0% (not over-processed) |

Notice the failing-test case is *low* on purpose — the error is preserved, which
is the point.

## Measured A/B — cost-aware model routing (the headline result)

On a **real 75k-line Flutter codebase** (196 Dart files), same architecture-analysis
prompt, real `claude -p --output-format=json`, single trial each:

| Arm | Cost | Models used | Quality (5 sections) |
| --- | --- | --- | --- |
| Baseline (all Opus) | **$4.07** | opus only (out 47k) | ✓✓✓✓✓ |
| TokenSeal (delegation) | **$1.28 (−68.5%)** | opus orchestrate ($0.70) + **haiku exploration** ($0.58, out 24k) | ✓✓✓✓✓ |

Both reports covered all five requested sections with comparable length
(~12.3k vs ~10.0k chars) and specificity. The cost drop comes from Haiku doing
the heavy multi-file reading instead of Opus. Requires the task to be large
enough that the model delegates — on small tasks there is nothing to route.

Honesty: n=1 per arm — directional, not a controlled study. An earlier attempt at
this A/B was **invalidated** because the TokenSeal arm hit a 429 rate limit
mid-run; we re-ran it cleanly before reporting. Run it on your own project.

## Measured A/B — output-verbosity compression

Beyond the filter samples, we ran controlled A/B tests with the real Claude Code
binary (`claude -p --output-format=json`), same prompt, two arms: a clean HOME vs
a HOME with TokenSeal installed. Small n (2 trials/arm) — directional, not a
controlled study — but the mechanism is clear:

| Task type | Arm | Output tokens | Notes |
| --- | --- | --- | --- |
| **Output-heavy** (explain TCP handshake) | baseline | ~1442 | verbose prose |
| | TokenSeal `brief` | ~913 | **−36.7%**, all required facts retained |
| **Terse** (count matching log lines → "7") | baseline | ~146 | one-line answer |
| | TokenSeal (default) | ~173 | **+3.6% (net-negative)** — nothing to compress |

Takeaways, stated plainly:

- The **`brief`/`silent` profiles genuinely reduce output tokens** (~37% here) on
  verbose work, with quality retained — this is TokenSeal's real efficiency lever.
- On **terse** tasks there is nothing to compress, so the small per-session
  context injection makes TokenSeal **net-negative**. Pick the profile to your
  workload.
- Output tokens are the reliable signal; `cache_creation`/cost figures in these
  runs are noisy (cache warmup) and are not headlined.

## Honesty caveat

These are **filter-only reductions on sample outputs, not an end-to-end session
guarantee.** TokenSeal does **not** claim any end-to-end token-percentage or
success-rate improvement — none has been measured on real sessions.

> **Savings vary by workload. Run `tokenseal benchmark` on your own project.**

## How a real optimization earns "on by default"

An optimization stays enabled only if, versus the no-TokenSeal baseline, it:

- reduces total tokens/cost,
- does **not** materially lower success rate,
- does **not** increase retries,
- does **not** increase reviewer findings,
- does **not** hide a security signal,
- does **not** cost the user needed information.

Input-token reduction alone is **not** success. A filter that regresses quality is
disabled. The `shadow` mode (config) is designed to measure a candidate
optimization without changing behavior before it is ever made a default.

## Not included

No published percentages, fake badges, fake user counts, or fabricated
transcripts. If a number isn't produced by `tokenseal benchmark` or a committed
test, it doesn't go in the docs.
