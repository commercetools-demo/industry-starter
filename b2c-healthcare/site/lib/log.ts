// Redacting logger (error-pages, health-data-minimization): what reaches the logs must not contain
// health data or personal identifiers. Pure module (no server-only import) so it is easy to test.

const REDACTED = '[redacted]';
const MAX_DEPTH = 6;

/** Field names dropped whatever their value (case-insensitive, exact match). */
const DROPPED_KEYS = new Set([
  'reason',
  'results',
  'value',
  'sig',
  'email',
  'phone',
  // request/response bodies and things that carry credentials
  'body',
  'requestbody',
  'responsebody',
  'payload',
  'headers',
  'cookie',
  'cookies',
  'authorization',
  'password',
  'token',
  'secret',
  'query',
  'querystring',
  'search',
]);

const EMAIL = /[^\s@/?#]+@[^\s@/?#]+\.[^\s@/?#]+/g;
// A `?` followed by anything up to whitespace or a closing quote/bracket: the query string (and hash) of a URL.
const QUERY = /\?[^\s"')\]}]*/g;

/** Strips query strings and e-mail addresses out of free text. */
export function redactString(text: string): string {
  return text.replace(EMAIL, '[email]').replace(QUERY, '');
}

function isDropped(key: string): boolean {
  return DROPPED_KEYS.has(key.toLowerCase());
}

/**
 * Returns a copy of `value` that is safe to log:
 * - object fields named reason, results, value, sig, email, phone (plus bodies, headers, credentials,
 *   `query`) are removed;
 * - strings lose their query strings and e-mail addresses;
 * - an Error becomes `{ name, status }` only, because its message may echo a request body;
 * - depth is bounded and cycles are cut.
 */
export function redact(value: unknown, depth = 0, seen: WeakSet<object> = new WeakSet()): unknown {
  if (typeof value === 'string') return redactString(value);
  if (value === null || typeof value !== 'object') {
    return typeof value === 'function' || typeof value === 'symbol' ? undefined : value;
  }
  if (depth >= MAX_DEPTH || seen.has(value)) return REDACTED;
  seen.add(value);
  if (value instanceof Error) {
    const e = value as Error & { statusCode?: unknown; status?: unknown; code?: unknown };
    const status = typeof e.statusCode === 'number' ? e.statusCode : typeof e.status === 'number' ? e.status : undefined;
    return { name: e.name, ...(status === undefined ? {} : { status }) };
  }
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1, seen));
  if (value instanceof URL) return `${value.origin}${value.pathname}`;
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    if (isDropped(key)) continue;
    out[key] = redact(inner, depth + 1, seen);
  }
  return out;
}

type Level = 'error' | 'warn' | 'info';

function write(level: Level, scope: string, message: string, fields?: unknown): void {
  const line = `[${redactString(scope)}] ${redactString(message)}`;
  if (fields === undefined) console[level](line);
  else console[level](line, redact(fields));
}

export const log = {
  error: (scope: string, message: string, fields?: unknown): void => write('error', scope, message, fields),
  warn: (scope: string, message: string, fields?: unknown): void => write('warn', scope, message, fields),
  info: (scope: string, message: string, fields?: unknown): void => write('info', scope, message, fields),
};
