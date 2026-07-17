/**
 * Capture a point-in-time view of a git working tree.
 *
 * The snapshot is taken *before* an agent task runs so we can later separate
 * files the user had already dirtied from files the agent changed. Everything
 * is best-effort: a non-repo (or a missing `git` binary) yields an inert
 * snapshot rather than throwing, because a failed snapshot must never break a
 * task.
 */
import { run } from '../utils/proc.ts';
import { parsePorcelainV2 } from './parse.ts';

export interface GitSnapshot {
  repoRoot: string;
  branch: string;
  headSha: string | null;
  isRepo: boolean;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  /** Union of staged+unstaged+untracked at capture time. */
  dirtyBeforeTask: string[];
  capturedAt: string;
}

function emptySnapshot(repoRoot: string, now: string): GitSnapshot {
  return {
    repoRoot,
    branch: '',
    headSha: null,
    isRepo: false,
    staged: [],
    unstaged: [],
    untracked: [],
    dirtyBeforeTask: [],
    capturedAt: now,
  };
}

function union(...lists: string[][]): string[] {
  const set = new Set<string>();
  for (const list of lists) for (const item of list) set.add(item);
  return [...set].sort();
}

/**
 * Capture a {@link GitSnapshot} for `repoRoot`. `now` is an ISO timestamp
 * supplied by the caller so snapshots are deterministic in tests.
 */
export async function captureSnapshot(repoRoot: string, now: string): Promise<GitSnapshot> {
  const topLevel = await run('git', ['-C', repoRoot, 'rev-parse', '--show-toplevel']);
  if (topLevel.spawnError || topLevel.code !== 0) {
    return emptySnapshot(repoRoot, now);
  }
  const resolvedRoot = topLevel.stdout.trim() || repoRoot;

  const branchRes = await run('git', ['-C', resolvedRoot, 'rev-parse', '--abbrev-ref', 'HEAD']);
  const branch = !branchRes.spawnError && branchRes.code === 0 ? branchRes.stdout.trim() : '';

  const headRes = await run('git', ['-C', resolvedRoot, 'rev-parse', 'HEAD']);
  const headSha =
    !headRes.spawnError && headRes.code === 0 && headRes.stdout.trim()
      ? headRes.stdout.trim()
      : null;

  const statusRes = await run('git', [
    '-C',
    resolvedRoot,
    'status',
    '--porcelain=v2',
    '--untracked-files=all',
  ]);
  const status =
    !statusRes.spawnError && statusRes.code === 0
      ? parsePorcelainV2(statusRes.stdout)
      : { staged: [], unstaged: [], untracked: [] };

  return {
    repoRoot: resolvedRoot,
    branch,
    headSha,
    isRepo: true,
    staged: status.staged,
    unstaged: status.unstaged,
    untracked: status.untracked,
    dirtyBeforeTask: union(status.staged, status.unstaged, status.untracked),
    capturedAt: now,
  };
}
