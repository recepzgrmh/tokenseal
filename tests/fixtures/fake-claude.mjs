#!/usr/bin/env node
/**
 * Fake `claude` binary for integration tests. Simulates the subset of
 * `claude plugin …` that TokenSeal's installer drives, mutating a settings.json
 * under $HOME/.claude the way the real CLI does — so tests can assert full
 * install/uninstall reversibility without the real binary or network.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const argv = process.argv.slice(2);
const HOME = process.env.HOME || process.env.USERPROFILE || '';
const settingsPath = join(HOME, '.claude', 'settings.json');

function readSettings() {
  try {
    return JSON.parse(readFileSync(settingsPath, 'utf8'));
  } catch {
    return {};
  }
}
function writeSettings(s) {
  mkdirSync(dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, JSON.stringify(s, null, 2) + '\n');
}

function out(msg) {
  process.stdout.write(msg + '\n');
}

if (argv[0] === '--version') {
  out('2.1.212 (Claude Code)');
  process.exit(0);
}

if (argv[0] === 'plugin') {
  const sub = argv[1];
  if (sub === 'marketplace' && argv[2] === 'add') {
    const s = readSettings();
    s.extraKnownMarketplaces = s.extraKnownMarketplaces || {};
    s.extraKnownMarketplaces['tokenseal-marketplace'] = { source: { source: 'directory', path: argv[3] } };
    writeSettings(s);
    out('Successfully added marketplace: tokenseal-marketplace');
    process.exit(0);
  }
  if (sub === 'marketplace' && argv[2] === 'remove') {
    const s = readSettings();
    if (s.extraKnownMarketplaces) delete s.extraKnownMarketplaces[argv[3]];
    writeSettings(s);
    out('Successfully removed marketplace: ' + argv[3]);
    process.exit(0);
  }
  if (sub === 'install' || sub === 'i') {
    const s = readSettings();
    s.enabledPlugins = s.enabledPlugins || {};
    s.enabledPlugins[argv[2]] = true;
    writeSettings(s);
    out('Successfully installed plugin: ' + argv[2] + ' (scope: user)');
    process.exit(0);
  }
  if (sub === 'uninstall' || sub === 'remove') {
    const s = readSettings();
    const existed = s.enabledPlugins && s.enabledPlugins[argv[2]];
    if (s.enabledPlugins) delete s.enabledPlugins[argv[2]];
    writeSettings(s);
    if (existed) out('Successfully uninstalled plugin: ' + argv[2]);
    else out('Plugin not found in installed plugins');
    process.exit(0);
  }
  if (sub === 'validate') {
    out('Validation passed');
    process.exit(0);
  }
  if (sub === 'list') {
    const s = readSettings();
    const ids = Object.keys(s.enabledPlugins || {});
    out(ids.length ? ids.join('\n') : 'No plugins installed.');
    process.exit(0);
  }
}

process.stderr.write('fake-claude: unhandled args ' + JSON.stringify(argv) + '\n');
process.exit(1);
