/**
 * Health checks. Pure-ish orchestration returning a structured report so both
 * `tokenseal doctor` (human + --json) and post-setup validation can reuse it.
 */
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { run } from '../utils/proc.ts';
import {
  claudeUserDir,
  tokensealDataDir,
  installedMarketplaceDir,
  pluginSourceDir,
  stateDir,
} from '../utils/paths.ts';
import { detectCapabilities, MIN_SUPPORTED, gte } from '../capabilities/matrix.ts';
import { configExists, loadConfig } from '../config/store.ts';
import { validateConfig } from '../config/validate.ts';
import { PLUGIN_ID } from '../installer/marketplace.ts';
import { readSettings, OWNED_MARKER } from '../installer/settings.ts';

export type CheckStatus = 'pass' | 'warn' | 'fail';
export interface Check {
  name: string;
  status: CheckStatus;
  detail: string;
}
export interface DoctorReport {
  ok: boolean;
  checks: Check[];
  claudeCodeVersion: string | null;
}

export interface DoctorOptions {
  claudeBin?: string;
  userDir?: string;
  dataDir?: string;
  version: string;
  now: string;
}

export async function runDoctor(opts: DoctorOptions): Promise<DoctorReport> {
  const claudeBin = opts.claudeBin ?? 'claude';
  const userDir = opts.userDir ?? claudeUserDir();
  const dataDir = opts.dataDir ?? tokensealDataDir();
  const checks: Check[] = [];
  const add = (name: string, status: CheckStatus, detail: string) =>
    checks.push({ name, status, detail });

  const matrix = await detectCapabilities(claudeBin);
  if (!matrix.claudeCodeInstalled) {
    add('claude-code', 'fail', 'Claude Code CLI not found on PATH.');
  } else if (!gte(matrix.claudeCodeVersion, MIN_SUPPORTED)) {
    add(
      'claude-code',
      'fail',
      `Version ${matrix.claudeCodeVersion} is below minimum ${MIN_SUPPORTED}.`,
    );
  } else {
    add('claude-code', 'pass', `Version ${matrix.claudeCodeVersion}.`);
  }

  // Config
  if (!configExists(dataDir)) {
    add('config', 'warn', 'No TokenSeal config yet. Run `tokenseal setup`.');
  } else {
    const loaded = loadConfig(opts.version, opts.now, dataDir);
    const v = validateConfig(loaded.config);
    add('config', v.ok ? 'pass' : 'fail', v.ok ? 'Config valid.' : v.errors.join('; '));
    try {
      const mode = statSync(join(dataDir, 'config.json')).mode & 0o777;
      add(
        'config-permissions',
        mode <= 0o600 ? 'pass' : 'warn',
        `config.json mode ${mode.toString(8)}.`,
      );
    } catch {
      /* ignore */
    }
  }

  // Plugin source + marketplace copy
  const src = pluginSourceDir();
  add(
    'plugin-source',
    existsSync(join(src, '.claude-plugin', 'plugin.json')) ? 'pass' : 'fail',
    src,
  );
  add(
    'marketplace-copy',
    existsSync(installedMarketplaceDir(dataDir)) ? 'pass' : 'warn',
    existsSync(installedMarketplaceDir(dataDir)) ? 'present' : 'not installed yet',
  );

  // Plugin installed + valid (only if claude present)
  if (matrix.claudeCodeInstalled) {
    const list = await run(claudeBin, ['plugin', 'list']);
    const installed =
      (list.stdout + list.stderr).includes(PLUGIN_ID) || /tokenseal/.test(list.stdout);
    add(
      'plugin-installed',
      installed ? 'pass' : 'warn',
      installed ? PLUGIN_ID : 'not installed; run `tokenseal setup`',
    );
    if (existsSync(join(src, '.claude-plugin', 'plugin.json'))) {
      const val = await run(claudeBin, ['plugin', 'validate', src]);
      const passed = /passed/i.test(val.stdout + val.stderr);
      add(
        'plugin-valid',
        passed ? 'pass' : 'fail',
        (val.stdout + val.stderr).trim().split('\n').pop() ?? '',
      );
    }
  }

  // Status line ownership
  const settings = readSettings(userDir);
  const sl = settings.statusLine as Record<string, unknown> | undefined;
  if (!sl) add('status-line', 'warn', 'No statusLine configured.');
  else
    add(
      'status-line',
      'pass',
      sl[OWNED_MARKER] ? 'TokenSeal statusLine active.' : 'User statusLine present (left as-is).',
    );

  // Git + worktree
  const git = await run('git', ['--version']);
  add(
    'git',
    git.spawnError ? 'warn' : 'pass',
    git.spawnError ? 'git not found (checkpoints degrade).' : git.stdout.trim(),
  );
  add(
    'worktree-isolation',
    matrix.capabilities.subagentWorktrees ? 'pass' : 'warn',
    matrix.capabilities.subagentWorktrees
      ? 'supported'
      : 'unsupported; snapshot-diff fallback used',
  );

  // Writable data/state dirs
  add('data-dir', 'pass', dataDir);
  add('state-dir', 'pass', stateDir(dataDir));

  const ok = checks.every((c) => c.status !== 'fail');
  return { ok, checks, claudeCodeVersion: matrix.claudeCodeVersion };
}
