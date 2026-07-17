/**
 * TokenSeal configuration schema.
 *
 * Only *presentation* and *permission* preferences are user-facing. Quality,
 * verification, and security behavior are identical across every profile — the
 * setup wizard never asks the user to trade quality for savings.
 */

export const SCHEMA_VERSION = 1 as const;

export const VERBOSITY = ['detailed', 'summary', 'brief', 'silent'] as const;
export type Verbosity = (typeof VERBOSITY)[number];

export const NOTIFY = ['milestones', 'decisions', 'end'] as const;
export type Notify = (typeof NOTIFY)[number];

export const PERMISSION = ['risky', 'scope', 'major'] as const;
export type Permission = (typeof PERMISSION)[number];

export const RESULTS = ['detailed', 'summary', 'result-only'] as const;
export type Results = (typeof RESULTS)[number];

/** How TokenSeal's optional optimizations behave. */
export const RUN_MODE = ['active', 'shadow'] as const;
export type RunMode = (typeof RUN_MODE)[number];

export interface TokenSealConfig {
  schemaVersion: number;
  /** Semver of the CLI that wrote this config. */
  version: string;
  installedAt: string;
  presentation: {
    verbosity: Verbosity;
    notify: Notify;
    permission: Permission;
    results: Results;
  };
  optimization: {
    /** `shadow` computes decisions and measures but never changes behavior. */
    mode: RunMode;
    /** Individual output filters; disabled here overrides adaptive logic. */
    filters: {
      passingTestOutput: boolean;
      largeJson: boolean;
      bashNoise: boolean;
    };
    /** Warn when the active context budget is exceeded. */
    contextBudgetWarnings: boolean;
  };
  /** Telemetry is OFF and local-only in v0.1.0. Kept for schema stability. */
  telemetry: {
    enabled: false;
    localOnly: true;
  };
}

export const DEFAULT_PRESENTATION: TokenSealConfig['presentation'] = {
  verbosity: 'summary',
  notify: 'decisions',
  permission: 'risky',
  results: 'summary',
};

export function defaultConfig(version: string, now: string): TokenSealConfig {
  return {
    schemaVersion: SCHEMA_VERSION,
    version,
    installedAt: now,
    presentation: { ...DEFAULT_PRESENTATION },
    optimization: {
      mode: 'active',
      filters: { passingTestOutput: true, largeJson: true, bashNoise: true },
      contextBudgetWarnings: true,
    },
    telemetry: { enabled: false, localOnly: true },
  };
}
