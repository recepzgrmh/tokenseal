# Contributing to TokenSeal

Thanks for your interest! TokenSeal follows the same rules it enforces: think
before coding, prefer the simplest sufficient solution, make surgical changes,
and never claim done without evidence.

## Getting started

```bash
git clone https://github.com/tokenseal/tokenseal
cd tokenseal
npm install
npm run typecheck && npm run lint && npm test && npm run build
```

Node.js >= 20.11 is required (developed on Node 26, which runs the TypeScript
sources directly via type-stripping — no build step needed for tests).

## Definition of done (every PR)

All of these must pass locally and in CI:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # unit + integration
npm run build       # tsc -> dist/
npm run eval        # deterministic eval suite
npm pack --dry-run  # package stays clean (dist + plugin only)
```

Add or update tests for any behavior change. Security-sensitive code
(path/shell/secret handling, install/uninstall) is **test-first**.

## File-ownership boundaries

- `src/**` — the CLI and local analysis libraries. **No LLM calls.**
- `plugin/**` — the Claude Code runtime (agents, skills, hooks, status line,
  output styles). Hook scripts in `plugin/scripts/` use **only Node built-ins**.
- Shared user data lives under `~/.claude/tokenseal/` — never a user's project
  tree.

Keep changes surgical: touch only the files your change requires.

## Commits & versioning

- **Conventional Commits** (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, …).
- **Semantic Versioning.** User-facing changes update `CHANGELOG.md`.
- Never rewrite a user's git history; never commit secrets or local receipts.

## No unverified claims in docs

Do not add token-savings percentages or benchmark numbers that
`tokenseal benchmark` (or a committed test) does not actually produce.

## Good first issues

- Add an output-filter parser for a new test runner (Go / Rust / Ruby / .NET).
- Add a Windows integration fixture for the installer path.
- Add a new benchmark scenario from a real workload.
- Improve secret-masking patterns (with tests, including false-positive cases).
- Add a language-specific verification detector.

## Reporting security issues

See [`SECURITY.md`](SECURITY.md). Please do not open public issues for
vulnerabilities.
