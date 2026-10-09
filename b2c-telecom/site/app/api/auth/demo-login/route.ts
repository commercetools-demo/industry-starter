import {
  AuthRefusal,
  authFailure,
  invalidCredentials,
  padResponse,
  rateLimited,
  readAuthBody,
  readMergedBundle,
  startCustomerSession,
  stringField,
} from '@/lib/auth/api';
import { normalizeEmail } from '@/lib/auth/email';
import { buildMergeNotes } from '@/lib/auth/merge';
import { assertSameOrigin } from '@/lib/auth/origin';
import { rateLimit } from '@/lib/auth/rate-limit';
import { safeReturnPath } from '@/lib/auth/return-target';
import { RATE_LIMITS } from '@/lib/config/auth';
import { DEMO_LOGIN_CUSTOMERS, demoLoginEnabled } from '@/lib/config/demo-login';
import { InvalidCredentialsError, signIn } from '@/lib/ct/customer';
import { json } from '@/lib/ct/http';
import { getSession } from '@/lib/ct/session';
import { mapCustomer } from '@/lib/mappers/customer';
import { getMarket } from '@/lib/market/server';
import { clientKey } from '@/lib/rate-limit';
import { isSupportedLocale } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** Demo only: signs in one of the listed sample customers with the server-side seed password. 404 when the demo sign-in is off. */
export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    if (!demoLoginEnabled()) return new Response(null, { status: 404 });
    assertSameOrigin(request);
    const ip = rateLimit(clientKey(request, 'login'), RATE_LIMITS.loginIp);
    if (!ip.ok) return rateLimited(ip.retryAfterSeconds);

    const body = await readAuthBody(request);
    const email = normalizeEmail(stringField(body, 'email'));
    if (!DEMO_LOGIN_CUSTOMERS.some((c) => c.email === email)) throw new AuthRefusal(400, 'INVALID_INPUT', 'Unknown sample customer.');

    const session = await getSession();
    let result;
    try {
      result = await signIn(email, process.env.SEED_DEMO_PASSWORD as string, session);
    } catch (error) {
      if (!(error instanceof InvalidCredentialsError)) throw error;
      await padResponse(startedAt);
      return invalidCredentials();
    }

    const market = await getMarket();
    const merged = await readMergedBundle(result.customer.id, result.cart?.id, market);
    const locale = isSupportedLocale(body.locale) ? body.locale : market.locale;
    const response = json({
      user: mapCustomer(result.customer),
      cart: merged.cart,
      mergeNotes: buildMergeNotes(merged.cart),
      redirectTo: safeReturnPath(typeof body.returnTo === 'string' ? body.returnTo : undefined, locale),
    });
    await startCustomerSession(response, result.customer.id, merged.cartId);
    return response;
  } catch (error) {
    return authFailure(error);
  }
}
