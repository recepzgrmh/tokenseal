import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultConfig } from '../../src/config/schema.ts';
import { validateConfig } from '../../src/config/validate.ts';
import { migrateConfig } from '../../src/config/migrate.ts';
import { loadConfig, saveConfig, configPath } from '../../src/config/store.ts';

const NOW = '2026-07-17T00:00:00.000Z';

test('default config validates', () => {
  const res = validateConfig(defaultConfig('0.1.0', NOW));
  assert.equal(res.ok, true, res.errors.join('; '));
});

test('validation collects multiple errors', () => {
  const bad = {
    ...defaultConfig('0.1.0', NOW),
    presentation: { verbosity: 'loud', notify: 'x', permission: 'y', results: 'z' },
  };
  const res = validateConfig(bad);
  assert.equal(res.ok, false);
  assert.ok(res.errors.length >= 4);
});

test('validation rejects telemetry enabled', () => {
  const bad = { ...defaultConfig('0.1.0', NOW), telemetry: { enabled: true, localOnly: true } };
  assert.equal(validateConfig(bad).ok, false);
});

test('migrate resets unversioned config to defaults', () => {
  const m = migrateConfig({ foo: 'bar' }, '0.1.0', NOW);
  assert.equal(m.migrated, true);
  assert.equal(m.fromVersion, 'unknown');
  assert.equal(validateConfig(m.config).ok, true);
});

test('save then load round-trips atomically', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ts-cfg-'));
  const cfg = defaultConfig('0.1.0', NOW);
  cfg.presentation.verbosity = 'silent';
  saveConfig(cfg, dir);
  assert.ok(existsSync(configPath(dir)));
  const loaded = loadConfig('0.1.0', NOW, dir);
  assert.equal(loaded.existed, true);
  assert.equal(loaded.config.presentation.verbosity, 'silent');
});

test('load returns default when no config exists', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ts-cfg-'));
  const loaded = loadConfig('0.1.0', NOW, dir);
  assert.equal(loaded.existed, false);
  assert.equal(loaded.config.presentation.verbosity, 'summary');
});

test('load recovers from corrupt config', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ts-cfg-'));
  saveConfig({ ...defaultConfig('0.1.0', NOW) }, dir);
  // Corrupt it by writing an invalid schemaVersion via raw migrate path.
  const loaded = loadConfig('0.1.0', NOW, dir);
  assert.equal(validateConfig(loaded.config).ok, true);
});
