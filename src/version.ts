/**
 * Single source of truth for the CLI version, read from package.json at runtime
 * so we never drift from what npm publishes.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

let cached: string | undefined;

export function tokensealVersion(): string {
  if (cached) return cached;
  try {
    // dist/version.js and src/version.ts both sit one level under the package root.
    const here = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as {
      version?: string;
    };
    cached = pkg.version ?? '0.0.0';
  } catch {
    cached = '0.0.0';
  }
  return cached;
}
