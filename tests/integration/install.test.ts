import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  chmodSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installPlugin, uninstallPlugin } from '../../src/installer/install.ts';

const FAKE = fileURLToPath(new URL('../fixtures/fake-claude.mjs', import.meta.url));
const posix = process.platform !== 'win32';
const ORIGINAL_HOME = process.env.HOME;

/**
 * Build an isolated HOME so both the installer (userDir) and the fake claude
 * (which uses $HOME/.claude) write to the SAME settings.json. Never touches the
 * real HOME.
 */
function setup(): { userDir: string; dataDir: string } {
  const home = mkdtempSync(join(tmpdir(), 'ts-int-home-'));
  process.env.HOME = home;
  const userDir = join(home, '.claude');
  mkdirSync(userDir, { recursive: true });
  writeFileSync(join(userDir, 'settings.json'), JSON.stringify({ theme: 'dark' }, null, 2));
  return { userDir, dataDir: join(userDir, 'tokenseal') };
}

function restoreHome(): void {
  if (ORIGINAL_HOME === undefined) delete process.env.HOME;
  else process.env.HOME = ORIGINAL_HOME;
}

test('installPlugin drives the full flow and sets a statusLine', { skip: !posix }, async (t) => {
  t.after(restoreHome);
  chmodSync(FAKE, 0o755);
  const { userDir, dataDir } = setup();
  const result = await installPlugin({ version: '0.1.0', claudeBin: FAKE, userDir, dataDir });
  assert.equal(result.ok, true, JSON.stringify(result.steps));
  const names = result.steps.map((s) => s.name);
  assert.deepEqual(names.includes('marketplace-add') && names.includes('plugin-install'), true);

  const settings = JSON.parse(readFileSync(join(userDir, 'settings.json'), 'utf8'));
  assert.ok(settings.statusLine.command.includes('statusline.mjs'));
  assert.equal(settings.enabledPlugins['tokenseal@tokenseal-marketplace'], true);
  assert.equal(settings.theme, 'dark');
  assert.ok(existsSync(join(dataDir, 'marketplace', 'plugin', '.claude-plugin', 'plugin.json')));
});

test('uninstallPlugin fully reverses install to pristine settings', { skip: !posix }, async (t) => {
  t.after(restoreHome);
  chmodSync(FAKE, 0o755);
  const { userDir, dataDir } = setup();
  await installPlugin({ version: '0.1.0', claudeBin: FAKE, userDir, dataDir });
  const result = await uninstallPlugin({ claudeBin: FAKE, userDir, dataDir });
  assert.equal(result.ok, true, JSON.stringify(result.steps));

  const settings = JSON.parse(readFileSync(join(userDir, 'settings.json'), 'utf8'));
  assert.deepEqual(settings, { theme: 'dark' }, 'settings restored to pre-install state');
  assert.equal(existsSync(join(dataDir, 'marketplace')), false, 'marketplace copy removed');
});

test('install is idempotent (second run still ok)', { skip: !posix }, async (t) => {
  t.after(restoreHome);
  chmodSync(FAKE, 0o755);
  const { userDir, dataDir } = setup();
  await installPlugin({ version: '0.1.0', claudeBin: FAKE, userDir, dataDir });
  const second = await installPlugin({ version: '0.1.0', claudeBin: FAKE, userDir, dataDir });
  assert.equal(second.ok, true);
});

test('purge removes the data dir', { skip: !posix }, async (t) => {
  t.after(restoreHome);
  chmodSync(FAKE, 0o755);
  const { userDir, dataDir } = setup();
  await installPlugin({ version: '0.1.0', claudeBin: FAKE, userDir, dataDir });
  await uninstallPlugin({ claudeBin: FAKE, userDir, dataDir, purgeData: true });
  assert.equal(existsSync(dataDir), false);
});
