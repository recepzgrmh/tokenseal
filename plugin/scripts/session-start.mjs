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

// Concrete output-token compression rules for the terse profiles. These change
// only the model's PROSE — code, commands, paths, and errors stay byte-exact —
// so the actual work and its quality are unaffected.
const TERSE_RULES = [
  'Output economy (this profile): minimize output tokens without losing substance.',
  '- No preamble, greetings, sycophancy, or self-reference ("Sure!", "I hope this helps").',
  '- Do not restate the question or re-summarize what you already said.',
  '- Answer directly; prefer short sentences, fragments, and lists over paragraphs.',
  '- Omit unsolicited alternatives/caveats unless correctness requires them.',
  '- Preserve ALL code, commands, file paths, and error text byte-for-byte exact.',
];

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
    `Active presentation profile: ${cfg.verbosity}.`,
  ];
  // brief/silent get real compression; detailed/summary keep normal verbosity.
  if (cfg.verbosity === 'brief' || cfg.verbosity === 'silent') {
    lines.push(...TERSE_RULES);
  }
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
