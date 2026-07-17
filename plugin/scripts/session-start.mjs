#!/usr/bin/env node
/**
 * SessionStart hook — inject TokenSeal's tiny always-on core.
 *
 * Reads ~/.claude/tokenseal/config.json (absent → defaults; invalid → warn),
 * then prints exit-0 stdout JSON with `additionalContext`. Never throws.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const VERBOSITY = ['detailed', 'summary', 'brief', 'silent'];

function loadConfig() {
  const path = join(homedir(), '.claude', 'tokenseal', 'config.json');
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return { verbosity: 'summary', invalid: false, existed: false };
  }
  try {
    const cfg = JSON.parse(raw);
    const v = cfg && cfg.presentation && cfg.presentation.verbosity;
    return {
      verbosity: VERBOSITY.includes(v) ? v : 'summary',
      invalid: false,
      existed: true,
    };
  } catch {
    return { verbosity: 'summary', invalid: true, existed: true };
  }
}

function buildCore(cfg) {
  const lines = [
    'TokenSeal is active for this session — an always-on efficiency and assurance layer.',
    'Operate by these principles:',
    '- Think before coding: understand the request and the surrounding code before editing.',
    '- Prefer the simplest solution that fully satisfies the goal; avoid speculative complexity.',
    '- Make surgical, minimal changes scoped to exactly what was asked.',
    '- Turn each request into explicit, verifiable goals before acting.',
    '- Find the root cause before fixing; do not patch symptoms.',
    '- Require evidence (tests, build, observed behavior) before calling anything done.',
    `Active presentation profile: ${cfg.verbosity} — match your reporting detail to it.`,
  ];
  if (cfg.invalid) {
    lines.push('Note: TokenSeal config was unreadable; using default (summary) profile.');
  }
  return lines.join('\n');
}

function main() {
  const cfg = loadConfig();
  const out = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: buildCore(cfg),
    },
  };
  try {
    process.stdout.write(JSON.stringify(out));
  } catch {
    /* ignore write failure */
  }
  process.exit(0);
}

main();
