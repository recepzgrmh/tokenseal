# Claude Code Compatibility Report — v2.1.212

> Produced by the `official-docs-researcher` subagent (read-only) against the
> installed Claude Code **2.1.212** on macOS, cross-checked with
> <https://code.claude.com/docs>. This is the source of truth for every format
> TokenSeal emits. Re-run the research agent when bumping the supported version.

## 1. Plugin manifest — VERIFIED
- Path: `plugin/.claude-plugin/plugin.json` (plugin root, **not** inside `.claude/`).
- Required: `name` (unique id; becomes the skill namespace prefix).
- Optional: `description`, `version`, `author` (`{ "name": ... }`), `homepage`,
  `repository`, `license`.

## 2. User-scope installation — VERIFIED
- Marketplace: `claude plugin install <marketplace>/<plugin>`.
- Local (used for dev + our installer): `claude --plugin-dir ./plugin` (accepts a
  `.zip` on 2.1.128+).
- Registry: `~/.claude/plugins/installed_plugins.json` (v2 schema; scope,
  installPath, version, installedAt).
- Marketplaces: `~/.claude/plugins/known_marketplaces.json`.
- Enablement: `~/.claude/settings.json` → `enabledPlugins`
  (`"plugin@marketplace": true`).
- Skills invoked as `/plugin-name:skill-name`.

## 3. Agent (subagent) format — VERIFIED
- Dir: `plugin/agents/<name>/` (or project `.claude/agents/`).
- Definition file: `claude.md` with YAML frontmatter.
- Frontmatter: `name`, `description`, `model`, `tools` (comma-separated),
  optional `system-prompt`, optional `isolation: worktree`.
- Precedence: project `.claude/agents/` > plugin agents > built-in.

## 4. Skill format — VERIFIED
- Dir: `plugin/skills/<name>/SKILL.md` (or user/project `.claude/skills/`).
- Frontmatter: `description` (required for model invocation), `name`,
  `disable-model-invocation: true` (user-only), `run-in-subagent`.
- Body may use `$ARGUMENTS`. Supporting files may sit beside `SKILL.md`.

## 5. Hooks — VERIFIED
- Config: `plugin/hooks/hooks.json` (or `~/.claude/settings.json` `hooks`).
- Shape (3 levels):
  ```json
  { "hooks": { "EventName": [ { "matcher": "Bash|Write|...",
      "hooks": [ { "type": "command", "command": "..." } ] } ] } }
  ```
- Events present in 2.1.212: `SessionStart`, `SessionEnd`, `UserPromptSubmit`,
  `PreToolUse`, `PostToolUse`, `Stop`, `SubagentStart`, `SubagentStop`,
  `PreCompact`, `PostCompact`, `TaskCompleted`, `StopFailure`,
  `WorktreeCreate`, `WorktreeRemove`.
- Command hooks receive JSON on **stdin**: `session_id`, `transcript_path`,
  `cwd`, `permission_mode`, `hook_event_name`, `tool_name`, `tool_input`,
  `effort.level`, …
- Blocking: **exit 2 → block** (stderr fed to Claude). Exit 0 → stdout parsed as
  JSON: `{ decision, reason, additionalContext, continue, suppressOutput,
  hookSpecificOutput: { permissionDecision } }`. Other codes → non-blocking.

## 6. Output styles — VERIFIED
- Markdown + YAML frontmatter. `plugin/output-styles/<name>.md`.
- Frontmatter: `name`, `description`, `keep-coding-instructions` (default false),
  `force-for-plugin` (plugin-only auto-apply).

## 7. Status line — VERIFIED
- `settings.json` → `statusLine` (`command`, `args`, `refreshInterval`).
- stdin JSON: `context_percent`, `cost`, `duration_seconds`, `model`,
  `session_title`, `git_branch`, … Multi-line stdout renders as rows.

## 8. Worktree isolation — VERIFIED
- Agent frontmatter `isolation: worktree`; auto-removed if unchanged.
- `settings.json` → `worktree.baseRef`: `"fresh"` (default) | `"head"`.

## 9. Model aliases + effort — VERIFIED
- Aliases: `default`, `best`, `fable`, `sonnet`, `opus`, `haiku`, `opusplan`,
  `sonnet[1m]`, `opus[1m]`, plus full model ids.
- Effort: `low | medium | high | xhigh | max` (modern models); older models fall
  back. Set with `/effort` or `--effort`.

## 10. Cost / context / usage — VERIFIED
- `/usage`, `/cost`; status-line stdin (`cost`, `context_percent`,
  `duration_seconds`); transcript JSONL at `~/.claude/projects/<id>/`.

## 11. Not supported / experimental → build fallbacks
- **Agent Teams**: experimental, opt-in (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`),
  ~7× token cost. **TokenSeal will not use it.**
- **Agent-type hooks**: experimental; TokenSeal completion guarantees stay on
  deterministic command hooks + task state, never on an LLM hook alone.
- Worktree isolation is git-only; non-git VCS needs Worktree*/hooks → fall back
  to snapshot-diff isolation.

## Fallback matrix (older Claude Code)
| Feature | If unavailable |
| --- | --- |
| `isolation: worktree` | same-dir subagent + snapshot diff |
| `worktree.baseRef: head` | default fresh branch |
| effort levels | omit `--effort` |
| status-line stdin fields | degrade gracefully; hide missing metrics |
| newer hook events | use the pre-2.1 subset |

Doc sources: plugins, sub-agents, skills, hooks, statusline, worktrees,
model-config, costs, output-styles under `https://code.claude.com/docs/en/`.
