import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskSecrets, containsSecret, maskDeep } from '../../src/security/masking.ts';

test('masks anthropic api keys', () => {
  const out = maskSecrets('key is sk-ant-api03-abcdef1234567890abcdef end');
  assert.ok(!out.includes('sk-ant-api03-abcdef'));
  assert.match(out, /redacted:anthropic-key/);
});

test('masks github tokens and aws keys', () => {
  assert.ok(containsSecret('ghp_' + 'a'.repeat(36)));
  assert.ok(containsSecret('AKIAIOSFODNN7EXAMPLE'));
});

test('masks KEY=value assignments but keeps the key name', () => {
  const out = maskSecrets('MY_API_KEY=supersecretvalue123');
  assert.match(out, /MY_API_KEY=/);
  assert.ok(!out.includes('supersecretvalue123'));
});

test('does not mask ordinary text', () => {
  const s = 'the quick brown fox jumps over 12345';
  assert.equal(maskSecrets(s), s);
  assert.equal(containsSecret(s), false);
});

test('masking is idempotent', () => {
  const once = maskSecrets('token xoxb-1234567890-abcdefghij');
  assert.equal(maskSecrets(once), once);
});

test('maskDeep walks nested objects and arrays', () => {
  const masked = maskDeep({ a: 'ghp_' + 'z'.repeat(36), b: [{ c: 'plain' }] });
  assert.ok(!JSON.stringify(masked).includes('ghp_zzz'));
  assert.equal((masked.b[0] as { c: string }).c, 'plain');
});
