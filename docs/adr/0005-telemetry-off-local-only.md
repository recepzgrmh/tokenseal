# ADR 0005: Telemetry off, local-only

## Status
Accepted

## Context
Efficiency tooling benefits from measurement, but sending a user's code, prompts,
or metrics to an external server is a privacy and trust liability — and several
ecosystem tools default telemetry ON, which we consider an anti-pattern. TokenSeal
targets a viral, trustworthy first-run experience.

## Decision
In v0.1.0, **no telemetry**. The config schema pins
`telemetry: { enabled: false, localOnly: true }`, and config validation
**rejects** any attempt to enable it. All measurement (benchmark, future `shadow`
mode) stays on the local machine and produces only suggestions, never silent
policy changes or network calls. Install performs no `curl | sh` remote piping.

## Consequences
- Users can adopt TokenSeal without a data-egress review.
- We can't aggregate cross-user metrics; that's an acceptable v0.1 trade-off and a
  deliberate future-work boundary (see ROADMAP).
- Any future opt-in telemetry must be explicit, documented, and off by default.
