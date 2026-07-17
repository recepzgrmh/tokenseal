# Third-Party Notices

TokenSeal has **zero runtime dependencies**. It ships no third-party code.

Its development tooling (dev-dependencies only, not distributed) includes
TypeScript, ESLint, `typescript-eslint`, and Prettier, each under its own
permissive license (Apache-2.0 / MIT). See `package-lock.json` for exact
versions.

## Design attribution

During research (`docs/research/`) we surveyed several Claude Code ecosystem
projects. **No code was copied from any of them.** Where a *design idea* informed
TokenSeal, we note it here for attribution and to be explicit about licensing.

| Project | License | How it influenced TokenSeal |
| --- | --- | --- |
| [obra/superpowers](https://github.com/obra/superpowers) | MIT | Lean always-on bootstrap + lazy, stage-triggered skills; verification-before-completion ethos. Concepts only. |
| [thedotmack/claude-mem](https://github.com/thedotmack/claude-mem) | Apache-2.0 | "Filter-before-fetch" retrieval (compact index → detail on demand) informing our receipts/explain-last design. Concepts only. |
| [anthropics/claude-code](https://github.com/anthropics/claude-code) | Proprietary | Reference for the plugin/agent/skill/hook API surface (documented behavior). No reuse. |
| [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) | Custom | Ecosystem taxonomy; links cited only. |
| worldflowai/everything-claude-code | No LICENSE file | MCP/tool budget heuristics referenced conceptually only; no code used. |
| multica-ai/andrej-karpathy-skills | No LICENSE file | "Think before coding / surgical changes" principles referenced conceptually only; no code used. |

Anthropic engineering guidance that shaped the design: *Claude Code Best
Practices*, *Effective Context Engineering for AI Agents*, *Building Effective
Agents*, and *Demystifying Evals for AI Agents*.

If you believe attribution is missing or incorrect, please open an issue.
