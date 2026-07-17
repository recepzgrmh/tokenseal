/**
 * Config persistence. Reads/writes `~/.claude/tokenseal/config.json` atomically,
 * migrating and validating on load.
 */
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { tokensealDataDir } from '../utils/paths.ts';
import { atomicWrite, readJson } from '../utils/fs-atomic.ts';
import { migrateConfig } from './migrate.ts';
import { validateConfig } from './validate.ts';
import { defaultConfig, type TokenSealConfig } from './schema.ts';

export function configPath(dataDir = tokensealDataDir()): string {
  return join(dataDir, 'config.json');
}

export function configExists(dataDir = tokensealDataDir()): boolean {
  return existsSync(configPath(dataDir));
}

export interface LoadedConfig {
  config: TokenSealConfig;
  path: string;
  existed: boolean;
  migrated: boolean;
  notes: string[];
}

/** Load config, creating a default (in memory only) if none exists. */
export function loadConfig(
  version: string,
  now: string,
  dataDir = tokensealDataDir(),
): LoadedConfig {
  const path = configPath(dataDir);
  const raw = readJson(path);
  if (raw === undefined) {
    return {
      config: defaultConfig(version, now),
      path,
      existed: false,
      migrated: false,
      notes: [],
    };
  }
  const migration = migrateConfig(raw, version, now);
  const validation = validateConfig(migration.config);
  if (!validation.ok) {
    // Corrupt config: fall back to defaults rather than crash, and surface it.
    return {
      config: defaultConfig(version, now),
      path,
      existed: true,
      migrated: true,
      notes: [
        ...migration.notes,
        `Config invalid, reset to defaults: ${validation.errors.join('; ')}`,
      ],
    };
  }
  return {
    config: validation.value as TokenSealConfig,
    path,
    existed: true,
    migrated: migration.migrated,
    notes: migration.notes,
  };
}

/** Persist config atomically with restrictive permissions. */
export function saveConfig(config: TokenSealConfig, dataDir = tokensealDataDir()): string {
  const path = configPath(dataDir);
  const validation = validateConfig(config);
  if (!validation.ok) {
    throw new Error(`Refusing to save invalid config: ${validation.errors.join('; ')}`);
  }
  atomicWrite(path, JSON.stringify(config, null, 2) + '\n', 0o600);
  return path;
}
