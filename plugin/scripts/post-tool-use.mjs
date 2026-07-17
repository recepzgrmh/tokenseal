#!/usr/bin/env node
/**
 * PostToolUse hook (matcher: Bash) — advisory only in v0.1.0.
 *
 * Measures the size of the Bash tool output and, when it is very large, emits a
 * gentle non-blocking advisory. NEVER blocks, NEVER alters the tool result,
 * always exits 0.
 */
import { readFileSync } from 'node:fs';

const LARGE_BYTES = 20000; // ~5k tokens; advisory threshold only.

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

function outputSize(data) {
  if (!data || typeof data !== 'object') return 0;
  const r = data.tool_response;
  if (r === null || r === undefined) return 0;
  try {
    return typeof r === 'string' ? Buffer.byteLength(r) : Buffer.byteLength(JSON.stringify(r));
  } catch {
    return 0;
  }
}

function main() {
  const data = parse(readStdin());
  const bytes = outputSize(data);

  if (bytes >= LARGE_BYTES) {
    const out = {
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext:
          `TokenSeal advisory: that Bash command produced ~${Math.round(bytes / 1000)}KB of output. ` +
          'Consider narrowing future commands (filters, head/tail, targeted queries) to save context.',
      },
    };
    try {
      process.stdout.write(JSON.stringify(out));
    } catch {
      /* ignore */
    }
  }

  process.exit(0);
}

main();
