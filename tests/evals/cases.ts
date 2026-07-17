/**
 * TokenSeal eval suite.
 *
 * These are DETERMINISTIC component evals (no live LLM) that exercise the
 * decisions TokenSeal makes on the 15 required scenarios, and double as
 * regression tests. Following Anthropic's "Demystifying Evals" guidance we
 * include two-sided cases (a behavior should fire AND should not over-fire).
 * They are honest about what they measure: filter token reduction, routing,
 * the completion-gate state machine, change separation, and audit signals —
 * not an end-to-end session outcome.
 */
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { filterOutput } from '../../src/filters/index.ts';
import { approxTokens } from '../../src/utils/text.ts';
import { ROUTES, aliasFor, resolveEffort } from '../../src/config/model-routing.ts';
import { matrixForVersion } from '../../src/capabilities/matrix.ts';
import { nextAction, type ReviewState } from '../../src/review/state-machine.ts';
import { separateUserVsAgent } from '../../src/git/user-changes.ts';
import type { GitSnapshot } from '../../src/git/snapshot.ts';
import { checkToolOutput } from '../../src/context/budget.ts';
import { auditContext } from '../../src/audit/analyze.ts';
import { newReceipt } from '../../src/receipts/schema.ts';
import { writeReceipt, latestReceipt } from '../../src/receipts/store.ts';
import { maskSecrets } from '../../src/security/masking.ts';

export type Category = 'trivial' | 'standard' | 'complex' | 'critical' | 'context';

export interface EvalResult {
  pass: boolean;
  detail: string;
  metrics: Record<string, number>;
}

export interface EvalCase {
  id: string;
  name: string;
  category: Category;
  run: () => EvalResult;
}

