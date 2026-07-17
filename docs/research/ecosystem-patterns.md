# Ecosystem Research — Patterns Adapted (and Avoided)

> Produced by the `ecosystem-researcher` subagent (read-only). Survey of Claude
> Code ecosystem projects + Anthropic engineering posts. **No code was copied.**
> See `THIRD_PARTY_NOTICES.md` for licensing conclusions.

## Licensing conclusions (drives what we may adapt)
| Project | License | Reuse |
| --- | --- | --- |
| obra/superpowers | MIT | Design adaptable **with attribution** |
| thedotmack/claude-mem | Apache-2.0 | Design adaptable **with attribution + NOTICE** |
| anthropics/claude-code | Proprietary | **Reference only**, no reuse |
| hesreallyhim/awesome-claude-code | Custom/NOASSERTION | Cite links only |
| worldflowai/everything-claude-code | **No LICENSE** | Ideas/heuristics only, no code |
| multica-ai/andrej-karpathy-skills | **No LICENSE** | Ideas/principles only, no code |

## Patterns adapted into TokenSeal
- **Filter-before-fetch** (claude-mem, Apache-2.0): compact ID/path index first,
  full detail only on request. → our receipt + explain-last design.
- **Lean always-on bootstrap + lazy skills** (superpowers MIT; Anthropic context
  engineering): never eagerly load skill bodies; rich `Use when…` triggers.
- **Deterministic completion gate via Stop hook + fresh-diff adversarial review
  scoped to correctness** (Anthropic best-practices): the four escalating gates
  (in-prompt check → goal re-check → Stop hook → verification subagent).
- **Two-sided evals** (Anthropic "Demystifying Evals"): test when a behavior
  should fire *and* when it should not; 15 real-failure tasks; 3 grader types;
  multiple trials; transcript separate from outcome.
- **Over-engineering / scope-creep detection** (karpathy principles + Claude
  Code's own over-engineering eval): flag diffs touching orthogonal code.
- **MCP/tool budget heuristic** (everything-claude-code, idea only): warn when
  many MCP servers / tools are active and shrinking the context window.

## Anti-patterns deliberately avoided
- Meta-skill that loads every skill body each session.
- Over-specified `CLAUDE.md` ("rules lost in noise").
- Per-tool-call memory writes (batch at session boundary instead).
- Premature full-detail fetch.
- `curl | sh` remote piping during install (supply-chain risk).
- Telemetry on by default (ours is **off**, local-only).
- Reviewer prompted to "find gaps" unbounded → over-engineering; ours is scoped
  to correctness + requirements.

## Eval approaches borrowed conceptually
- Red/green TDD with verification-before-completion (superpowers).
- 20–50 real-failure tasks, code + model + human graders, `pass@k` vs `pass^k`
  (Anthropic). We ship the 15 required scenarios as living regression tests.

Sources: superpowers, everything-claude-code, claude-mem, anthropics/claude-code,
awesome-claude-code, andrej-karpathy-skills; Anthropic posts: Claude Code Best
Practices, Effective Context Engineering, Building Effective Agents, Demystifying
Evals for AI Agents.
