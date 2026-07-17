import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  isWithinRoot,
  assertWithinRoot,
  looksLikeTraversal,
  realpathBestEffort,
} from '../../src/utils/paths.ts';

test('isWithinRoot accepts nested paths and rejects siblings', () => {
  assert.equal(isWithinRoot('/a/b/c', '/a/b'), true);
  assert.equal(isWithinRoot('/a/b', '/a/b'), true);
  assert.equal(isWithinRoot('/a/bc', '/a/b'), false);
  assert.equal(isWithinRoot('/a', '/a/b'), false);
});

test('looksLikeTraversal flags absolute and climbing paths', () => {
  assert.equal(looksLikeTraversal('/etc/passwd'), true);
  assert.equal(looksLikeTraversal('../../etc/passwd'), true);
  assert.equal(looksLikeTraversal('sub/dir/file'), false);
});

test('assertWithinRoot allows a new leaf inside the root', () => {
  const root = mkdtempSync(join(tmpdir(), 'ts-root-'));
  const target = join(root, 'new', 'file.json');
  // Resolves symlinks in the existing ancestor (e.g. macOS /var -> /private/var).
  const resolved = assertWithinRoot(target, root);
  assert.ok(isWithinRoot(resolved, realpathBestEffort(root)));
  assert.ok(resolved.endsWith(join('new', 'file.json')));
});

test('assertWithinRoot blocks a symlink that escapes the root', () => {
  const root = mkdtempSync(join(tmpdir(), 'ts-root-'));
  const outside = mkdtempSync(join(tmpdir(), 'ts-out-'));
  writeFileSync(join(outside, 'secret.txt'), 'x');
  mkdirSync(join(root, 'sub'));
  symlinkSync(outside, join(root, 'sub', 'escape'));
  assert.throws(
    () => assertWithinRoot(join(root, 'sub', 'escape', 'secret.txt'), root),
    /outside allowed root/,
  );
});
