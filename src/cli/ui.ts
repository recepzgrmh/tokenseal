/**
 * Tiny terminal UI helpers. No dependencies. Respects NO_COLOR and non-TTY.
 */
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;

function wrap(code: number, s: string): string {
  return useColor ? `\x1b[${code}m${s}\x1b[0m` : s;
}

export const c = {
  bold: (s: string) => wrap(1, s),
  dim: (s: string) => wrap(2, s),
  red: (s: string) => wrap(31, s),
  green: (s: string) => wrap(32, s),
  yellow: (s: string) => wrap(33, s),
  cyan: (s: string) => wrap(36, s),
};

export const SEAL = '🦭';

export function info(msg: string): void {
  process.stdout.write(msg + '\n');
}

export function ok(msg: string): void {
  process.stdout.write(`${c.green('✔')} ${msg}\n`);
}

export function warn(msg: string): void {
  process.stdout.write(`${c.yellow('⚠')} ${msg}\n`);
}

export function fail(msg: string): void {
  process.stderr.write(`${c.red('✖')} ${msg}\n`);
}

export function heading(msg: string): void {
  process.stdout.write(`\n${c.bold(msg)}\n`);
}

export function printJson(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}
