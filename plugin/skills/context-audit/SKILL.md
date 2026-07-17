---
name: context-audit
description: Use when the user explicitly wants to see what is consuming the context window and how to trim it.
disable-model-invocation: true
---

# Audit the context window

Goal: show what is occupying context and recommend safe reductions. User-invoked only; read-only.

## Steps
1. **Inventory** the large consumers you can see: long tool outputs, large files read in full, verbose logs, and repeated content.
2. **Categorize** each as: still needed, summarizable, or droppable.
3. **Recommend** concrete trims — e.g. read narrower ranges, filter Bash output, summarize a finished sub-task, or compact. Note TokenSeal's own filters (passing test output, large JSON, bash noise) if they apply.
4. **Estimate** the rough token impact of each recommendation. Be clear these are approximations.

## Output
A short table: item, category, ~tokens, recommendation. Do not delete or modify anything automatically — only advise.

Focus (optional): $ARGUMENTS
