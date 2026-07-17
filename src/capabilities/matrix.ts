/**
 * Capability matrix.
 *
 * TokenSeal must never emit config a given Claude Code version cannot honor.
 * We detect the installed version once and gate every optional feature behind
 * this matrix, degrading to documented fallbacks instead of writing broken
 * config or claiming success we cannot deliver.
 */
import { run } from '../utils/proc.ts';
import { claudeUserDir } from '../utils/paths.ts';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  raw: string;
}

export interface CapabilityMatrix {
  claudeCodeInstalled: boolean;
  claudeCodeVersion: string | null;
  capabilities: {
    plugins: boolean;
    userScopePlugins: boolean;
    subagents: boolean;
    subagentModels: boolean;
    subagentWorktrees: boolean;
    worktreeBaseRef: boolean;
    statusLine: boolean;
    preCompactHook: boolean;
    postCompactHook: boolean;
    subagentLifecycleHooks: boolean;
    taskCompletedHook: boolean;
    effortLevels: string[];
  };
  /** Human-readable notes about anything unsupported, for doctor/status. */
  notes: string[];
}

/** Minimum Claude Code version TokenSeal's base layer targets. */
export const MIN_SUPPORTED = '2.0.0';
/** Version at/above which every enhanced feature we use is available. */
export const FULLY_SUPPORTED = '2.1.128';

export function parseSemVer(input: string): SemVer | null {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(input);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    raw: `${m[1]}.${m[2]}.${m[3]}`,
  };
}

/** Returns negative/0/positive like a comparator. Missing → treated as lowest. */
export function compareSemVer(a: SemVer | null, b: SemVer | null): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

export function gte(version: string | null, min: string): boolean {
  return compareSemVer(parseSemVer(version ?? ''), parseSemVer(min)) >= 0;
}

/** Build the matrix from a version string (pure — easy to unit test). */
export function matrixForVersion(version: string | null): CapabilityMatrix {
  const installed = version !== null;
  const full = gte(version, FULLY_SUPPORTED);
  const base = gte(version, MIN_SUPPORTED);
  const notes: string[] = [];
  if (installed && !base) {
    notes.push(`Claude Code ${version} is below the minimum supported ${MIN_SUPPORTED}.`);
  }
  if (installed && base && !full) {
    notes.push(
      `Claude Code ${version} predates ${FULLY_SUPPORTED}; worktree isolation and ` +
        `compaction hooks fall back to snapshot-based checkpoints.`,
    );
  }
  return {
    claudeCodeInstalled: installed,
    claudeCodeVersion: version,
    capabilities: {
      plugins: base,
      userScopePlugins: base,
      subagents: base,
      subagentModels: base,
      subagentWorktrees: full,
      worktreeBaseRef: full,
      statusLine: base,
      preCompactHook: full,
      postCompactHook: full,
      subagentLifecycleHooks: full,
      taskCompletedHook: full,
      effortLevels: full
        ? ['low', 'medium', 'high', 'xhigh', 'max']
        : base
          ? ['low', 'medium', 'high']
          : [],
    },
    notes,
  };
}

/** Probe the environment: run `claude --version` and note the user dir. */
export async function detectCapabilities(claudeBin = 'claude'): Promise<CapabilityMatrix> {
  const res = await run(claudeBin, ['--version'], { timeoutMs: 10_000 });
  const version = res.spawnError ? null : (parseSemVer(res.stdout)?.raw ?? null);
  const matrix = matrixForVersion(version);
  if (!matrix.claudeCodeInstalled) {
    matrix.notes.push('Claude Code CLI not found on PATH. Install it before running setup.');
  }
  const userDir = claudeUserDir();
  if (
    matrix.claudeCodeInstalled &&
    !existsSync(join(userDir, 'settings.json')) &&
    !existsSync(userDir)
  ) {
    matrix.notes.push(`No ${userDir} found yet; setup will create it.`);
  }
  return matrix;
}
