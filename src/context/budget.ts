/**
 * Context budgeting.
 *
 * Word/character budgets for what the main agent, subagents, and tools are
 * allowed to emit into context. These are SAFE DEFAULTS: reasonable starting
 * points that are benchmark-tunable, not proven-optimal. Treat them as guard
 * rails, not hard science.
 */

export interface ContextBudget {
  mainContext: {
    explorationSummaryWords: number;
    testFailureWords: number;
    reviewFindingsWords: number;
    receiptWords: number;
  };
  subagents: {
    explorerOutputWords: number;
    testAnalyzerOutputWords: number;
    reviewerOutputWords: number;
  };
  tools: {
    inlineOutputCharacters: number;
    failureContextCharacters: number;
    fullOutputStorage: boolean;
  };
}

/**
 * Default budget. Safe defaults, benchmark-tunable, not proven-optimal.
 */
export const DEFAULT_BUDGET: ContextBudget = {
  mainContext: {
    explorationSummaryWords: 800,
    testFailureWords: 600,
    reviewFindingsWords: 800,
    receiptWords: 300,
  },
  subagents: {
    explorerOutputWords: 500,
    testAnalyzerOutputWords: 500,
    reviewerOutputWords: 1000,
  },
  tools: {
    inlineOutputCharacters: 12_000,
    failureContextCharacters: 20_000,
    fullOutputStorage: true,
  },
};

/** Count whitespace-delimited words. Empty/whitespace-only text is 0. */
export function wordCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return 0;
  return trimmed.split(/\s+/).length;
}

/** True when `text` is at or under `maxWords`. */
export function withinBudget(text: string, maxWords: number): boolean {
  return wordCount(text) <= maxWords;
}

/**
 * Check a tool output's byte size against the inline character budget.
 * Returns whether it is over budget and the limit that applied.
 */
export function checkToolOutput(
  bytes: number,
  budget: ContextBudget = DEFAULT_BUDGET,
): { overBudget: boolean; limit: number } {
  const limit = budget.tools.inlineOutputCharacters;
  return { overBudget: bytes > limit, limit };
}
