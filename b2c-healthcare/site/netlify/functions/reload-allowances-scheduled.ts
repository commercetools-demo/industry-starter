import { RELOAD_SECRET_HEADER } from '../../lib/funding/reload-handler';

/**
 * Netlify scheduled function (workstream U): at 00:10 UTC on the first of every month it asks the guarded
 * `reload-allowances` function to run the allowance reload (grant the new cycle, forfeit the unspent remainder of the
 * old one). The schedule itself carries no secret and does no work of its own; it presents `RELOAD_ALLOWANCES_SECRET` to
 * the guarded endpoint, which is also what a manual or retried run uses. Doubled or retried runs are harmless: the
 * reload is idempotent per member per cycle.
 */
export const config = { schedule: '10 0 1 * *' };

export default async function scheduled(): Promise<Response> {
  const secret = process.env.RELOAD_ALLOWANCES_SECRET;
  const site = process.env.URL;
  if (!secret || !site) return new Response('reload not configured', { status: 503 });
  const response = await fetch(`${site.replace(/\/$/, '')}/.netlify/functions/reload-allowances`, { method: 'POST', headers: { [RELOAD_SECRET_HEADER]: secret } });
  return new Response(null, { status: response.ok ? 204 : 502 });
}
