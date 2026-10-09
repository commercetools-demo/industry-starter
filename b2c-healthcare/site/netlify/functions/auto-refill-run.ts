/**
 * Netlify scheduled function: the daily auto-refill check. A thin wrapper: the work (decideRun, the
 * prescription ledger, `malva-refill-log`) runs in the Next app behind `POST /api/internal/auto-refill-run`, where the
 * storefront's modules are; this function only calls it with the shared secret. No commercetools code is imported
 * here (`server-only` modules cannot be bundled into a function).
 *
 * Guard against public triggering, in three layers:
 *  1. Netlify routes no public HTTP traffic to a scheduled function in production;
 *  2. a call that is not a scheduler event (no `next_run` in the body) must carry the secret in `x-refill-secret`;
 *  3. the Next route refuses without the secret, and the run is idempotent (a run is checked once).
 *
 * Environment (Netlify site settings, never in git): `AUTO_REFILL_RUN_SECRET` (16+ characters, the same value the app
 * has), and the site URL (`URL`, set by Netlify, or `SITE_URL`). Local test:
 *   npx netlify functions:invoke auto-refill-run --headers '{"x-refill-secret":"<secret>"}'
 */

export const RUN_SECRET_HEADER = 'x-refill-secret';
export const RUN_PATH = '/api/internal/auto-refill-run';
/** Every day at 05:00 UTC: refills due within the next 36 hours are checked ahead of the platform generating them. */
export const config = { schedule: '0 5 * * *' };

type Env = Record<string, string | undefined>;
type Fetch = typeof fetch;

async function isSchedulerEvent(request: Request): Promise<boolean> {
  try {
    const body: unknown = await request.clone().json();
    return typeof body === 'object' && body !== null && 'next_run' in body;
  } catch {
    return false;
  }
}

/** The handler's logic with its inputs passed in, so it can be tested without Netlify. */
export async function runScheduled(request: Request, env: Env = process.env, fetchImpl: Fetch = fetch): Promise<Response> {
  const secret = env.AUTO_REFILL_RUN_SECRET?.trim();
  const base = (env.URL ?? env.SITE_URL ?? '').trim().replace(/\/$/, '');
  if (!secret || secret.length < 16 || !base) return new Response('not configured', { status: 503 });
  if (!(await isSchedulerEvent(request)) && request.headers.get(RUN_SECRET_HEADER) !== secret) return new Response('unauthorized', { status: 401 });
  try {
    const response = await fetchImpl(`${base}${RUN_PATH}`, { method: 'POST', headers: { [RUN_SECRET_HEADER]: secret } });
    // Counts only; the body never carries an id or a name.
    return new Response(await response.text(), { status: response.ok ? 200 : 502, headers: { 'content-type': 'application/json' } });
  } catch {
    return new Response('run failed', { status: 502 });
  }
}

export default async function handler(request: Request): Promise<Response> {
  return runScheduled(request);
}
