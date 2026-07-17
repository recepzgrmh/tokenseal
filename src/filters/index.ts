/**
 * Adaptive output filtering.
 *
 * {@link filterOutput} reduces verbose tool output while guaranteeing that:
 *   1. secrets are masked before anything is returned or stored, and
 *   2. failures are preserved verbatim (a filter that hides a stack trace is a
 *      bug), with the full masked output always kept on disk for recovery.
 *
 * Reduction is adaptive, not blind truncation: the rule that fires depends on
 * the payload kind, size, and success/failure signal.
 */
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FilterInput, FilterResult } from './types.ts';
import { classifyKind, hasFailureSignal, extractFailureRegions, isJson } from './detect.ts';
import { splitLines, countLines, truncateMiddle } from '../utils/text.ts';
import { maskSecrets } from '../security/masking.ts';
import { atomicWrite, ensureDir } from '../utils/fs-atomic.ts';

// Adaptive thresholds. Safe defaults, benchmark-tunable, not proven-optimal.
const LONG_TEST_LINES = 40;
const LARGE_JSON_CHARS = 12_000;
const LONG_BASH_LINES = 400;
const LONG_BASH_CHARS = 12_000;
const HEAD_LINES = 12;
const TAIL_LINES = 12;
const FAILURE_HEAD_LINES = 6;
const FAILURE_TAIL_LINES = 12;

/** Directory under the OS temp dir where full masked outputs are stored. */
export function outputStorageDir(): string {
  return join(tmpdir(), 'tokenseal-output');
}

let storeCounter = 0;

/** Store the full (already-masked) text to a unique file; return its path. */
function storeFull(maskedFull: string): string {
  const dir = outputStorageDir();
  ensureDir(dir);
  // Uniqueness from time + monotonic counter (runtime code, not a workflow script).
  const stamp = Date.now().toString(36);
  const seq = (storeCounter++).toString(36);
  const path = join(dir, `${stamp}-${seq}.txt`);
  atomicWrite(path, maskedFull);
  return path;
}

function result(
  filtered: string,
  strategy: string,
  originalBytes: number,
  storedPath?: string,
): FilterResult {
  const filteredBytes = Buffer.byteLength(filtered);
  const reductionRatio =
    originalBytes > 0 && filteredBytes < originalBytes ? 1 - filteredBytes / originalBytes : 0;
  const base: FilterResult = {
    filtered,
    strategy,
    originalBytes,
    filteredBytes,
    recoverable: storedPath !== undefined,
    reductionRatio,
  };
  if (storedPath !== undefined) base.storedPath = storedPath;
  return base;
}

/** Compact a large JSON blob to a structural summary. */
function summarizeJson(masked: string): string {
  const bytes = Buffer.byteLength(masked);
  let parsed: unknown;
  try {
    parsed = JSON.parse(masked.trim());
  } catch {
    return masked;
  }
  const lines: string[] = ['JSON summary (full output preserved on disk):', `  bytes: ${bytes}`];
  if (Array.isArray(parsed)) {
    lines.push(`  type: array`, `  length: ${parsed.length}`);
  } else if (parsed && typeof parsed === 'object') {
    const keys = Object.keys(parsed);
    lines.push(`  type: object`, `  topLevelKeys: ${keys.length}`);
    if (keys.length > 0) lines.push(`  keys: ${keys.slice(0, 50).join(', ')}`);
  } else {
    lines.push(`  type: ${parsed === null ? 'null' : typeof parsed}`);
  }
  return lines.join('\n');
}

/** Try to pull a "N passed / M failed" style summary line from test output. */
function testSummaryLines(masked: string): string[] {
  const found: string[] = [];
  const patterns = [
    /^.*\btests?\s+\d+.*$/gim,
    /^.*\b\d+\s+(?:passing|passed|failing|failed).*$/gim,
    /^.*\bTests?:\s+.*$/gim,
    /^# (?:tests|pass|fail)\s+\d+.*$/gim,
  ];
  for (const re of patterns) {
    const matches = masked.match(re);
    if (matches) {
      for (const m of matches) {
        const t = m.trim();
        if (t && !found.includes(t)) found.push(t);
      }
    }
  }
  return found.slice(0, 4);
}

/**
 * Filter tool output adaptively. Always masks secrets; never hides failures.
 */
export function filterOutput(input: FilterInput): FilterResult {
  const originalBytes = Buffer.byteLength(input.text);
  const masked = maskSecrets(input.text);

  // Rule 1: caller explicitly wants everything (still masked).
  if (input.requestedDetail === 'full') {
    return result(masked, 'passthrough-full', originalBytes);
  }

  const kind = input.kind && input.kind !== 'auto' ? input.kind : classifyKind(input);
  const failed = (input.exitCode !== undefined && input.exitCode !== 0) || hasFailureSignal(masked);

  // Rule 3: failure — preserve diagnostics verbatim. Highest priority.
  if (failed) {
    const regions = extractFailureRegions(masked, 3);
    const totalLines = countLines(masked);
    let filtered: string;
    if (regions === '' || totalLines <= HEAD_LINES + TAIL_LINES) {
      // Short enough, or no discrete region — keep it all.
      filtered = masked;
    } else {
      const head = splitLines(masked).slice(0, FAILURE_HEAD_LINES).join('\n');
      const tail = splitLines(masked).slice(-FAILURE_TAIL_LINES).join('\n');
      filtered = [head, '', '── failure regions ──', regions, '', '── tail ──', tail].join('\n');
    }
    const storedPath = storeFull(masked);
    return result(filtered, 'failure-preserve', originalBytes, storedPath);
  }

  // Rule 4: long passing test output — compact to summary + tail.
  if (kind === 'test' && countLines(masked) > LONG_TEST_LINES) {
    const summary = testSummaryLines(masked);
    const tail = splitLines(masked).slice(-TAIL_LINES);
    const filtered = [
      'Test run passed (full output preserved on disk).',
      ...(summary.length ? ['', 'Summary:', ...summary.map((s) => `  ${s}`)] : []),
      '',
      '── last lines ──',
      ...tail,
    ].join('\n');
    const storedPath = storeFull(masked);
    return result(filtered, 'test-passing-compact', originalBytes, storedPath);
  }

  // Rule 5: large JSON — structural summary instead of the full blob.
  if (kind === 'json' && masked.length > LARGE_JSON_CHARS && isJson(masked)) {
    const filtered = summarizeJson(masked);
    const storedPath = storeFull(masked);
    return result(filtered, 'json-summary', originalBytes, storedPath);
  }

  // Rule 6: long generic bash success — keep head + tail via truncateMiddle.
  if (
    kind === 'bash' &&
    (countLines(masked) > LONG_BASH_LINES || masked.length > LONG_BASH_CHARS)
  ) {
    const filtered = truncateMiddle(masked, HEAD_LINES, TAIL_LINES);
    if (Buffer.byteLength(filtered) < originalBytes) {
      const storedPath = storeFull(masked);
      return result(filtered, 'bash-tail', originalBytes, storedPath);
    }
  }

  // Rule 7: nothing to gain — passthrough (masked).
  return result(masked, 'passthrough', originalBytes);
}

export type { FilterInput, FilterResult } from './types.ts';
