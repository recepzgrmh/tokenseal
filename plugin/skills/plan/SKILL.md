---
name: plan
description: Use when a request is multi-step, ambiguous, risky, or spans several files and needs to be turned into an explicit, verifiable plan before any code is written.
---

# Plan a task before coding

Goal: convert a fuzzy request into the smallest plan of verifiable goals. Plan, do not implement.

## Steps
1. **Restate the objective** as one sentence that is checkable ("done when X observably happens"). If you cannot, ask one clarifying question.
2. **Locate the surface.** Use the `codebase-explorer` agent (or Grep/Glob) to find the files, symbols, and contracts involved. Note invariants the change must preserve.
3. **Choose the simplest sufficient approach.** Reject speculative abstractions and unrelated refactors. Prefer a surgical change.
4. **Decompose** into ordered steps, each with its own verifiable check. Flag risky/destructive steps.
5. **Define the completion gate up front:** how it will be verified (which flow/tests), and that final review must return `approve`.

## Output
A short plan: objective, ordered steps (each with its check), files to touch, risks, and the verification/review plan. Then hand off to `implement`.

Context for this run: $ARGUMENTS
