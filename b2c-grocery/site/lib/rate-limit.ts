type Window = { count: number; resetAt: number };
const store = ((globalThis as { __rateLimit?: Map<string, Window> }).__rateLimit ??= new Map());

export const LIMITS = {
  login: { limit: 10, windowMs: 60_000 },
  register: { limit: 5, windowMs: 60_000 },
  forgot: { limit: 5, windowMs: 60_000 },
  reset: { limit: 5, windowMs: 60_000 },
  contact: { limit: 5, windowMs: 60_000 },
} as const;

/** Fixed window, in memory per serverless instance (accepted risk D-047). */
export function rateLimit(key: string, opts: { limit: number; windowMs: number }, now = Date.now()): { ok: boolean; retryAfterSeconds: number } {
  const w = store.get(key);
  if (!w || now >= w.resetAt) {
    store.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }
  if (w.count >= opts.limit) return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((w.resetAt - now) / 1000)) };
  w.count += 1;
  return { ok: true, retryAfterSeconds: 0 };
}

export function clientKey(request: Request, route: string): string {
  const ip =
    request.headers.get('x-nf-client-connection-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown';
  return `${route}:${ip}`;
}
