/**
 * Pure parser for `git status --porcelain=v2 --untracked-files=all` output.
 *
 * Kept free of any I/O so it can be unit-tested against hand-written fixture
 * strings without a real repository.
 *
 * Porcelain v2 line kinds (space-delimited, one record per line):
 *   `1 <XY> ...  <path>`             ordinary changed tracked entry
 *   `2 <XY> ... <Xscore> <path>\t<orig>`  renamed/copied entry
 *   `u <XY> ...  <path>`             unmerged entry
 *   `? <path>`                       untracked
 *   `! <path>`                       ignored (skipped)
 *
 * `XY` is two status chars: X = index/staged status, Y = worktree status.
 * A field equal to '.' means "unchanged" in that dimension.
 */

export interface PorcelainStatus {
  staged: string[];
  unstaged: string[];
  untracked: string[];
}

/** Extract the pathname from a `1`/`2`/`u` record's tokens. */
function pathFromFields(fields: string[], startIndex: number): string | null {
  const rest = fields.slice(startIndex).join(' ');
  if (!rest) return null;
  // Renamed/copied (`2`) entries encode `<new>\t<orig>`; keep the new path.
  const tabIdx = rest.indexOf('\t');
  return tabIdx === -1 ? rest : rest.slice(0, tabIdx);
}

/**
 * Parse porcelain-v2 stdout into deduplicated, sorted staged/unstaged/untracked
 * path lists.
 */
export function parsePorcelainV2(stdout: string): PorcelainStatus {
  const staged = new Set<string>();
  const unstaged = new Set<string>();
  const untracked = new Set<string>();

  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (!line) continue;
    const kind = line[0];

    if (kind === '?') {
      const p = line.slice(2).trim();
      if (p) untracked.add(p);
      continue;
    }
    if (kind === '!') {
      // Ignored entries are not a change we track.
      continue;
    }

    const fields = line.split(' ');
    const xy = fields[1] ?? '';
    const indexStatus = xy[0] ?? '.';
    const worktreeStatus = xy[1] ?? '.';

    if (kind === '1') {
      const p = pathFromFields(fields, 8);
      if (!p) continue;
      if (indexStatus !== '.') staged.add(p);
      if (worktreeStatus !== '.') unstaged.add(p);
      continue;
    }
    if (kind === '2') {
      // Rename/copy has an extra `<Xscore>` field before the path.
      const p = pathFromFields(fields, 9);
      if (!p) continue;
      if (indexStatus !== '.') staged.add(p);
      if (worktreeStatus !== '.') unstaged.add(p);
      continue;
    }
    if (kind === 'u') {
      // Unmerged: cannot be cleanly attributed, so it counts as both.
      const p = pathFromFields(fields, 10);
      if (!p) continue;
      staged.add(p);
      unstaged.add(p);
      continue;
    }
  }

  return {
    staged: [...staged].sort(),
    unstaged: [...unstaged].sort(),
    untracked: [...untracked].sort(),
  };
}
