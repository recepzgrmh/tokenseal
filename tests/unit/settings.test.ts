import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ensureStatusLine,
  removeStatusLine,
  readSettings,
  settingsPath,
} from '../../src/installer/settings.ts';

function sandbox(seed?: object): string {
  const dir = mkdtempSync(join(tmpdir(), 'ts-settings-'));
  if (seed) writeFileSync(join(dir, 'settings.json'), JSON.stringify(seed, null, 2));
  return dir;
}

const SCRIPT = '/home/.claude/tokenseal/marketplace/plugin/scripts/statusline.mjs';

test('ensureStatusLine sets a statusLine when none exists and backs up', () => {
  const dir = sandbox({ theme: 'dark' });
  const res = ensureStatusLine(SCRIPT, dir);
  assert.equal(res.set, true);
  const s = readSettings(dir);
  assert.match((s.statusLine as { command: string }).command, /statusline\.mjs/);
  assert.equal((s as { theme: string }).theme, 'dark');
  assert.ok(existsSync(settingsPath(dir) + '.tokenseal-backup'));
});

test('ensureStatusLine never clobbers a user statusLine', () => {
  const dir = sandbox({ statusLine: { type: 'command', command: 'my-own' } });
  const res = ensureStatusLine(SCRIPT, dir);
  assert.equal(res.set, false);
  assert.equal((readSettings(dir).statusLine as { command: string }).command, 'my-own');
});

test('removeStatusLine removes our statusLine even when the marker was stripped', () => {
  const dir = sandbox({ theme: 'dark' });
  ensureStatusLine(SCRIPT, dir);
  // Simulate Claude Code normalizing settings and dropping our nested marker.
  const s = readSettings(dir) as Record<string, unknown>;
  delete (s.statusLine as Record<string, unknown>)._tokensealManaged;
  s.enabledPlugins = {};
  s.extraKnownMarketplaces = {};
  writeFileSync(settingsPath(dir), JSON.stringify(s, null, 2));

  const removed = removeStatusLine(dir);
  assert.equal(removed, true);
  const after = readSettings(dir);
  assert.equal(after.statusLine, undefined);
  assert.equal((after as { theme: string }).theme, 'dark');
  // Empty containers tidied; backup dropped.
  assert.equal((after as Record<string, unknown>).enabledPlugins, undefined);
  assert.ok(!existsSync(settingsPath(dir) + '.tokenseal-backup'));
});

test('removeStatusLine leaves a non-owned statusLine and non-empty containers alone', () => {
  const dir = sandbox({
    statusLine: { command: 'user-thing' },
    enabledPlugins: { 'other@mkt': true },
  });
  const removed = removeStatusLine(dir);
  assert.equal(removed, false);
  const after = readSettings(dir);
  assert.equal((after.statusLine as { command: string }).command, 'user-thing');
  assert.deepEqual((after as Record<string, unknown>).enabledPlugins, { 'other@mkt': true });
});

test('removeStatusLine is idempotent on missing file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ts-settings-'));
  assert.equal(removeStatusLine(dir), false);
});

test('final settings round-trips to pristine after set+remove', () => {
  const original = { theme: 'dark' };
  const dir = sandbox(original);
  ensureStatusLine(SCRIPT, dir);
  removeStatusLine(dir);
  assert.deepEqual(JSON.parse(readFileSync(settingsPath(dir), 'utf8')), original);
});
