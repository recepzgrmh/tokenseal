/**
 * Safe read/merge/write of `~/.claude/settings.json`.
 *
 * We only ever ADD our own keys and always back up first, so uninstall can
 * restore the user's file byte-for-byte. We never clobber a statusLine the user
 * already configured.
 */
import { join } from 'node:path';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { claudeUserDir } from '../utils/paths.ts';
import { atomicWrite, backup, ensureDir, BACKUP_SUFFIX } from '../utils/fs-atomic.ts';

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

/** Substring that uniquely identifies a TokenSeal-owned statusLine command. */
const OWNED_SCRIPT_HINT = 'tokenseal/marketplace/plugin/scripts/statusline';

function isOwnedStatusLine(sl: Record<string, unknown> | undefined): boolean {
  if (!sl) return false;
  // The nested marker is authoritative, but Claude Code normalizes settings and
  // may strip unknown keys — so also match our uniquely-named script path.
  if (sl[OWNED_MARKER]) return true;
  const cmd = typeof sl.command === 'string' ? sl.command : '';
  return cmd.replace(/\\/g, '/').includes(OWNED_SCRIPT_HINT);
}

/**
 * Remove the statusLine only if TokenSeal set it, then tidy empty containers
 * Claude Code left behind and drop our settings backup. Returns whether we
 * removed our statusLine. Idempotent.
 */
export function removeStatusLine(userDir = claudeUserDir()): boolean {
  const p = settingsPath(userDir);
  if (!existsSync(p)) return false;
  const settings = readSettings(userDir);
  const sl = settings.statusLine as Record<string, unknown> | undefined;
  let removed = false;
  if (isOwnedStatusLine(sl)) {
    delete settings.statusLine;
    removed = true;
  }
  // Tidy now-empty objects the plugin-uninstall left behind (never touch
  // non-empty ones — those hold other plugins/marketplaces).
  for (const key of ['enabledPlugins', 'extraKnownMarketplaces'] as const) {
    const v = settings[key];
    if (v && typeof v === 'object' && Object.keys(v as object).length === 0) delete settings[key];
  }
  atomicWrite(p, JSON.stringify(settings, null, 2) + '\n', 0o644);
  // Drop the pre-install backup file (we are past the point of restoring it).
  const bak = p + BACKUP_SUFFIX;
  if (existsSync(bak)) rmSync(bak);
  return removed;
}
