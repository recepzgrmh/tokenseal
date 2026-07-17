#!/usr/bin/env node
/**
 * Stop hook — the TokenSeal completion gate.
 *
 * Reads task state at ~/.claude/tokenseal/state/<session_id>.json. If absent or
 * unreadable → allow (exit 0). Otherwise delegate to the pure `decideStop`. On a
 * block it increments `stopCount` (loop guard) and exits 2 with a stderr reason.
 * Any unexpected error → allow (exit 0), never disrupt an ordinary session.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { decideStop } from './lib/gate.mjs';

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

function statePath(sessionId) {
  return join(homedir(), '.claude', 'tokenseal', 'state', `${sessionId}.json`);
}

function main() {
  const data = parse(readStdin());
  const sessionId = data && typeof data.session_id === 'string' ? data.session_id : '';
  if (!sessionId) {
    process.exit(0);
  }

  const path = statePath(sessionId);
  let state;
  try {
    state = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    // No state file (ordinary session) or unreadable → never disrupt.
    process.exit(0);
  }

  let decision;
  try {
    decision = decideStop(state);
  } catch {
    process.exit(0);
  }

  if (!decision || !decision.block) {
    process.exit(0);
  }

  // Blocking: record the block so the loop guard can eventually release.
  try {
    const next = {
      ...state,
      stopCount: (typeof state.stopCount === 'number' ? state.stopCount : 0) + 1,
    };
    writeFileSync(path, JSON.stringify(next, null, 2));
  } catch {
    /* best effort; still block below */
  }

  process.stderr.write(decision.reason + '\n');
  process.exit(2);
}

main();
