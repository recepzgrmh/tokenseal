#!/usr/bin/env node
/**
 * UserPromptSubmit hook — derive lightweight task metadata.
 *
 * Never rewrites the user's prompt. Emits a small `additionalContext` hint only
 * when the prompt looks like a code/change task; otherwise emits nothing. Fast,
 * never blocks, always exits 0.
 */
import { readFileSync } from 'node:fs';

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function parse(input) {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

// Verbs that suggest the user wants code written/changed (a gated task).
const CODE_RE =
  /\b(implement|refactor|fix|bug|debug|add|create|build|write|change|update|modify|rename|delete|remove|migrate|patch|optimi[sz]e|test|deploy)\b/i;

function main() {
  const data = parse(readStdin());
  const prompt = data && typeof data.prompt === 'string' ? data.prompt : '';

  if (!prompt || !CODE_RE.test(prompt)) {
    // Nothing useful to add — stay silent so ordinary prompts are untouched.
    process.exit(0);
  }

  const context =
    'TokenSeal: this looks like a code task. Convert it into explicit, verifiable ' +
    'goals; make the smallest sufficient change; then verify and review before ' +
    'declaring it done.';

  const out = {
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: context,
    },
  };
  try {
    process.stdout.write(JSON.stringify(out));
  } catch {
    /* ignore */
  }
  process.exit(0);
}

main();
