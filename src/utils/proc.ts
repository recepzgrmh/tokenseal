/**
 * Safe subprocess execution.
 *
 * We NEVER build a shell command string from user/tool input. Everything goes
 * through {@link run}, which uses `execFile` semantics (argv array, no shell),
 * eliminating shell-injection as a class of bug.
 */
import { execFile } from 'node:child_process';

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
  /** True when the process could not be spawned (e.g. binary missing). */
  spawnError: boolean;
}

export interface RunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  /** Max bytes captured from each stream before truncation (default 10 MiB). */
  maxBuffer?: number;
  /** Text fed to the child's stdin. */
  input?: string;
}

/**
 * Run a binary with an explicit argument vector. Rejects if `args` is not a
 * real array (guards against a caller accidentally passing a joined string).
 */
export function run(
  command: string,
  args: string[] = [],
  opts: RunOptions = {},
): Promise<RunResult> {
  if (!Array.isArray(args)) {
    return Promise.reject(new TypeError('run(): args must be a string[] (never a shell string)'));
  }
  for (const a of args) {
    if (typeof a !== 'string') {
      return Promise.reject(new TypeError('run(): every arg must be a string'));
    }
  }
  return new Promise((resolvePromise) => {
    const child = execFile(
      command,
      args,
      {
        cwd: opts.cwd,
        env: opts.env ?? process.env,
        timeout: opts.timeoutMs ?? 0,
        maxBuffer: opts.maxBuffer ?? 10 * 1024 * 1024,
        windowsHide: true,
        // Never use a shell — this is the whole point.
        shell: false,
      },
      (err, stdout, stderr) => {
        if (err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
          resolvePromise({ code: 127, stdout: '', stderr: String(err.message), spawnError: true });
          return;
        }
        const code =
          err && typeof (err as { code?: unknown }).code === 'number'
            ? (err as { code: number }).code
            : err
              ? 1
              : 0;
        resolvePromise({
          code,
          stdout: stdout?.toString() ?? '',
          stderr: stderr?.toString() ?? '',
          spawnError: false,
        });
      },
    );
    if (opts.input !== undefined && child.stdin) {
      child.stdin.end(opts.input);
    }
  });
}

/** True if a binary is resolvable/runnable (via `--version` probe by caller). */
export async function isRunnable(command: string, versionArg = '--version'): Promise<boolean> {
  const res = await run(command, [versionArg], { timeoutMs: 10_000 });
  return !res.spawnError;
}
