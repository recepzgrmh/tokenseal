/**
 * Setup wizard. Asks ONLY about presentation + permission preferences — never
 * about quality, models, or verification (those are identical on every profile).
 * Non-interactive (no TTY or --yes) falls back to the documented defaults.
 */
import { createInterface } from 'node:readline/promises';
import {
  DEFAULT_PRESENTATION,
  type Verbosity,
  type Notify,
  type Permission,
  type Results,
} from '../config/schema.ts';
import { c } from './ui.ts';

export interface WizardAnswers {
  verbosity: Verbosity;
  notify: Notify;
  permission: Permission;
  results: Results;
}

interface Question<T extends string> {
  title: string;
  options: { value: T; label: string; hint: string }[];
  fallback: T;
}

const QUESTIONS = {
  verbosity: {
    title: 'How should Claude explain its work to you?',
    options: [
      {
        value: 'detailed',
        label: 'Detailed',
        hint: 'Explains key reviews, decisions, changes, and verifications.',
      },
      {
        value: 'summary',
        label: 'Summary',
        hint: 'Summarizes key decisions, changes, and test results.',
      },
      { value: 'brief', label: 'Brief', hint: 'A few sentences of result at the end of a task.' },
      {
        value: 'silent',
        label: 'Silent',
        hint: 'Only reports completion + verification; ask for details.',
      },
    ],
    fallback: DEFAULT_PRESENTATION.verbosity,
  } satisfies Question<Verbosity>,
  notify: {
    title: 'When should Claude keep you informed while working?',
    options: [
      {
        value: 'milestones',
        label: 'At key stages',
        hint: 'Brief notes at research, implementation, verification.',
      },
      {
        value: 'decisions',
        label: 'Only when a decision is needed',
        hint: 'Works normally; stops when it needs your call.',
      },
      {
        value: 'end',
        label: 'At the end',
        hint: 'No messages while working; reports when complete.',
      },
    ],
    fallback: DEFAULT_PRESENTATION.notify,
  } satisfies Question<Notify>,
  permission: {
    title: 'Before which actions should Claude ask your permission?',
    options: [
      {
        value: 'risky',
        label: 'Risky operations',
        hint: 'Deletes, deploys, migrations, hard-to-reverse actions.',
      },
      {
        value: 'scope',
        label: 'Scope-expanding operations',
        hint: 'Also new deps, broad refactors, config changes.',
      },
      {
        value: 'major',
        label: 'Every major change',
        hint: 'Asks before significant code changes.',
      },
    ],
    fallback: DEFAULT_PRESENTATION.permission,
  } satisfies Question<Permission>,
  results: {
    title: 'How should results be shown to you?',
    options: [
      {
        value: 'detailed',
        label: 'Detailed',
        hint: 'Key commands, verifications, and test results.',
      },
      { value: 'summary', label: 'Summary', hint: 'Changes, passing tests, important warnings.' },
      {
        value: 'result-only',
        label: 'Result only',
        hint: 'Whether the task verified successfully; ask for more.',
      },
    ],
    fallback: DEFAULT_PRESENTATION.results,
  } satisfies Question<Results>,
} as const;

export function defaultAnswers(): WizardAnswers {
  return { ...DEFAULT_PRESENTATION };
}

async function ask<T extends string>(
  rl: ReturnType<typeof createInterface>,
  q: Question<T>,
): Promise<T> {
  process.stdout.write(`\n${c.bold(q.title)}\n`);
  q.options.forEach((o, i) => {
    process.stdout.write(`  ${c.cyan(String(i + 1))}. ${c.bold(o.label)} — ${c.dim(o.hint)}\n`);
  });
  const defaultIndex = q.options.findIndex((o) => o.value === q.fallback) + 1;
  const answer = (await rl.question(`Choose [${defaultIndex}]: `)).trim();
  if (answer === '') return q.fallback;
  const idx = Number(answer);
  if (Number.isInteger(idx) && idx >= 1 && idx <= q.options.length) {
    return q.options[idx - 1]!.value;
  }
  return q.fallback;
}

/** Run the wizard interactively, or return defaults when non-interactive. */
export async function runWizard(interactive: boolean): Promise<WizardAnswers> {
  if (!interactive || !process.stdin.isTTY) return defaultAnswers();
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return {
      verbosity: await ask(rl, QUESTIONS.verbosity),
      notify: await ask(rl, QUESTIONS.notify),
      permission: await ask(rl, QUESTIONS.permission),
      results: await ask(rl, QUESTIONS.results),
    };
  } finally {
    rl.close();
  }
}
