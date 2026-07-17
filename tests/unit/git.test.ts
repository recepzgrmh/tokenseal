import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parsePorcelainV2 } from '../../src/git/parse.ts';
import { captureSnapshot } from '../../src/git/snapshot.ts';
import { separateUserVsAgent } from '../../src/git/user-changes.ts';
import { run, isRunnable } from '../../src/utils/proc.ts';

test('parsePorcelainV2 classifies staged, unstaged, untracked, and unmerged', () => {
  // Field layout: 1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>
  const stdout = [
    '1 M. N... 100644 100644 100644 aaaa bbbb staged-only.ts',
    '1 .M N... 100644 100644 100644 cccc dddd unstaged-only.ts',
    '1 MM N... 100644 100644 100644 eeee ffff both.ts',
    '? untracked.ts',
    '? another/untracked.md',
    '! ignored.log',
    // Unmerged: u <XY> <sub> <m1> <m2> <m3> <mW> <h1> <h2> <h3> <path>
    'u UU N... 100644 100644 100644 100644 1111 2222 3333 conflict.ts',
  ].join('\n');

  const result = parsePorcelainV2(stdout);

  assert.deepEqual(result.staged, ['both.ts', 'conflict.ts', 'staged-only.ts']);
  assert.deepEqual(result.unstaged, ['both.ts', 'conflict.ts', 'unstaged-only.ts']);
  assert.deepEqual(result.untracked, ['another/untracked.md', 'untracked.ts']);
});

test('parsePorcelainV2 handles rename (kind 2) using the new path', () => {
  // 2 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <Xscore> <new>\t<orig>
  const stdout = '2 R. N... 100644 100644 100644 aaaa bbbb R100 new-name.ts\told-name.ts';
  const result = parsePorcelainV2(stdout);
  assert.deepEqual(result.staged, ['new-name.ts']);
  assert.deepEqual(result.unstaged, []);
  assert.deepEqual(result.untracked, []);
});

test('parsePorcelainV2 tolerates empty and blank input', () => {
  assert.deepEqual(parsePorcelainV2(''), { staged: [], unstaged: [], untracked: [] });
  assert.deepEqual(parsePorcelainV2('\n\n'), { staged: [], unstaged: [], untracked: [] });
});

test('captureSnapshot returns isRepo:false for a non-repo directory', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ts-nonrepo-'));
  const snap = await captureSnapshot(dir, '2026-07-17T00:00:00.000Z');
  assert.equal(snap.isRepo, false);
  assert.equal(snap.headSha, null);
  assert.deepEqual(snap.staged, []);
  assert.deepEqual(snap.unstaged, []);
  assert.deepEqual(snap.untracked, []);
  assert.deepEqual(snap.dirtyBeforeTask, []);
  assert.equal(snap.capturedAt, '2026-07-17T00:00:00.000Z');
});

test('captureSnapshot reflects a real repo with an untracked file', async (t) => {
  if (!(await isRunnable('git', '--version'))) {
    t.skip('git not available');
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), 'ts-repo-'));
  await run('git', ['-C', dir, 'init', '-b', 'main']);
  await run('git', ['-C', dir, 'config', 'user.email', 'test@example.com']);
  await run('git', ['-C', dir, 'config', 'user.name', 'Test']);
  writeFileSync(join(dir, 'tracked.ts'), 'export const a = 1;\n');
  await run('git', ['-C', dir, 'add', 'tracked.ts']);
  await run('git', ['-C', dir, 'commit', '-m', 'init']);

  // Now add an untracked file.
  writeFileSync(join(dir, 'fresh.ts'), 'export const b = 2;\n');

  const snap = await captureSnapshot(dir, '2026-07-17T00:00:00.000Z');
  assert.equal(snap.isRepo, true);
  assert.ok(snap.headSha && snap.headSha.length >= 7);
  assert.ok(snap.untracked.includes('fresh.ts'));
  assert.ok(snap.dirtyBeforeTask.includes('fresh.ts'));
  // branch may be 'main' depending on git version support for -b.
  assert.ok(typeof snap.branch === 'string');
});

test('separateUserVsAgent flags overlap with pre-existing dirty files', () => {
  const before = {
    repoRoot: '/repo',
    branch: 'main',
    headSha: 'abc',
    isRepo: true,
    staged: ['a.ts'],
    unstaged: ['b.ts'],
    untracked: ['c.ts'],
    dirtyBeforeTask: ['a.ts', 'b.ts', 'c.ts'],
    capturedAt: '2026-07-17T00:00:00.000Z',
  };
  const afterFiles = ['b.ts', 'new.ts', 'other.ts', 'a.ts'];

  const result = separateUserVsAgent(before, afterFiles);
  assert.deepEqual(result.overlappingWithUser, ['a.ts', 'b.ts']);
  assert.deepEqual(result.agentOnly, ['new.ts', 'other.ts']);
});

test('separateUserVsAgent with clean baseline attributes everything to agent', () => {
  const before = {
    repoRoot: '/repo',
    branch: 'main',
    headSha: 'abc',
    isRepo: true,
    staged: [],
    unstaged: [],
    untracked: [],
    dirtyBeforeTask: [],
    capturedAt: '2026-07-17T00:00:00.000Z',
  };
  const result = separateUserVsAgent(before, ['x.ts', 'y.ts']);
  assert.deepEqual(result.agentOnly, ['x.ts', 'y.ts']);
  assert.deepEqual(result.overlappingWithUser, []);
});
