/**
 * Config validation. Pure functions, no I/O — trivially unit testable.
 */
import {
  NOTIFY,
  PERMISSION,
  RESULTS,
  RUN_MODE,
  SCHEMA_VERSION,
  VERBOSITY,
  type TokenSealConfig,
} from './schema.ts';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  /** Present when ok — the normalized, fully-typed config. */
  value?: TokenSealConfig;
}

function isOneOf<T extends readonly string[]>(val: unknown, allowed: T): val is T[number] {
  return typeof val === 'string' && (allowed as readonly string[]).includes(val);
}

/**
 * Validate an unknown blob into a TokenSealConfig, collecting *all* errors
 * (not just the first) so `tokenseal doctor` can report them together.
 */
export function validateConfig(raw: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, errors: ['config is not an object'] };
  }
  const c = raw as Record<string, unknown>;

  if (c.schemaVersion !== SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${SCHEMA_VERSION}, got ${String(c.schemaVersion)}`);
  }
  if (typeof c.version !== 'string') errors.push('version must be a string');
  if (typeof c.installedAt !== 'string') errors.push('installedAt must be a string');

  const p = c.presentation as Record<string, unknown> | undefined;
  if (!p || typeof p !== 'object') {
    errors.push('presentation missing');
  } else {
    if (!isOneOf(p.verbosity, VERBOSITY))
      errors.push(`presentation.verbosity invalid: ${String(p.verbosity)}`);
    if (!isOneOf(p.notify, NOTIFY)) errors.push(`presentation.notify invalid: ${String(p.notify)}`);
    if (!isOneOf(p.permission, PERMISSION))
      errors.push(`presentation.permission invalid: ${String(p.permission)}`);
    if (!isOneOf(p.results, RESULTS))
      errors.push(`presentation.results invalid: ${String(p.results)}`);
  }

  const o = c.optimization as Record<string, unknown> | undefined;
  if (!o || typeof o !== 'object') {
    errors.push('optimization missing');
  } else {
    if (!isOneOf(o.mode, RUN_MODE)) errors.push(`optimization.mode invalid: ${String(o.mode)}`);
    const f = o.filters as Record<string, unknown> | undefined;
    if (!f || typeof f !== 'object') {
      errors.push('optimization.filters missing');
    } else {
      for (const key of ['passingTestOutput', 'largeJson', 'bashNoise']) {
        if (typeof f[key] !== 'boolean') errors.push(`optimization.filters.${key} must be boolean`);
      }
    }
    if (typeof o.contextBudgetWarnings !== 'boolean') {
      errors.push('optimization.contextBudgetWarnings must be boolean');
    }
  }

  const t = c.telemetry as Record<string, unknown> | undefined;
  if (!t || t.enabled !== false || t.localOnly !== true) {
    errors.push('telemetry must be { enabled: false, localOnly: true }');
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, errors: [], value: raw as TokenSealConfig };
}
