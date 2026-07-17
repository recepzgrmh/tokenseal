#!/usr/bin/env node
/**
 * PreCompact hook — write a small resume packet before context is compacted.
 *
 * Never dumps the transcript. Derives a compact packet from the session's task
 * state and writes it to ~/.claude/tokenseal/state/<session_id>.resume.json.
 * Always exits 0; any error is swallowed.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

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

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function main() {
  const data = parse(readStdin());
  const sessionId = data && typeof data.session_id === 'string' ? data.session_id : '';
  if (!sessionId) process.exit(0);

  const base = join(homedir(), '.claude', 'tokenseal', 'state');
  let state;
  try {
    state = JSON.parse(readFileSync(join(base, `${sessionId}.json`), 'utf8'));
  } catch {
    // No task state → nothing worth resuming.
    process.exit(0);
  }

  const packet = {
    taskId: state.taskId ?? null,
    objective: typeof state.objective === 'string' ? state.objective : '',
    completed: arr(state.completed),
    pending: arr(state.pending),
    changedFiles: arr(state.changedFiles),
    verificationState: state.verificationState ?? 'unverified',
    reviewState: state.reviewState ?? 'pending',
    savedAt: new Date().toISOString(),
  };

  try {
    const out = join(base, `${sessionId}.resume.json`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(packet, null, 2));
  } catch {
    /* ignore */
  }

  process.exit(0);
}

main();
