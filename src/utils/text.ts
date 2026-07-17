/**
 * Text helpers used by filters and receipts. Cross-platform newline aware.
 */

/** Split into lines, preserving nothing about the terminator. Handles CRLF/CR. */
export function splitLines(text: string): string[] {
  if (text === '') return [];
  return text.split(/\r\n|\r|\n/);
}

/** Count lines without allocating the full array for huge strings. */
export function countLines(text: string): number {
  if (text === '') return 0;
  let n = 1;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 10) n++;
    else if (c === 13) {
      if (text.charCodeAt(i + 1) === 10) i++;
      n++;
    }
  }
  return n;
}

/** Approximate token count (~4 chars/token). Good enough for budgeting. */
export function approxTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Keep the first `head` and last `tail` lines, noting how many were elided. */
export function truncateMiddle(text: string, head: number, tail: number): string {
  const lines = splitLines(text);
  if (lines.length <= head + tail) return text;
  const omitted = lines.length - head - tail;
  return [
    ...lines.slice(0, head),
    `… ${omitted} line${omitted === 1 ? '' : 's'} elided (full output preserved on disk) …`,
    ...lines.slice(lines.length - tail),
  ].join('\n');
}
