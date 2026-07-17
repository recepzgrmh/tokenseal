/**
 * Secret masking.
 *
 * Applied to every piece of text TokenSeal might persist (receipts, filtered
 * tool output, logs) so credentials never leak to disk. Patterns are ordered
 * most-specific first. This is defense-in-depth, not a guarantee: it is far
 * better to mask a false positive than to store a real key.
 */

export const REDACTION = '«redacted:$LABEL»';

interface SecretPattern {
  label: string;
  re: RegExp;
}

/** Known high-signal token shapes. Case-sensitive where the prefix demands it. */
const PATTERNS: SecretPattern[] = [
  { label: 'anthropic-key', re: /sk-ant-[a-zA-Z0-9_-]{16,}/g },
  { label: 'openai-key', re: /sk-(?:proj-)?[a-zA-Z0-9]{20,}/g },
  { label: 'github-token', re: /gh[pousr]_[A-Za-z0-9]{20,}/g },
  { label: 'github-pat', re: /github_pat_[A-Za-z0-9_]{20,}/g },
  { label: 'slack-token', re: /xox[baprs]-[A-Za-z0-9-]{10,}/g },
  { label: 'aws-access-key', re: /A(?:KIA|SIA)[0-9A-Z]{16}/g },
  { label: 'google-key', re: /AIza[0-9A-Za-z_-]{35}/g },
  { label: 'jwt', re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  {
    label: 'private-key-block',
    re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g,
  },
  { label: 'bearer', re: /\b[Bb]earer\s+[A-Za-z0-9._-]{16,}/g },
  { label: 'basic-auth-url', re: /([a-z][a-z0-9+.-]*:\/\/)[^:/@\s]+:[^@/\s]+@/g },
];

/**
 * `KEY=value` / `KEY: value` assignments whose key name signals a secret.
 * We keep the key visible (useful signal) and mask only the value.
 */
const ASSIGNMENT_KEY =
  /((?:[A-Za-z0-9_]*)(?:SECRET|TOKEN|PASSWORD|PASSWD|API[_-]?KEY|ACCESS[_-]?KEY|PRIVATE[_-]?KEY|CREDENTIAL|AUTH)(?:[A-Za-z0-9_]*))\s*([=:])\s*(['"]?)([^\s'"]{4,})\3/gi;

function tag(label: string): string {
  return REDACTION.replace('$LABEL', label);
}

/** Redact known secrets from arbitrary text. Idempotent. */
export function maskSecrets(input: string): string {
  if (!input) return input;
  let out = input;
  for (const { label, re } of PATTERNS) {
    out = out.replace(re, tag(label));
  }
  out = out.replace(ASSIGNMENT_KEY, (_m, key: string, sep: string) => `${key}${sep}${tag('env')}`);
  return out;
}

/** True if masking would change the string (i.e. a secret was detected). */
export function containsSecret(input: string): boolean {
  return maskSecrets(input) !== input;
}

/**
 * Recursively mask secrets in a JSON-ish value (used before writing receipts).
 * Never persist raw env values.
 */
export function maskDeep<T>(value: T): T {
  if (typeof value === 'string') return maskSecrets(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => maskDeep(v)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = maskDeep(v);
    return out as unknown as T;
  }
  return value;
}
