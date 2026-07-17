/**
 * Command handlers. Each returns a process exit code. Kept together because
 * each is small; shared logic lives in the src/ libraries they call.
 */
import { tokensealVersion } from '../version.ts';
import { tokensealDataDir, claudeUserDir } from '../utils/paths.ts';
import { c, ok, warn, fail, info, heading, printJson, SEAL } from './ui.ts';
import { runWizard, defaultAnswers } from './wizard.ts';
import { runDoctor } from './doctor.ts';
import { installPlugin, uninstallPlugin } from '../installer/install.ts';
import { loadConfig, saveConfig, configExists } from '../config/store.ts';
import { defaultConfig, type TokenSealConfig } from '../config/schema.ts';
import { auditContext } from '../audit/analyze.ts';
import { runBenchmark } from '../benchmark/benchmark.ts';
import { latestReceipt } from '../receipts/store.ts';

function nowIso(): string {
  return new Date().toISOString();
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

// ---------------------------------------------------------------- setup
export async function cmdSetup(args: string[]): Promise<number> {
  const version = tokensealVersion();
  const now = nowIso();
  const interactive = !hasFlag(args, '--yes') && !hasFlag(args, '-y');
  info(`${SEAL} ${c.bold('TokenSeal setup')} — ${c.dim('Seal token leaks. Ship reviewed code.')}`);

  const doctorBefore = await runDoctor({ version, now });
  const claude = doctorBefore.checks.find((ch) => ch.name === 'claude-code');
  if (claude?.status === 'fail') {
    fail(claude.detail);
    info('Install Claude Code first: https://code.claude.com');
    return 1;
  }

  const answers = interactive ? await runWizard(true) : defaultAnswers();
  const existing = configExists() ? loadConfig(version, now).config : defaultConfig(version, now);
  const config: TokenSealConfig = { ...existing, version, presentation: answers };
  if (!config.installedAt) config.installedAt = now;
  saveConfig(config);
  ok('Saved preferences to ~/.claude/tokenseal/config.json');

  heading('Installing plugin (user scope)…');
  const result = await installPlugin({ version });
  for (const step of result.steps) {
    (step.ok ? ok : fail)(`${step.name}: ${step.detail || (step.ok ? 'ok' : 'failed')}`);
  }
  if (!result.ok) {
    fail(result.rolledBack ? 'Setup failed; partial install rolled back.' : 'Setup failed.');
    return 1;
  }

  const doctorAfter = await runDoctor({ version, now });
  heading('Doctor');
  for (const ch of doctorAfter.checks) {
    const mark =
      ch.status === 'pass' ? c.green('✔') : ch.status === 'warn' ? c.yellow('⚠') : c.red('✖');
    info(`  ${mark} ${ch.name}: ${c.dim(ch.detail)}`);
  }

  heading('Done');
  ok('TokenSeal is active. Just keep using Claude Code:');
  info(`  ${c.cyan('claude')}`);
  info(c.dim('Quality, verification, and security are identical on every profile.'));
  return doctorAfter.ok ? 0 : 0;
}

// ---------------------------------------------------------------- doctor
export async function cmdDoctor(args: string[]): Promise<number> {
  const report = await runDoctor({ version: tokensealVersion(), now: nowIso() });
  if (hasFlag(args, '--json')) {
    printJson(report);
    return report.ok ? 0 : 1;
  }
  heading(`${SEAL} TokenSeal doctor`);
  for (const ch of report.checks) {
    const mark =
      ch.status === 'pass' ? c.green('✔') : ch.status === 'warn' ? c.yellow('⚠') : c.red('✖');
    info(`  ${mark} ${c.bold(ch.name)} — ${ch.detail}`);
  }
  info('');
  (report.ok ? ok : fail)(report.ok ? 'All critical checks passed.' : 'Some checks failed.');
  return report.ok ? 0 : 1;
}

// ---------------------------------------------------------------- status
export async function cmdStatus(args: string[]): Promise<number> {
  const version = tokensealVersion();
  const now = nowIso();
  const installed = configExists();
  const config = installed ? loadConfig(version, now).config : undefined;
  const receipt = latestReceipt();
  const status = {
    version,
    installed,
    profile: config?.presentation ?? null,
    mode: config?.optimization.mode ?? null,
    lastTask: receipt
      ? {
          taskId: receipt.taskId,
          task: receipt.task,
          status: receipt.status,
          completedAt: receipt.completedAt,
          verification: receipt.verification,
          retryCount: receipt.retryCount,
          escalations: receipt.escalations.length,
        }
      : null,
    note: 'Live context %/cost are shown in the Claude Code status line during a session.',
  };
  if (hasFlag(args, '--json')) {
    printJson(status);
    return 0;
  }
  heading(`${SEAL} TokenSeal status`);
  info(`  version:   ${version}`);
  info(`  installed: ${installed ? c.green('yes') : c.yellow('no (run tokenseal setup)')}`);
  if (config)
    info(
      `  profile:   verbosity=${config.presentation.verbosity} notify=${config.presentation.notify} permission=${config.presentation.permission} results=${config.presentation.results}`,
    );
  if (receipt) {
    info(`  last task: ${receipt.task || receipt.taskId} [${receipt.status}]`);
    info(
      `             tests ${receipt.verification.testsPassed}✓/${receipt.verification.testsFailed}✗ · retries ${receipt.retryCount} · escalations ${receipt.escalations.length}`,
    );
  } else {
    info(`  last task: ${c.dim('none recorded yet')}`);
  }
  info(c.dim(`  ${status.note}`));
  return 0;
}

// ---------------------------------------------------------------- config
export async function cmdConfig(args: string[]): Promise<number> {
  const version = tokensealVersion();
  const now = nowIso();
  if (hasFlag(args, '--path')) {
    info(loadConfig(version, now).path);
    return 0;
  }
  if (hasFlag(args, '--show') || hasFlag(args, '--json')) {
    printJson(loadConfig(version, now).config);
    return 0;
  }
  // Default: re-run the presentation wizard.
  const answers = await runWizard(true);
  const existing = loadConfig(version, now).config;
  saveConfig({ ...existing, version, presentation: answers });
  ok('Updated presentation preferences.');
  return 0;
}

// ---------------------------------------------------------------- audit
export function cmdAudit(args: string[]): number {
  const report = auditContext();
  if (hasFlag(args, '--json')) {
    printJson(report);
    return 0;
  }
  heading(`${SEAL} TokenSeal context audit ${c.dim('(report only — no files changed)')}`);
  for (const f of report.findings) {
    const mark = f.level === 'warn' ? c.yellow('⚠') : c.cyan('·');
    info(`  ${mark} ${c.bold(f.title)}`);
    info(`     ${f.detail}`);
    info(`     ${c.dim('→ ' + f.suggestion)}`);
  }
  return 0;
}

// ---------------------------------------------------------------- explain-last
export function cmdExplainLast(args: string[]): number {
  const receipt = latestReceipt();
  if (!receipt) {
    warn('No task receipt found yet.');
    return 0;
  }
  if (hasFlag(args, '--json')) {
    printJson(receipt);
    return 0;
  }
  heading(`${SEAL} Last task`);
  info(`  ${c.bold(receipt.task || receipt.taskId)}  ${c.dim('[' + receipt.status + ']')}`);
  if (receipt.changedFiles.length) {
    info(`  changed files (${receipt.changedFiles.length}):`);
    for (const file of receipt.changedFiles.slice(0, 20)) info(`    - ${file}`);
  }
  if (receipt.changes.length) {
    info('  changes:');
    for (const ch of receipt.changes.slice(0, 20))
      info(`    - ${typeof ch === 'string' ? ch : JSON.stringify(ch)}`);
  }
  const v = receipt.verification;
  info(
    `  verification: tests ${v.testsPassed}✓/${v.testsFailed}✗ · lint ${fmt(v.lintPassed)} · types ${fmt(v.typeCheckPassed)} · build ${fmt(v.buildPassed)}`,
  );
  if (receipt.escalations.length) info(`  escalations: ${receipt.escalations.length}`);
  if (receipt.externalBlockers.length)
    info(`  external blockers: ${receipt.externalBlockers.join(', ')}`);
  info(c.dim('  Ask Claude "explain the last task in detail" for a narrated walkthrough.'));
  return 0;
}

function fmt(v: boolean | null): string {
  return v === null ? '—' : v ? '✓' : '✗';
}

// ---------------------------------------------------------------- benchmark
export function cmdBenchmark(args: string[]): number {
  const summary = runBenchmark();
  if (hasFlag(args, '--json')) {
    printJson(summary);
    return 0;
  }
  heading(`${SEAL} TokenSeal benchmark ${c.dim('(sample outputs)')}`);
  for (const row of summary.rows) {
    const pct = (row.reductionRatio * 100).toFixed(0);
    info(
      `  ${c.bold(row.name.padEnd(22))} ${row.originalTokens}→${row.filteredTokens} tok  ${c.green(pct + '%')}  ${c.dim(row.strategy)}${row.recoverable ? '' : c.red(' [NOT RECOVERABLE]')}`,
    );
  }
  info('');
  info(
    `  aggregate token reduction: ${c.green((summary.aggregateReduction * 100).toFixed(0) + '%')} · all recoverable: ${summary.allRecoverable ? c.green('yes') : c.red('no')}`,
  );
  info(c.dim(`  ${summary.note}`));
  return 0;
}

// ---------------------------------------------------------------- uninstall
export async function cmdUninstall(args: string[]): Promise<number> {
  const purge = hasFlag(args, '--purge');
  const assumeYes = hasFlag(args, '--yes') || hasFlag(args, '-y');
  info(`${SEAL} ${c.bold('TokenSeal uninstall')}`);
  if (purge && !assumeYes) {
    warn(
      `--purge will delete ${tokensealDataDir()} (config + receipts). Re-run with --yes to confirm.`,
    );
    return 1;
  }
  const result = await uninstallPlugin({ purgeData: purge });
  for (const step of result.steps) {
    (step.ok ? ok : warn)(`${step.name}: ${step.detail}`);
  }
  info('');
  ok('TokenSeal removed. Your Claude Code settings backup (if any) was restored.');
  if (!purge)
    info(c.dim(`  Kept your data at ${tokensealDataDir()} (use --purge --yes to delete).`));
  return result.ok ? 0 : 1;
}

export { claudeUserDir };
