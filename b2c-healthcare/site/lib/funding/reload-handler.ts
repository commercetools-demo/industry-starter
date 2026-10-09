import { timingSafeEqual } from 'node:crypto';
import type { ReloadResult } from '@/lib/funding/allowance-core';

/**
 * The HTTP side of the scheduled allowance reload (workstream U), kept free of Netlify and commercetools imports so it
 * can be tested. The reload itself is idempotent (a second run in the same cycle changes nothing), but it is still a
 * write on behalf of every member, so the endpoint answers only a caller that sends the shared secret in the
 * `x-malva-reload-secret` header (`RELOAD_ALLOWANCES_SECRET`). No secret configured means the endpoint is closed.
 */

export const RELOAD_SECRET_HEADER = 'x-malva-reload-secret';

const sameSecret = (given: string, expected: string): boolean => {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

export interface ReloadDeps {
  /** Runs the reload against the real store. */
  run: (now: Date) => Promise<ReloadResult>;
  /** `RELOAD_ALLOWANCES_SECRET`. */
  secret: string | undefined;
  now?: () => Date;
}

const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function handleReload(request: Request, deps: ReloadDeps): Promise<Response> {
  // A secret shorter than 16 characters counts as not configured (docs/deploy.md: generate with openssl rand -base64 32).
  if (!deps.secret || deps.secret.length < 16) return json(503, { error: 'The reload is not configured.' });
  if (request.method !== 'POST') return json(405, { error: 'Use POST.' });
  const given = request.headers.get(RELOAD_SECRET_HEADER) ?? '';
  if (!given || !sameSecret(given, deps.secret)) return json(401, { error: 'Not allowed.' });
  try {
    const result = await deps.run((deps.now ?? (() => new Date()))());
    // Counts only: no member reference and no amount per member leaves this function.
    return json(200, { ok: true, ...result });
  } catch {
    return json(502, { error: 'The reload failed. It is safe to run it again.' });
  }
}
