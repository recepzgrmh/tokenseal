/**
 * Task-receipt schema.
 *
 * A receipt is the durable, auditable record of one task: what changed, which
 * agents/models ran, verification outcomes, retries, escalations, and any
 * blockers. Receipts are always masked before persistence (see store.ts), so
 * they must never carry raw secrets.
 */

export const RECEIPT_SCHEMA_VERSION = 1 as const;

export const RECEIPT_STATUS = [
  'in-progress',
  'completed',
  'blocked',
  'returned-to-user',
  'failed',
] as const;
export type ReceiptStatus = (typeof RECEIPT_STATUS)[number];

/** A single logical change the agent made, with a human-readable note. */
export interface ReceiptChange {
  file: string;
  kind: 'added' | 'modified' | 'deleted' | 'renamed';
  note: string;
}

/** Outcome of each verification gate. `null` = not run / unknown. */
export interface VerificationResult {
  testsPassed: number;
  testsFailed: number;
  lintPassed: boolean | null;
  typeCheckPassed: boolean | null;
  buildPassed: boolean | null;
}

/** One escalation event (a jump to a stronger model class). */
export interface EscalationRecord {
  at: string;
  fromModelClass: string;
  toModelClass: string;
  reason: string;
}

export interface TaskReceipt {
  schemaVersion: number;
  taskId: string;
  task: string;
  status: ReceiptStatus;
  startedAt: string;
  completedAt: string | null;
  /** Commit the task branched from. */
  baselineCommit: string | null;
  /** HEAD after integration of the task's work. */
  integrationHead: string | null;
  agentCommits: string[];
  reviewFixCommits: string[];
  changedFiles: string[];
  changes: ReceiptChange[];
  verification: VerificationResult;
  agents: string[];
  modelClasses: string[];
  escalations: EscalationRecord[];
  retryCount: number;
  warnings: string[];
  externalBlockers: string[];
}

export function newVerification(partial: Partial<VerificationResult> = {}): VerificationResult {
  return {
    testsPassed: partial.testsPassed ?? 0,
    testsFailed: partial.testsFailed ?? 0,
    lintPassed: partial.lintPassed ?? null,
    typeCheckPassed: partial.typeCheckPassed ?? null,
    buildPassed: partial.buildPassed ?? null,
  };
}

/**
 * Build a fully-populated {@link TaskReceipt} from a partial, filling sane
 * defaults so callers only supply what they know.
 */
export function newReceipt(partial: Partial<TaskReceipt> = {}): TaskReceipt {
  return {
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    taskId: partial.taskId ?? '',
    task: partial.task ?? '',
    status: partial.status ?? 'in-progress',
    startedAt: partial.startedAt ?? new Date(0).toISOString(),
    completedAt: partial.completedAt ?? null,
    baselineCommit: partial.baselineCommit ?? null,
    integrationHead: partial.integrationHead ?? null,
    agentCommits: partial.agentCommits ?? [],
    reviewFixCommits: partial.reviewFixCommits ?? [],
    changedFiles: partial.changedFiles ?? [],
    changes: partial.changes ?? [],
    verification: partial.verification ?? newVerification(),
    agents: partial.agents ?? [],
    modelClasses: partial.modelClasses ?? [],
    escalations: partial.escalations ?? [],
    retryCount: partial.retryCount ?? 0,
    warnings: partial.warnings ?? [],
    externalBlockers: partial.externalBlockers ?? [],
  };
}

export interface ReceiptValidation {
  ok: boolean;
  errors: string[];
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

/**
 * Validate an unknown blob as a {@link TaskReceipt}, collecting every error so
 * a doctor-style tool can report them together.
 */
export function validateReceipt(raw: unknown): ReceiptValidation {
  const errors: string[] = [];
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, errors: ['receipt is not an object'] };
  }
  const r = raw as Record<string, unknown>;

  if (r.schemaVersion !== RECEIPT_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${RECEIPT_SCHEMA_VERSION}, got ${String(r.schemaVersion)}`);
  }
  if (typeof r.taskId !== 'string' || r.taskId.length === 0) {
    errors.push('taskId must be a non-empty string');
  }
  if (typeof r.task !== 'string') errors.push('task must be a string');
  if (!(RECEIPT_STATUS as readonly string[]).includes(r.status as string)) {
    errors.push(`status must be one of ${RECEIPT_STATUS.join(', ')}, got ${String(r.status)}`);
  }
  if (typeof r.startedAt !== 'string') errors.push('startedAt must be a string');
  if (r.completedAt !== null && typeof r.completedAt !== 'string') {
    errors.push('completedAt must be a string or null');
  }
  if (r.baselineCommit !== null && typeof r.baselineCommit !== 'string') {
    errors.push('baselineCommit must be a string or null');
  }
  if (r.integrationHead !== null && typeof r.integrationHead !== 'string') {
    errors.push('integrationHead must be a string or null');
  }
  if (!isStringArray(r.agentCommits)) errors.push('agentCommits must be a string[]');
  if (!isStringArray(r.reviewFixCommits)) errors.push('reviewFixCommits must be a string[]');
  if (!isStringArray(r.changedFiles)) errors.push('changedFiles must be a string[]');
  if (!Array.isArray(r.changes)) errors.push('changes must be an array');
  if (!isStringArray(r.agents)) errors.push('agents must be a string[]');
  if (!isStringArray(r.modelClasses)) errors.push('modelClasses must be a string[]');
  if (!Array.isArray(r.escalations)) errors.push('escalations must be an array');
  if (typeof r.retryCount !== 'number' || r.retryCount < 0) {
    errors.push('retryCount must be a non-negative number');
  }
  if (!isStringArray(r.warnings)) errors.push('warnings must be a string[]');
  if (!isStringArray(r.externalBlockers)) errors.push('externalBlockers must be a string[]');

  const v = r.verification;
  if (typeof v !== 'object' || v === null) {
    errors.push('verification must be an object');
  } else {
    const ver = v as Record<string, unknown>;
    if (typeof ver.testsPassed !== 'number')
      errors.push('verification.testsPassed must be a number');
    if (typeof ver.testsFailed !== 'number')
      errors.push('verification.testsFailed must be a number');
  }

  return { ok: errors.length === 0, errors };
}
