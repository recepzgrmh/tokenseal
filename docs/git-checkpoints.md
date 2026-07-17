# Git Checkpoints

TokenSeal uses git as short-term task memory and a quality checkpoint. It never
rewrites your history and never claims your changes as its own.

## Baseline snapshot (`src/git/`)

At the start of a code task, `captureSnapshot(repoRoot, now)` records: repo root,
branch, HEAD SHA, and the working-tree status parsed from
`git status --porcelain=v2 --untracked-files=all` (staged / unstaged / untracked).
The union of dirty files is stored as `dirtyBeforeTask`.

If git is missing or the directory is not a repository, `captureSnapshot` returns
`{ isRepo: false, … }` with empty arrays — **it never throws**, so a checkpoint
can't break a task.

`parsePorcelainV2` is a pure function (unit-tested without a real repo), so status
parsing is deterministic and portable.

## User vs. agent changes

`separateUserVsAgent(before, agentChangedFiles)` splits the agent's changed files
into `agentOnly` and `overlappingWithUser` (files that were already dirty before
the task). Overlap is treated as a **risk**: TokenSeal cannot reliably attribute
edits in a file you were also editing, and surfaces it rather than guessing.

## Agent isolation

Where the installed Claude Code supports it, write-capable subagents run with
`isolation: worktree` so parallel work can't collide. Where it is unsupported (or
you're not in a repo), TokenSeal falls back to snapshot-diff checkpoints. The
capability matrix decides which path is used.

## Commit policy

- Only write-capable roles (implementation, review-fixer) create commits, and by
  default only inside an ephemeral task branch/worktree.
- Your active branch is **not** auto-committed; the reviewed patch is applied to
  your working tree and left uncommitted unless you ask for a commit.
- Reviewer fixes are new commits — never `--amend` of a prior agent commit.
- Your pre-existing changes are never staged, committed, reset, or discarded.
