/**
 * Development helper for browser checks without commercetools (`MALVA_FIXTURES=1`, see lib/ct/fixtures.ts).
 * Prints a signed `malva_session` cookie for a fixture patient, so `/prescriptions` can be opened as Sam Rivera:
 *
 *   SESSION_SECRET=<32+ chars, the same as the dev server> npx tsx scripts/dev-session.ts [sam-rivera|alex-chen|jordan-lee]
 *   curl -H "cookie: <printed value>" http://localhost:3111/en-US/prescriptions
 *
 * It signs with the secret from the environment (never stored) and refuses to run when NODE_ENV is production.
 */
import { SESSION_COOKIE, resolveSecret, signSession } from '../lib/session-core';

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') throw new Error('dev-session is for development only');
  const slug = process.argv[2] ?? 'sam-rivera';
  const secret = resolveSecret(process.env.SESSION_SECRET, process.env.NODE_ENV);
  const token = await signSession({ customerId: `fixture-${slug}`, locale: 'en-US', country: 'US', currency: 'USD' }, secret);
  console.log(`${SESSION_COOKIE}=${token}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'failed');
  process.exitCode = 1;
});
