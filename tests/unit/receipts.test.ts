import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  newReceipt,
  validateReceipt,
  RECEIPT_SCHEMA_VERSION,
  type TaskReceipt,
} from '../../src/receipts/schema.ts';
import {
  writeReceipt,
  listReceipts,
  latestReceipt,
  rotateReceipts,
} from '../../src/receipts/store.ts';

test('newReceipt produces a valid receipt with defaults', () => {
  const r = newReceipt({ taskId: 't1', task: 'do a thing' });
  assert.equal(r.schemaVersion, RECEIPT_SCHEMA_VERSION);
  assert.equal(r.status, 'in-progress');
  assert.equal(r.retryCount, 0);
  assert.deepEqual(r.agentCommits, []);
  assert.equal(r.verification.testsPassed, 0);
  const result = validateReceipt(r);
  assert.equal(result.ok, true, result.errors.join('; '));
});

test('validateReceipt rejects a non-object and a bad schemaVersion', () => {
  assert.equal(validateReceipt(null).ok, false);
  const bad = newReceipt({ taskId: 't1' }) as TaskReceipt & { schemaVersion: number };
  bad.schemaVersion = 99;
  const res = validateReceipt(bad);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes('schemaVersion')));
});

test('validateReceipt requires a non-empty taskId', () => {
  const r = newReceipt({ taskId: '' });
  const res = validateReceipt(r);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes('taskId')));
});

test('writeReceipt masks a secret embedded in a change note', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ts-receipts-'));
  const secret = 'sk-ant-' + 'A'.repeat(40);
  const r = newReceipt({
    taskId: 'mask-1',
    task: 'leak test',
    completedAt: '2026-07-17T01:00:00.000Z',
    changes: [{ file: 'x.ts', kind: 'modified', note: `token was ${secret}` }],
  });
  const file = writeReceipt(r, dir);
  const onDisk = readFileSync(file, 'utf8');
  assert.ok(!onDisk.includes(secret), 'raw secret must not be persisted');
  assert.ok(onDisk.includes('redacted'), 'redaction marker expected');
});

test('writeReceipt round-trips through listReceipts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ts-receipts-'));
  writeReceipt(
    newReceipt({ taskId: 'rt-1', task: 'a', completedAt: '2026-07-17T01:00:00.000Z' }),
    dir,
  );
  const all = listReceipts(dir);
  assert.equal(all.length, 1);
  assert.equal(all[0]?.taskId, 'rt-1');
  assert.equal(all[0]?.task, 'a');
});

test('listReceipts and latestReceipt sort newest-first', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ts-receipts-'));
  writeReceipt(newReceipt({ taskId: 'old', completedAt: '2026-07-10T00:00:00.000Z' }), dir);
  writeReceipt(newReceipt({ taskId: 'new', completedAt: '2026-07-16T00:00:00.000Z' }), dir);
  writeReceipt(newReceipt({ taskId: 'mid', completedAt: '2026-07-12T00:00:00.000Z' }), dir);

  const ordered = listReceipts(dir).map((r) => r.taskId);
  assert.deepEqual(ordered, ['new', 'mid', 'old']);
  assert.equal(latestReceipt(dir)?.taskId, 'new');
});

test('latestReceipt returns undefined for an empty/absent dir', () => {
  const dir = join(tmpdir(), 'ts-does-not-exist-' + Date.now());
  assert.equal(latestReceipt(dir), undefined);
});

test('rotateReceipts keeps the N newest and deletes the rest', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ts-receipts-'));
  for (let i = 0; i < 6; i++) {
    const day = String(10 + i).padStart(2, '0');
    writeReceipt(newReceipt({ taskId: `r${i}`, completedAt: `2026-07-${day}T00:00:00.000Z` }), dir);
  }
  const deleted = rotateReceipts(dir, 3);
  assert.equal(deleted, 3);

  const remaining = listReceipts(dir).map((r) => r.taskId);
  assert.deepEqual(remaining, ['r5', 'r4', 'r3']);
  // Oldest files are gone from disk.
  assert.equal(existsSync(join(dir, 'r0.json')), false);
  assert.equal(existsSync(join(dir, 'r5.json')), true);
});

test('rotateReceipts is a no-op when count is under the keep threshold', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ts-receipts-'));
  writeReceipt(newReceipt({ taskId: 'only', completedAt: '2026-07-10T00:00:00.000Z' }), dir);
  assert.equal(rotateReceipts(dir, 50), 0);
  assert.equal(listReceipts(dir).length, 1);
});
