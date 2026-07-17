# ADR 0001: Zero runtime dependencies, Node-native TypeScript

## Status
Accepted

## Context
TokenSeal is a developer tool installed into users' environments. Every runtime
dependency is attack surface, install weight, and a potential supply-chain risk.
Node 20.11+ (and especially Node 23+/26) can run TypeScript directly via type
stripping, and ships a built-in test runner, arg parsing (`util.parseArgs`), and
readline.

## Decision
- **Zero runtime dependencies.** The published package contains only compiled
  `dist/` + `plugin/`.
- Dev-only tooling: TypeScript, ESLint (+ typescript-eslint), Prettier.
- Author in TypeScript; run tests with `node --test` over `.ts` via type
  stripping; build with `tsc` using `rewriteRelativeImportExtensions` so `.ts`
  imports emit as `.js`.

## Consequences
- Fast, low-risk installs; trivial `npm audit`; a small, auditable tarball.
- We forgo conveniences (e.g. a CLI framework, a schema library) in favor of a
  little hand-written code — acceptable for a small surface.
- Requires Node ≥ 20.11 (engines-enforced).
