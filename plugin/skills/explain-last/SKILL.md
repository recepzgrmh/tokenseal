---
name: explain-last
description: Use when the user explicitly asks what TokenSeal just did, saved, skipped, or filtered in the recent session or task.
disable-model-invocation: true
---

# Explain what TokenSeal did

Goal: give an honest, plain-language account of TokenSeal's recent actions and their token/cost impact. User-invoked only.

## Steps
1. **Read receipts** under `~/.claude/tokenseal/` (receipts/state). Use the `receipt-explainer` agent.
2. **Summarize** what was filtered, skipped, or summarized, and the estimated tokens/cost saved for the requested scope (`$ARGUMENTS` may name session/task/all; default: session).
3. **Be honest about estimates.** Numbers are local approximations. If no receipts exist, say so — never fabricate savings.

## Output
Short list: actions taken, estimated tokens saved, estimated cost saved, and caveats.

Scope requested: $ARGUMENTS
