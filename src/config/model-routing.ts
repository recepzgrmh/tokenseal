/**
 * Central model + effort routing policy.
 *
 * Short-lived model version names must NOT be scattered across the codebase.
 * Everything refers to a model *class* here; the class maps to a Claude Code
 * alias resolved at runtime by Claude Code itself. Effort is a separate axis.
 *
 * Routing rule of thumb (see docs/model-routing.md):
 *   file/symbol search, log classification, receipt explain → low-cost
 *   standard implementation, test writing, verification      → balanced
 *   architecture, security, high-uncertainty, escalation     → strongest
 */
import type { CapabilityMatrix } from '../capabilities/matrix.ts';

export type ModelClass = 'low-cost' | 'balanced' | 'strongest';
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/** Model class → Claude Code alias. Only place alias strings appear. */
export const MODEL_CLASS_ALIAS: Record<ModelClass, string> = {
  'low-cost': 'haiku',
  balanced: 'sonnet',
  strongest: 'opus',
};

export type RouteName =
  | 'exploration'
  | 'log-analysis'
  | 'standard-implementation'
  | 'verification'
  | 'architecture'
  | 'critical-security'
  | 'receipt-explanation';

export interface Route {
  modelClass: ModelClass;
  effort: Effort;
}

export const ROUTES: Record<RouteName, Route> = {
  exploration: { modelClass: 'low-cost', effort: 'low' },
  'log-analysis': { modelClass: 'low-cost', effort: 'medium' },
  'standard-implementation': { modelClass: 'balanced', effort: 'high' },
  verification: { modelClass: 'balanced', effort: 'high' },
  architecture: { modelClass: 'strongest', effort: 'high' },
  'critical-security': { modelClass: 'strongest', effort: 'max' },
  'receipt-explanation': { modelClass: 'low-cost', effort: 'low' },
};

/**
 * Clamp a desired effort to what the installed Claude Code supports, so we
 * never write an unsupported effort value. Falls back to the highest available.
 */
export function resolveEffort(desired: Effort, matrix: CapabilityMatrix): Effort {
  const supported = matrix.capabilities.effortLevels as Effort[];
  if (supported.length === 0) return desired; // caller should omit effort entirely
  if (supported.includes(desired)) return desired;
  const order: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];
  const desiredRank = order.indexOf(desired);
  // Highest supported that does not exceed desired, else the highest supported.
  const eligible = supported.filter((e) => order.indexOf(e) <= desiredRank);
  return (
    eligible.length ? eligible[eligible.length - 1] : supported[supported.length - 1]
  ) as Effort;
}

export function aliasFor(modelClass: ModelClass): string {
  return MODEL_CLASS_ALIAS[modelClass];
}
