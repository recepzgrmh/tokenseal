/**
 * Types for adaptive output filtering.
 *
 * A filter takes raw tool/command output and returns a possibly-reduced,
 * always secret-masked view, while preserving the full (masked) output on disk
 * so nothing important is ever lost. Reduction is ADAPTIVE: failures are
 * preserved verbatim, only clearly-redundant success output is compacted.
 */

export interface FilterInput {
  /** Raw output text (stdout/stderr merged or a file dump). */
  text: string;
  /** Command that produced the text, e.g. "npm test", "cat big.json". */
  command?: string;
  /** Process exit code if known (non-zero is treated as a failure signal). */
  exitCode?: number;
  /** Hint about the payload. Defaults to 'auto' (classified from command/text). */
  kind?: 'bash' | 'test' | 'json' | 'auto';
  /** 'full' disables filtering (still masks secrets); 'normal' is the default. */
  requestedDetail?: 'full' | 'normal';
}

export interface FilterResult {
  /** Secret-masked, possibly-truncated text safe to hand back to the model. */
  filtered: string;
  /** Which rule fired (e.g. 'passthrough', 'failure-preserve', 'json-summary'). */
  strategy: string;
  /** Byte length of the original input text. */
  originalBytes: number;
  /** Byte length of the returned `filtered` text. */
  filteredBytes: number;
  /** True when the full (masked) output was stored and can be recovered. */
  recoverable: boolean;
  /** Path to the full (masked) output on disk, when stored. */
  storedPath?: string;
  /** 1 - filteredBytes/originalBytes; 0 when nothing was reduced. */
  reductionRatio: number;
}
