#!/usr/bin/env node
/**
 * Status line — print one compact line from stdin JSON.
 *
 * Uses whatever fields are present (context_percent, cost, duration_seconds,
 * model, git_branch); omits missing ones. Never crashes on empty/invalid stdin.
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

function fmtDuration(sec) {
  if (typeof sec !== 'number' || !Number.isFinite(sec) || sec < 0) return null;
  const s = Math.round(sec);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m${r.toString().padStart(2, '0')}s`;
}

function main() {
  const d = parse(readStdin()) || {};
  const parts = [];

  if (typeof d.context_percent === 'number' && Number.isFinite(d.context_percent)) {
    parts.push(`ctx ${Math.round(d.context_percent)}%`);
  }
  if (typeof d.cost === 'number' && Number.isFinite(d.cost)) {
    parts.push(`$${d.cost.toFixed(2)}`);
  }
  const dur = fmtDuration(d.duration_seconds);
  if (dur) parts.push(dur);
  if (typeof d.model === 'string' && d.model) parts.push(d.model);
  if (typeof d.git_branch === 'string' && d.git_branch) parts.push(d.git_branch);

  const line = parts.length ? `🦭 TokenSeal · ${parts.join(' · ')}` : '🦭 TokenSeal';
  try {
    process.stdout.write(line + '\n');
  } catch {
    /* ignore */
  }
  process.exit(0);
}

main();
