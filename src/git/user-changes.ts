/**
 * Attribute post-task file changes to the agent vs. the user.
 *
 * Files that were already dirty *before* the task ran and that the agent also
 * touched cannot be reliably attributed — editing them may have clobbered or
 * mixed in the user's in-progress work. We surface those as a risk
 * (`overlappingWithUser`) rather than silently claiming them as agent output.
 */
import type { GitSnapshot } from './snapshot.ts';

export interface ChangeAttribution {
  /** Files the agent changed that were clean before the task. */
  agentOnly: string[];
  /** Files dirty before the task that the agent also changed (risk). */
  overlappingWithUser: string[];
}

/**
 * Split `afterFiles` (files the agent changed) into agent-only vs. files that
 * overlap with the user's pre-existing dirty set from `before`.
 */
export function separateUserVsAgent(before: GitSnapshot, afterFiles: string[]): ChangeAttribution {
  const dirtyBefore = new Set(before.dirtyBeforeTask);
  const agentOnly = new Set<string>();
  const overlappingWithUser = new Set<string>();

  for (const file of afterFiles) {
    if (dirtyBefore.has(file)) {
      overlappingWithUser.add(file);
    } else {
      agentOnly.add(file);
    }
  }

  return {
    agentOnly: [...agentOnly].sort(),
    overlappingWithUser: [...overlappingWithUser].sort(),
  };
}
