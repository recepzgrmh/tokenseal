/**
 * Atomic file writes with backup/restore.
 *
 * `atomicWrite` writes to a temp file in the same directory then `rename`s it
 * into place, so a crash never leaves a half-written config. `backup`/`restore`
 * let the installer roll back any file it touches.
 */
import {
  writeFileSync,
  renameSync,
  mkdirSync,
  existsSync,
  copyFileSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { dirname, join, basename } from 'node:path';

export function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

/** Atomically write `data` to `file` (0600 by default for anything sensitive). */
export function atomicWrite(file: string, data: string, mode = 0o600): void {
  ensureDir(dirname(file));
  const tmp = join(dirname(file), `.${basename(file)}.${process.pid}.${Date.now()}.tmp`);
  try {
    writeFileSync(tmp, data, { mode });
    renameSync(tmp, file);
  } finally {
    if (existsSync(tmp)) {
      try {
        rmSync(tmp);
      } catch {
        /* best effort */
      }
    }
  }
}

export function writeJson(file: string, value: unknown, mode = 0o600): void {
  atomicWrite(file, JSON.stringify(value, null, 2) + '\n', mode);
}

export function readJson<T = unknown>(file: string): T | undefined {
  if (!existsSync(file)) return undefined;
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch {
    return undefined;
  }
}

/** Suffix used for backups so uninstall/rollback can find and restore them. */
export const BACKUP_SUFFIX = '.tokenseal-backup';

/**
 * Copy `file` to `file + BACKUP_SUFFIX` if it exists and no backup exists yet.
 * Returns the backup path, or undefined if there was nothing to back up.
 */
export function backup(file: string): string | undefined {
  if (!existsSync(file)) return undefined;
  const bak = file + BACKUP_SUFFIX;
  if (!existsSync(bak)) copyFileSync(file, bak);
  return bak;
}

/**
 * Restore a file from its backup. Returns true if a restore happened.
 * If `removeIfNoBackup` and the original had no backup, the (TokenSeal-created)
 * file is removed to return the system to its pre-install state.
 */
export function restore(file: string, removeIfNoBackup = false): boolean {
  const bak = file + BACKUP_SUFFIX;
  if (existsSync(bak)) {
    copyFileSync(bak, file);
    rmSync(bak);
    return true;
  }
  if (removeIfNoBackup && existsSync(file)) {
    rmSync(file);
    return true;
  }
  return false;
}