function tmp(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function reviewState(p: Partial<ReviewState>): ReviewState {
  return {
    retryCount: 0,
    escalated: false,
    verificationPassed: false,
    finalReviewDecision: null,
    externalBlocker: false,
    ...p,
  };
}

function snapshot(p: Partial<GitSnapshot>): GitSnapshot {
  return {
    repoRoot: '/r',
    branch: 'main',
    headSha: 'abc',
    isRepo: true,
    staged: [],
    unstaged: [],
    untracked: [],
    dirtyBeforeTask: [],
    capturedAt: '2026-07-17T00:00:00Z',
    ...p,
  };
}

export const CASES: EvalCase[] = [
  {
    id: 'small-bug-fix',
    name: 'Small bug fix keeps the failing assertion visible',
    category: 'standard',
    run: () => {
      const text =
        'PASS a\n'.repeat(20) + 'FAIL b\nAssertionError: expected 1 to equal 2\n at b:12';
      const r = filterOutput({ text, command: 'npm test', exitCode: 1, kind: 'test' });
      return {
        pass:
          r.filtered.includes('AssertionError') &&
          r.recoverable &&
          r.strategy === 'failure-preserve',
        detail: `strategy=${r.strategy}`,
        metrics: { inputTokens: approxTokens(text), outputTokens: approxTokens(r.filtered) },
      };
    },
  },
  {
    id: 'trivial-one-line',
    name: 'Trivial tiny output is NOT over-processed (two-sided)',
    category: 'trivial',
    run: () => {
      const text = 'Done in 0.4s';
      const r = filterOutput({ text, command: 'npm run build', exitCode: 0 });
      return {
        pass: r.strategy.startsWith('passthrough') && r.filtered.includes('Done'),
        detail: `strategy=${r.strategy}`,
        metrics: { inputTokens: approxTokens(text), outputTokens: approxTokens(r.filtered) },
      };
    },
  },
  {
    id: 'large-log-analysis',
    name: 'Large log is compacted and remains recoverable',
    category: 'context',
    run: () => {
      const text = Array.from({ length: 900 }, (_, i) => `line ${i} ok`).join('\n');
      const r = filterOutput({ text, command: 'build.sh', exitCode: 0, kind: 'bash' });
      const inTok = approxTokens(text);
      const outTok = approxTokens(r.filtered);
      return {
        pass: r.recoverable && outTok < inTok * 0.5,
        detail: `reduction=${(r.reductionRatio * 100) | 0}% strategy=${r.strategy}`,
        metrics: { inputTokens: inTok, outputTokens: outTok },
      };
    },
  },
  {
    id: 'large-test-output',
    name: 'Passing test flood is summarized, recoverable',
    category: 'context',
    run: () => {
      const text = 'PASS src/x.test.ts\n'.repeat(200) + 'Tests: 200 passed';
      const r = filterOutput({ text, command: 'npm test', exitCode: 0, kind: 'test' });
      return {
        pass: r.recoverable && approxTokens(r.filtered) < approxTokens(text) * 0.5,
        detail: `strategy=${r.strategy}`,
        metrics: { inputTokens: approxTokens(text), outputTokens: approxTokens(r.filtered) },
      };
    },
  },
  {
    id: 'multi-file-feature',
    name: 'Receipt captures a multi-file change and validates',
    category: 'standard',
    run: () => {
      const dir = tmp('ts-eval-r-');
      const receipt = newReceipt({
        taskId: 'TS-EVAL-1',
        task: 'add feature',
        changedFiles: ['src/a.ts', 'src/b.ts', 'tests/a.test.ts'],
      });
      writeReceipt(receipt, dir);
      const latest = latestReceipt(dir);
      return {
        pass: !!latest && latest.changedFiles.length === 3,
        detail: `changed=${latest?.changedFiles.length}`,
        metrics: { changedFiles: latest?.changedFiles.length ?? 0 },
      };
    },
  },
  {
    id: 'root-cause-debugging',
    name: 'Failure diagnostics are never hidden',
    category: 'standard',
    run: () => {
      const text =
        'ok\n'.repeat(50) +
        'Traceback (most recent call last):\n  File x, line 3\nValueError: boom';
      const r = filterOutput({ text, command: 'pytest', exitCode: 1, kind: 'test' });
      return {
        pass: r.filtered.includes('ValueError: boom') && r.filtered.includes('Traceback'),
        detail: `strategy=${r.strategy}`,
        metrics: { outputTokens: approxTokens(r.filtered) },
      };
    },
  },
  {
    id: 'over-refactor-guard',
    name: 'Change separation flags edits overlapping user work',
    category: 'standard',
    run: () => {
      const before = snapshot({ unstaged: ['src/user.ts'], dirtyBeforeTask: ['src/user.ts'] });
      const sep = separateUserVsAgent(before, ['src/user.ts', 'src/new.ts']);
      return {
        pass:
          sep.overlappingWithUser.includes('src/user.ts') && sep.agentOnly.includes('src/new.ts'),
        detail: `overlap=${sep.overlappingWithUser.join(',')}`,
        metrics: { overlaps: sep.overlappingWithUser.length },
      };
    },
  },
  {
    id: 'critical-auth-change',
    name: 'Security-critical work routes to strongest + max effort',
    category: 'critical',
    run: () => {
      const route = ROUTES['critical-security'];
      const matrix = matrixForVersion('2.1.212');
      const effort = resolveEffort(route.effort, matrix);
      return {
        pass: aliasFor(route.modelClass) === 'opus' && effort === 'max',
        detail: `model=${aliasFor(route.modelClass)} effort=${effort}`,
        metrics: {},
      };
    },
  },
  {
    id: 'exploration-cheap',
    name: 'Exploration routes to low-cost (two-sided vs critical)',
    category: 'standard',
    run: () => {
      const r = ROUTES['exploration'];
      return {
        pass: aliasFor(r.modelClass) === 'haiku' && r.effort === 'low',
        detail: `model=${aliasFor(r.modelClass)}`,
        metrics: {},
      };
    },
  },
  {
    id: 'reviewer-rejected',
    name: 'A revise verdict triggers a bounded revision',
    category: 'standard',
    run: () => {
      const action = nextAction(reviewState({ finalReviewDecision: 'revise', retryCount: 0 }));
      return { pass: action === 'revise', detail: `action=${action}`, metrics: {} };
    },
  },
  {
    id: 'escalation-bounded',
    name: 'Retries escalate once, then return to user (no infinite loop)',
    category: 'complex',
    run: () => {
      const escalate = nextAction(reviewState({ finalReviewDecision: 'revise', retryCount: 2 }));
      const exhausted = nextAction(
        reviewState({ finalReviewDecision: 'revise', retryCount: 2, escalated: true }),
      );
      return {
        pass: escalate === 'escalate' && exhausted === 'return-to-user',
        detail: `escalate=${escalate} exhausted=${exhausted}`,
        metrics: {},
      };
    },
  },
  {
    id: 'long-session-compaction',
    name: 'Oversized tool output is flagged against the budget',
    category: 'context',
    run: () => {
      const big = checkToolOutput(50_000);
      const small = checkToolOutput(500);
      return {
        pass: big.overBudget && !small.overBudget,
        detail: `limit=${big.limit}`,
        metrics: { limit: big.limit },
      };
    },
  },
  {
    id: 'bloated-memory',
    name: 'Audit flags a bloated memory directory',
    category: 'context',
    run: () => {
      const userDir = tmp('ts-eval-mem-');
      mkdirSync(join(userDir, 'memory'), { recursive: true });
      writeFileSync(join(userDir, 'memory', 'big.md'), 'x'.repeat(300_000));
      const report = auditContext(userDir, tmp('ts-eval-proj-'));
      return {
        pass: report.findings.some((f) => f.id === 'memory-bloat'),
        detail: `findings=${report.findings.map((f) => f.id).join(',')}`,
        metrics: { memoryBytes: report.metrics.memoryBytes ?? 0 },
      };
    },
  },
  {
    id: 'many-mcp',
    name: 'Audit flags too many MCP servers',
    category: 'context',
    run: () => {
      const userDir = tmp('ts-eval-mcp-');
      const servers: Record<string, unknown> = {};
      for (let i = 0; i < 14; i++) servers[`srv${i}`] = { command: 'x' };
      writeFileSync(join(userDir, 'settings.json'), JSON.stringify({ mcpServers: servers }));
      const report = auditContext(userDir, tmp('ts-eval-proj2-'));
      return {
        pass: report.findings.some((f) => f.id === 'many-mcp'),
        detail: `mcp=${report.metrics.mcpServers}`,
        metrics: { mcpServers: report.metrics.mcpServers ?? 0 },
      };
    },
  },
  {
    id: 'what-did-you-do',
    name: 'explain-last data comes from the latest receipt, secrets masked',
    category: 'context',
    run: () => {
      const dir = tmp('ts-eval-wdyd-');
      writeReceipt(
        newReceipt({
          taskId: 'TS-EVAL-9',
          task: 'thing',
          changes: [
            { file: 'src/env.ts', kind: 'modified', note: 'set API_KEY=supersecretvalue1234' },
          ],
        }),
        dir,
      );
      const latest = latestReceipt(dir);
      const masked = maskSecrets('API_KEY=supersecretvalue1234') !== 'API_KEY=supersecretvalue1234';
      const stored = JSON.stringify(latest);
      return {
        pass: !!latest && masked && !stored.includes('supersecretvalue1234'),
        detail: `receipt=${latest?.taskId}`,
        metrics: {},
      };
    },
  },
];
