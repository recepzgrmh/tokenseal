/**
 * Install / uninstall orchestration.
 *
 * Installation uses Claude Code's own plugin machinery (marketplace add +
 * plugin install --scope user), so it is idempotent and fully reversible via
 * `claude plugin uninstall`. Every step is recorded; a failure triggers a
 * best-effort rollback so a partial install never leaves the user stuck.
 */
import { run, type RunResult } from '../utils/proc.ts';
import { claudeUserDir, tokensealDataDir } from '../utils/paths.ts';
import {
  buildMarketplace,
  removeMarketplaceDir,
  MARKETPLACE_NAME,
  PLUGIN_ID,
} from './marketplace.ts';
import { ensureStatusLine, removeStatusLine } from './settings.ts';

export interface Step {
  name: string;
  ok: boolean;
  detail: string;
}

export interface InstallOptions {
  version: string;
  claudeBin?: string;
  dataDir?: string;
  userDir?: string;
  /** Configure the status line (skipped if the user already has one). */
  setStatusLine?: boolean;
}

export interface InstallResult {
  ok: boolean;
  steps: Step[];
  rolledBack: boolean;
}

/** A claude call is "ok" if it succeeded or was already in the desired state. */
function idempotentOk(res: RunResult, alreadyPhrases: string[]): boolean {
  if (res.code === 0) return true;
  const blob = (res.stdout + res.stderr).toLowerCase();
  return alreadyPhrases.some((p) => blob.includes(p));
}

export async function installPlugin(opts: InstallOptions): Promise<InstallResult> {
  const claudeBin = opts.claudeBin ?? 'claude';
  const dataDir = opts.dataDir ?? tokensealDataDir();
  const userDir = opts.userDir ?? claudeUserDir();
  const steps: Step[] = [];
  let built;

  try {
    built = buildMarketplace(opts.version, dataDir);
    steps.push({ name: 'build-marketplace', ok: true, detail: built.marketplaceDir });
  } catch (e) {
    steps.push({ name: 'build-marketplace', ok: false, detail: String(e) });
    return { ok: false, steps, rolledBack: false };
  }

  const add = await run(claudeBin, [
    'plugin',
    'marketplace',
    'add',
    built.marketplaceDir,
    '--scope',
    'user',
  ]);
  const addOk = idempotentOk(add, ['already', 'exists']);
  steps.push({
    name: 'marketplace-add',
    ok: addOk,
    detail: (add.stdout + add.stderr).trim().slice(0, 300),
  });
  if (!addOk) return rollback(claudeBin, dataDir, userDir, steps);

  const install = await run(claudeBin, ['plugin', 'install', PLUGIN_ID, '--scope', 'user']);
  const installOk = idempotentOk(install, ['already installed', 'successfully installed']);
  steps.push({
    name: 'plugin-install',
    ok: installOk,
    detail: (install.stdout + install.stderr).trim().slice(0, 300),
  });
  if (!installOk) return rollback(claudeBin, dataDir, userDir, steps);

  const validate = await run(claudeBin, ['plugin', 'validate', built.pluginDir]);
  steps.push({
    name: 'plugin-validate',
    ok: validate.code === 0,
    detail: (validate.stdout + validate.stderr).trim().slice(0, 300),
  });
  // Validation warnings are non-fatal; only a hard failure rolls back.
  if (validate.code !== 0 && !/passed/i.test(validate.stdout + validate.stderr)) {
    return rollback(claudeBin, dataDir, userDir, steps);
  }

  if (opts.setStatusLine !== false) {
    const sl = ensureStatusLine(built.statusLineScript, userDir);
    steps.push({ name: 'status-line', ok: true, detail: sl.reason });
  }

  return { ok: true, steps, rolledBack: false };
}

async function rollback(
  claudeBin: string,
  dataDir: string,
  userDir: string,
  steps: Step[],
): Promise<InstallResult> {
  await run(claudeBin, ['plugin', 'uninstall', PLUGIN_ID]).catch(() => undefined);
  await run(claudeBin, ['plugin', 'marketplace', 'remove', MARKETPLACE_NAME]).catch(
    () => undefined,
  );
  try {
    removeStatusLine(userDir);
  } catch {
    /* best effort */
  }
  removeMarketplaceDir(dataDir);
  steps.push({ name: 'rollback', ok: true, detail: 'reverted partial install' });
  return { ok: false, steps, rolledBack: true };
}

export interface UninstallOptions {
  claudeBin?: string;
  dataDir?: string;
  userDir?: string;
  /** Also delete the TokenSeal data dir (config + receipts). */
  purgeData?: boolean;
}

export async function uninstallPlugin(opts: UninstallOptions = {}): Promise<InstallResult> {
  const claudeBin = opts.claudeBin ?? 'claude';
  const dataDir = opts.dataDir ?? tokensealDataDir();
  const userDir = opts.userDir ?? claudeUserDir();
  const steps: Step[] = [];

  const un = await run(claudeBin, ['plugin', 'uninstall', PLUGIN_ID]);
  steps.push({
    name: 'plugin-uninstall',
    ok: idempotentOk(un, ['not installed', 'successfully', 'no such', 'not found']),
    detail: (un.stdout + un.stderr).trim().slice(0, 300),
  });

  const mk = await run(claudeBin, ['plugin', 'marketplace', 'remove', MARKETPLACE_NAME]);
  steps.push({
    name: 'marketplace-remove',
    ok: idempotentOk(mk, ['not found', 'removed', 'no such', "doesn't exist", 'does not exist']),
    detail: (mk.stdout + mk.stderr).trim().slice(0, 300),
  });

  const slRemoved = removeStatusLine(userDir);
  steps.push({
    name: 'status-line',
    ok: true,
    detail: slRemoved ? 'removed TokenSeal statusLine' : 'no TokenSeal statusLine to remove',
  });

  removeMarketplaceDir(dataDir);
  steps.push({ name: 'marketplace-dir', ok: true, detail: 'removed marketplace copy' });

  if (opts.purgeData) {
    const { rmSync, existsSync } = await import('node:fs');
    if (existsSync(dataDir)) rmSync(dataDir, { recursive: true, force: true });
    steps.push({ name: 'purge-data', ok: true, detail: `removed ${dataDir}` });
  }

  return { ok: steps.every((s) => s.ok), steps, rolledBack: false };
}
