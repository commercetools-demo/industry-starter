import { timingSafeEqual } from 'node:crypto';
import type { RetentionResult } from './retention';

/**
 * The HTTP side of the scheduled retention run (workstream X), free of Netlify and commercetools imports so it can be tested.
 * Retention deletes data, so the endpoint answers only a caller that sends the shared secret in `x-malva-retention-secret`
 * (`RETENTION_SECRET`); without a configured secret it is closed (503). Same pattern as the allowance reload.
 */
export const RETENTION_SECRET_HEADER = 'x-malva-retention-secret';

const sameSecret = (given: string, expected: string): boolean => {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

export interface RetentionDeps {
  run: (now: Date) => Promise<RetentionResult>;
  /** `RETENTION_SECRET`. */
  secret: string | undefined;
  now?: () => Date;
}

const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function handleRetention(request: Request, deps: RetentionDeps): Promise<Response> {
  if (!deps.secret) return json(503, { error: 'Retention is not configured.' });
  if (request.method !== 'POST') return json(405, { error: 'Use POST.' });
  const given = request.headers.get(RETENTION_SECRET_HEADER) ?? '';
  if (!given || !sameSecret(given, deps.secret)) return json(401, { error: 'Not allowed.' });
  try {
    const result = await deps.run((deps.now ?? (() => new Date()))());
    // Counts only: no key, reference or value leaves this function.
    return json(200, { ok: true, ...result });
  } catch {
    return json(502, { error: 'Retention failed. It is safe to run it again.' });
  }
}
