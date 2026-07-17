#!/usr/bin/env node
/**
 * TokenSeal CLI entry point.
 *
 *   tokenseal setup | doctor | status | config | audit | explain-last |
 *             benchmark | uninstall
 */
import { tokensealVersion } from '../version.ts';
import { c, info, fail, SEAL } from './ui.ts';
import {
  cmdSetup,
  cmdDoctor,
  cmdStatus,
  cmdConfig,
  cmdAudit,
  cmdExplainLast,
  cmdBenchmark,
  cmdUninstall,
} from './commands.ts';

const HELP = `${SEAL} TokenSeal ${tokensealVersion()} — Seal token leaks. Ship reviewed code.

Usage: tokenseal <command> [options]

Commands:
  setup            Install the plugin (user scope) and set preferences
  doctor           Validate the installation (--json)
  status           Show plugin status and last task (--json)
  config           Reconfigure presentation preferences (--show, --path)
  audit            Report context inefficiencies — read only (--json)
  explain-last     Summarize the most recent task receipt (--json)
  benchmark        Measure filter token reduction on sample outputs (--json)
  uninstall        Remove the plugin and restore settings (--purge --yes)

After setup, just keep using: ${c.cyan('claude')}`;

async function main(argv: string[]): Promise<number> {
  const [command, ...args] = argv;
  switch (command) {
    case 'setup':
      return cmdSetup(args);
    case 'doctor':
      return cmdDoctor(args);
    case 'status':
      return cmdStatus(args);
    case 'config':
      return cmdConfig(args);
    case 'audit':
      return cmdAudit(args);
    case 'explain-last':
      return cmdExplainLast(args);
    case 'benchmark':
      return cmdBenchmark(args);
    case 'uninstall':
      return cmdUninstall(args);
    case 'version':
    case '--version':
    case '-v':
      info(tokensealVersion());
      return 0;
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      info(HELP);
      return 0;
    default:
      fail(`Unknown command: ${command}`);
      info(HELP);
      return 1;
  }
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    fail(String(err instanceof Error ? (err.stack ?? err.message) : err));
    process.exitCode = 1;
  });
