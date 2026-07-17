/**
 * Forward-only config migration. Each step upgrades one schema version.
 * Unknown/newer versions are left untouched (caller decides how to handle).
 */
import { SCHEMA_VERSION, defaultConfig, type TokenSealConfig } from './schema.ts';

export interface MigrationResult {
  migrated: boolean;
  fromVersion: number | 'unknown';
  config: TokenSealConfig;
  notes: string[];
}

type Migration = (input: Record<string, unknown>) => Record<string, unknown>;

/**
 * Registry of `n -> n+1` migrations. Empty for now (schema v1 is the first),
 * but the machinery + tests exist so v2 is a one-line addition, not a rewrite.
 */
const MIGRATIONS: Record<number, Migration> = {
  // 1: (cfg) => ({ ...cfg, schemaVersion: 2, /* new fields */ }),
};

/**
 * Bring a raw config object up to the current schema version. If the input is
 * unrecognizable, returns a fresh default and notes the reset.
 */
export function migrateConfig(raw: unknown, version: string, now: string): MigrationResult {
  const notes: string[] = [];
  if (
    typeof raw !== 'object' ||
    raw === null ||
    typeof (raw as { schemaVersion?: unknown }).schemaVersion !== 'number'
  ) {
    notes.push('Config missing or unversioned; reset to defaults.');
    return { migrated: true, fromVersion: 'unknown', config: defaultConfig(version, now), notes };
  }

  let cfg = raw as Record<string, unknown>;
  const from = cfg.schemaVersion as number;
  let current = from;

  while (current < SCHEMA_VERSION) {
    const step = MIGRATIONS[current];
    if (!step) {
      notes.push(`No migration path from schema v${current}; reset to defaults.`);
      return { migrated: true, fromVersion: from, config: defaultConfig(version, now), notes };
    }
    cfg = step(cfg);
    current = cfg.schemaVersion as number;
    notes.push(`Migrated config schema to v${current}.`);
  }

  return {
    migrated: current !== from,
    fromVersion: from,
    config: cfg as unknown as TokenSealConfig,
    notes,
  };
}
