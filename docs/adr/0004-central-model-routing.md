# ADR 0004: Central model-class + effort routing

## Status
Accepted

## Context
Concrete model version names are short-lived and change often. Scattering them
across agents/skills would make upgrades error-prone and could emit unsupported
effort values on older Claude Code builds. Model choice and reasoning effort are
independent decisions.

## Decision
Define one policy in `src/config/model-routing.ts`: model **classes**
(`low-cost`/`balanced`/`strongest`) mapping to Claude Code aliases
(`haiku`/`sonnet`/`opus`), a separate **effort** axis, and a `ROUTES` table by
task role. `resolveEffort` clamps effort to what the capability matrix reports as
supported. Routing optimizes **cost per successful task**, not per-call price.

## Consequences
- Model upgrades are a one-line change; the rest of the system refers to classes.
- No unsupported effort values are ever written.
- Routing rationale is measurable (retries, rejection rate, tokens per accepted
  change) rather than assumed.
