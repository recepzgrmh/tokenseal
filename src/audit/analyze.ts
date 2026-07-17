/**
 * Local, read-only audits. These NEVER modify user files — they produce a
 * report and suggested classification only (KEEP / MOVE-TO-SKILL / DELETE ...).
 */
import { join } from 'node:path';
import { existsSync, readFileSync, statSync, readdirSync } from 'node:fs';
import { claudeUserDir, tokensealDataDir } from '../utils/paths.ts';
import { approxTokens, countLines } from '../utils/text.ts';

export interface AuditFinding {
  id: string;
  level: 'info' | 'warn';
  title: string;
  detail: string;
  suggestion: string;
}

export interface AuditReport {
  findings: AuditFinding[];
  metrics: Record<string, number>;
}

function safeRead(path: string): string | undefined {
  try {
    return existsSync(path) ? readFileSync(path, 'utf8') : undefined;
  } catch {
    return undefined;
  }
}

function dirSizeBytes(dir: string): number {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    try {
      total += entry.isDirectory() ? dirSizeBytes(p) : statSync(p).size;
    } catch {
      /* ignore */
    }
  }
  return total;
}

/** Count configured MCP servers across the common Claude config locations. */
export function countMcpServers(userDir = claudeUserDir()): number {
  let count = 0;
  for (const file of ['settings.json', join('..', '.claude.json')]) {
    const raw = safeRead(join(userDir, file));
    if (!raw) continue;
    try {
      const obj = JSON.parse(raw) as { mcpServers?: Record<string, unknown> };
      if (obj.mcpServers) count += Object.keys(obj.mcpServers).length;
    } catch {
      /* ignore */
    }
  }
  return count;
}

const CLAUDE_MD_TOKEN_WARN = 2500;
const MCP_WARN = 10;

/** Produce an audit report for a user dir (+ optional project cwd). */
export function auditContext(userDir = claudeUserDir(), projectDir = process.cwd()): AuditReport {
  const findings: AuditFinding[] = [];
  const metrics: Record<string, number> = {};

  const userClaudeMd = safeRead(join(userDir, 'CLAUDE.md'));
  if (userClaudeMd) {
    const tokens = approxTokens(userClaudeMd);
    metrics.userClaudeMdTokens = tokens;
    metrics.userClaudeMdLines = countLines(userClaudeMd);
    if (tokens > CLAUDE_MD_TOKEN_WARN) {
      findings.push({
        id: 'user-claude-md-large',
        level: 'warn',
        title: 'User CLAUDE.md is large',
        detail: `~${tokens} tokens loaded every session.`,
        suggestion: 'Move task-specific procedures to skills; keep only every-task invariants.',
      });
    }
  }

  const projectClaudeMd = safeRead(join(projectDir, 'CLAUDE.md'));
  if (projectClaudeMd) {
    metrics.projectClaudeMdTokens = approxTokens(projectClaudeMd);
  }

  const mcp = countMcpServers(userDir);
  metrics.mcpServers = mcp;
  if (mcp > MCP_WARN) {
    findings.push({
      id: 'many-mcp',
      level: 'warn',
      title: `Many MCP servers enabled (${mcp})`,
      detail: 'Each server injects tool schemas that consume the context window.',
      suggestion: 'Disable unused MCP servers or scope them to the projects that need them.',
    });
  }

  const memoryDir = join(userDir, 'memory');
  if (existsSync(memoryDir)) {
    const bytes = dirSizeBytes(memoryDir);
    metrics.memoryBytes = bytes;
    if (bytes > 200_000) {
      findings.push({
        id: 'memory-bloat',
        level: 'warn',
        title: 'Memory directory is large',
        detail: `~${Math.round(bytes / 1024)} KiB of memory files.`,
        suggestion: 'Archive stale memories; keep the index small and deduplicated.',
      });
    }
  }

  const receiptBytes = dirSizeBytes(join(tokensealDataDir(), 'receipts'));
  metrics.receiptBytes = receiptBytes;
  if (receiptBytes > 500_000) {
    findings.push({
      id: 'receipt-bloat',
      level: 'info',
      title: 'Receipt store is large',
      detail: `~${Math.round(receiptBytes / 1024)} KiB of receipts.`,
      suggestion: 'Rotation keeps the newest 50 by default; lower the cap if needed.',
    });
  }

  if (findings.length === 0) {
    findings.push({
      id: 'clean',
      level: 'info',
      title: 'No context inefficiencies detected',
      detail: 'CLAUDE.md, MCP, memory, and receipts are within healthy thresholds.',
      suggestion: 'Re-run after major changes to your setup.',
    });
  }

  return { findings, metrics };
}
