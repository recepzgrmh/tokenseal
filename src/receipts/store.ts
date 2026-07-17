/**
 * Persistence for task receipts.
 *
 * Receipts live as one JSON file per task under
 * `~/.claude/tokenseal/receipts/<taskId>.json`. Every write is masked (never
 * store secrets), validated, and atomic. Deletes go through `assertWithinRoot`
 * so a crafted taskId can never make rotation clobber files outside the dir.
 */
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { atomicWrite, ensureDir, readJson } from '../utils/fs-atomic.ts';
import { assertWithinRoot, tokensealDataDir } from '../utils/paths.ts';
import { maskDeep } from '../security/masking.ts';
import { newReceipt, validateReceipt, type TaskReceipt } from './schema.ts';

/** Default receipts directory; overridable for tests. */
export function receiptsDir(dir?: string): string {
  return dir ?? join(tokensealDataDir(), 'receipts');
}

/** Sanitize a taskId into a safe single filename segment. */
function receiptFileName(taskId: string): string {
  const safe = taskId.replace(/[^A-Za-z0-9._-]/g, '_');
  if (!safe || safe === '.' || safe === '..') {
    throw new Error(`Invalid taskId for receipt filename: ${JSON.stringify(taskId)}`);
  }
  return `${safe}.json`;
}

/**
 * Mask, validate, and atomically persist a receipt to `<dir>/<taskId>.json`.
 * Throws if the (post-mask) receipt fails validation.
 */
export function writeReceipt(receipt: TaskReceipt, dir?: string): string {
  const masked = maskDeep(receipt);
  const result = validateReceipt(masked);
  if (!result.ok) {
    throw new Error(`Refusing to write invalid receipt: ${result.errors.join('; ')}`);
  }
  const targetDir = receiptsDir(dir);
  ensureDir(targetDir);
  const file = join(targetDir, receiptFileName(masked.taskId));
  assertWithinRoot(file, targetDir);
  atomicWrite(file, JSON.stringify(masked, null, 2) + '\n');
  return file;
}

/** Timestamp used for ordering: prefer completedAt, fall back to startedAt. */
function sortKey(r: TaskReceipt): string {
  return r.completedAt ?? r.startedAt ?? '';
}

/**
 * Read every valid receipt in the directory, newest-first (by completedAt then
 * startedAt). Invalid/corrupt files are skipped rather than throwing.
 */
export function listReceipts(dir?: string): TaskReceipt[] {
  const targetDir = receiptsDir(dir);
  if (!existsSync(targetDir)) return [];
  const receipts: TaskReceipt[] = [];
  for (const entry of readdirSync(targetDir)) {
    if (!entry.endsWith('.json')) continue;
    const raw = readJson<unknown>(join(targetDir, entry));
    if (raw === undefined) continue;
    if (!validateReceipt(raw).ok) continue;
    receipts.push(newReceipt(raw as Partial<TaskReceipt>));
  }
  receipts.sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
  return receipts;
}

/** The newest receipt, or undefined when none exist. */
export function latestReceipt(dir?: string): TaskReceipt | undefined {
  return listReceipts(dir)[0];
}

/**
 * Delete the oldest receipts beyond `keep`. Returns the number deleted. Each
 * delete target is verified to live inside the receipts dir before removal.
 */
export function rotateReceipts(dir?: string, keep = 50): number {
  if (keep < 0) keep = 0;
  const targetDir = receiptsDir(dir);
  if (!existsSync(targetDir)) return 0;

  // Newest-first, so everything from index `keep` onward is surplus.
  const ordered = listReceipts(targetDir);
  const surplus = ordered.slice(keep);
  let deleted = 0;
  for (const receipt of surplus) {
    const file = join(targetDir, receiptFileName(receipt.taskId));
    if (!existsSync(file)) continue;
    const safe = assertWithinRoot(file, targetDir);
    rmSync(safe);
    deleted += 1;
  }
  return deleted;
}
