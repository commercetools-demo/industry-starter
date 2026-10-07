// Fixed-window in-memory rate limiter. Per server instance (accepted risk on serverless, see README).

type Window = { count: number; resetAt: number };

const store = (globalThis as { __malvaRateLimit?: Map<string, Window> }).__malvaRateLimit ?? new Map<string, Window>();
(globalThis as { __malvaRateLimit?: Map<string, Window> }).__malvaRateLimit = store;

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
  now: number = Date.now(),
): { ok: boolean; retryAfterSeconds: number } {
  let entry = store.get(key);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + opts.windowMs };
    store.set(key, entry);
  }
  if (entry.count >= opts.limit) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
  }
  entry.count += 1;
  return { ok: true, retryAfterSeconds: 0 };
}

export function clientKey(request: Request, route: string): string {
  const netlify = request.headers.get('x-nf-client-connection-ip')?.trim();
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return `${netlify || forwarded || 'unknown'}:${route}`;
}
