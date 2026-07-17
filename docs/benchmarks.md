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
