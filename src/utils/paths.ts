/**
 * Path safety helpers.
 *
 * Every filesystem write in TokenSeal must go through {@link assertWithinRoot}
 * so a crafted path (`../`, absolute, or a symlink pointing outside an allowed
 * root) can never let us clobber files we do not own.
 */
import { homedir } from 'node:os';
import { resolve, sep, isAbsolute, join } from 'node:path';
import { realpathSync } from 'node:fs';

/** Absolute, normalized form of a path (does not require the path to exist). */
export function canonicalize(input: string): string {
  return resolve(input);
}

/**
 * Resolve a path following symlinks *for the portion that exists*, so we can
 * detect a symlink that escapes an allowed root even when the leaf is new.
 */
export function realpathBestEffort(input: string): string {
  let current = resolve(input);
  // Walk up until we find an existing ancestor we can realpath, then re-join.
  const tail: string[] = [];
  for (;;) {
    try {
      const real = realpathSync(current);
      return tail.length ? join(real, ...tail.reverse()) : real;
    } catch {
      const parent = resolve(current, '..');
      if (parent === current) return resolve(input); // reached filesystem root
      tail.push(current.slice(parent.length + 1));
      current = parent;
    }
  }
}

/** True if `child` is the same as, or nested under, `root` (after resolving). */
export function isWithinRoot(child: string, root: string): boolean {
  const r = resolve(root);
  const c = resolve(child);
  if (c === r) return true;
  return c.startsWith(r.endsWith(sep) ? r : r + sep);
}

/**
 * Throw unless `target` resolves (including via symlinks) inside `root`.
 * This is the single choke point protecting against path traversal and
 * symlink escape for destructive operations.
 */
export function assertWithinRoot(target: string, root: string): string {
  const resolved = realpathBestEffort(target);
  const resolvedRoot = realpathBestEffort(root);
  if (!isWithinRoot(resolved, resolvedRoot)) {
    throw new Error(`Refusing to operate on "${target}": resolves outside allowed root "${root}".`);
  }
  return resolved;
}

/** True for a bare absolute path or one that climbs out with `..`. */
export function looksLikeTraversal(input: string): boolean {
  if (isAbsolute(input)) return true;
  const parts = resolve('/anchor', input).split(sep);
  return !parts.includes('anchor');
}

/** User home directory (respects an overridden HOME for tests/sandboxes). */
export function homeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || homedir();
}

/** `~/.claude` — the Claude Code user config root. */
export function claudeUserDir(): string {
  return join(homeDir(), '.claude');
}

/** `~/.claude/tokenseal` — TokenSeal's own data root (config, receipts). */
export function tokensealDataDir(): string {
  return join(claudeUserDir(), 'tokenseal');
}
