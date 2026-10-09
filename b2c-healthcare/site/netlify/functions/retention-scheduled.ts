import { RETENTION_SECRET_HEADER } from '../../scripts/privacy/retention-handler';

/**
 * Netlify scheduled function: every day at 03:30 UTC it asks the guarded `retention` function to run the
 * retention rules. The schedule carries no secret and does no work of its own; it presents `RETENTION_SECRET` to the guarded
 * endpoint, which is also what a manual or retried run uses. A doubled run is harmless: every rule is idempotent.
 */
export const config = { schedule: '30 3 * * *' };

export default async function scheduled(): Promise<Response> {
  const secret = process.env.RETENTION_SECRET;
  const site = process.env.URL;
  if (!secret || !site) return new Response('retention not configured', { status: 503 });
  const response = await fetch(`${site.replace(/\/$/, '')}/.netlify/functions/retention`, { method: 'POST', headers: { [RETENTION_SECRET_HEADER]: secret } });
  return new Response(null, { status: response.ok ? 204 : 502 });
}
