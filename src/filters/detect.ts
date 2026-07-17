/**
 * Pure detection helpers for the adaptive filter.
 *
 * These never mutate state or touch disk: they classify a payload and locate
 * failure regions so the filter can decide what to preserve. All newline
 * handling is CRLF/CR aware via the shared text helpers.
 */
import type { FilterInput } from './types.ts';
import { splitLines } from '../utils/text.ts';

/** Command fragments that indicate a test runner is being invoked. */
const TEST_COMMAND_RE =
  /\b(vitest|jest|pytest|mocha|ava|tap|phpunit|rspec|go\s+test|cargo\s+test|node\s+--test|npm\s+(?:run\s+)?test|pnpm\s+(?:run\s+)?test|yarn\s+test)\b/i;

/** Text shapes emitted by common test runners (used when no command is given). */
const TEST_TEXT_RE =
  /\b(\d+\s+(?:passing|passed|failing|failed))\b|(?:^|\n)(?:ok|not ok)\s+\d+|# tests \d+|PASS\b|FAIL\b|Tests:\s+\d+|passed,\s+\d+\s+failed/;

/** High-signal substrings that mean the output represents a failure. */
const FAILURE_RE =
  /Traceback|AssertionError|Segmentation fault|npm ERR!|\bpanic\b|\bError\b|\bFAIL(?:ED|URE)?\b|✖|\bfailed\b/;

/**
 * Best-effort classification of what the payload is.
 * Order: explicit JSON detection, then test runners, else generic bash.
 */
export function classifyKind(input: FilterInput): 'bash' | 'test' | 'json' {
  const command = input.command ?? '';
  const trimmed = input.text.trim();

  if (isJson(trimmed)) return 'json';
  if (TEST_COMMAND_RE.test(command)) return 'test';
  if (!command && TEST_TEXT_RE.test(input.text)) return 'test';
  return 'bash';
}

/** True when `text` trims to a `{`/`[` payload that actually parses as JSON. */
export function isJson(text: string): boolean {
  const t = text.trim();
  if (t === '' || (t[0] !== '{' && t[0] !== '[')) return false;
  try {
    JSON.parse(t);
    return true;
  } catch {
    return false;
  }
}

/** True when text contains a recognizable failure signal. */
export function hasFailureSignal(text: string): boolean {
  return FAILURE_RE.test(text);
}

/**
 * Return only the failing chunks plus `contextLines` of surrounding context.
 * Contiguous/overlapping regions are merged; gaps are marked. If nothing
 * matches, returns an empty string (caller decides the fallback).
 */
export function extractFailureRegions(text: string, contextLines = 3): string {
  const lines = splitLines(text);
  const hitLines: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line !== undefined && FAILURE_RE.test(line)) hitLines.push(i);
  }
  if (hitLines.length === 0) return '';

  // Build merged [start, end] inclusive ranges around each hit.
  const ranges: Array<[number, number]> = [];
  for (const idx of hitLines) {
    const start = Math.max(0, idx - contextLines);
    const end = Math.min(lines.length - 1, idx + contextLines);
    const last = ranges[ranges.length - 1];
    if (last && start <= last[1] + 1) {
      last[1] = Math.max(last[1], end);
    } else {
      ranges.push([start, end]);
    }
  }

  const out: string[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor) {
      out.push(`… ${start - cursor} line${start - cursor === 1 ? '' : 's'} elided …`);
    }
    for (let i = start; i <= end; i++) {
      const line = lines[i];
      if (line !== undefined) out.push(line);
    }
    cursor = end + 1;
  }
  if (cursor < lines.length) {
    const rest = lines.length - cursor;
    out.push(`… ${rest} line${rest === 1 ? '' : 's'} elided …`);
  }
  return out.join('\n');
}
