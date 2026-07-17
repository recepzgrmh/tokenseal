/**
 * Safe read/merge/write of `~/.claude/settings.json`.
 *
 * We only ever ADD our own keys and always back up first, so uninstall can
 * restore the user's file byte-for-byte. We never clobber a statusLine the user
 * already configured.
 */
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { claudeUserDir } from '../utils/paths.ts';
import { atomicWrite, backup, restore, ensureDir } from '../utils/fs-atomic.ts';

export interface ClaudeSettings {
  statusLine?: { type?: string; command?: string; [k: string]: unknown };
  [k: string]: unknown;
}

export function settingsPath(userDir = claudeUserDir()): string {
  return join(userDir, 'settings.json');
}

export function readSettings(userDir = claudeUserDir()): ClaudeSettings {
  const p = settingsPath(userDir);
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as ClaudeSettings;
  } catch {
    return {};
  }
}

/** Key marking that TokenSeal set the statusLine (so uninstall only removes ours). */
export const OWNED_MARKER = '_tokensealManaged';

export interface StatusLineResult {
  set: boolean;
  reason: string;
}

/**
 * Add a statusLine pointing at `scriptPath` iff the user has none. Returns
 * whether we set it. Always backs up settings.json first.
 */
export function ensureStatusLine(scriptPath: string, userDir = claudeUserDir()): StatusLineResult {
  const p = settingsPath(userDir);
  ensureDir(userDir);
  const settings = readSettings(userDir);
  if (settings.statusLine && !(settings.statusLine as Record<string, unknown>)[OWNED_MARKER]) {
    return { set: false, reason: 'user already has a statusLine; left untouched' };
  }
  backup(p);
  settings.statusLine = {
    type: 'command',
    command: `node "${scriptPath}"`,
    padding: 0,
    [OWNED_MARKER]: true,
  };
  atomicWrite(p, JSON.stringify(settings, null, 2) + '\n', 0o644);
  return { set: true, reason: 'statusLine configured' };
}

/** Remove the statusLine only if TokenSeal set it; restore backup if present. */
export function removeStatusLine(userDir = claudeUserDir()): boolean {
  const p = settingsPath(userDir);
  if (!existsSync(p)) return false;
  const settings = readSettings(userDir);
  const sl = settings.statusLine as Record<string, unknown> | undefined;
  if (sl && sl[OWNED_MARKER]) {
    // Prefer restoring the pre-install backup; else just drop our key.
    if (!restore(p)) {
      delete settings.statusLine;
      atomicWrite(p, JSON.stringify(settings, null, 2) + '\n', 0o644);
    }
    return true;
  }
  return false;
}
