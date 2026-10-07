import {
  authFailure,
  invalidCredentials,
  padResponse,
  rateLimited,
  readAuthBody,
  readMergedBundle,
  startCustomerSession,
  stringField,
} from '@/lib/auth/api';
import { isPlausibleEmail, normalizeEmail } from '@/lib/auth/email';
import { buildMergeNotes } from '@/lib/auth/merge';
import { assertSameOrigin } from '@/lib/auth/origin';
import { clearFailures, isLockedOut, rateLimit, registerFailure } from '@/lib/auth/rate-limit';
import { safeReturnPath } from '@/lib/auth/return-target';
import { PASSWORD_POLICY } from '@/lib/config/password';
import { RATE_LIMITS } from '@/lib/config/auth';
import { InvalidCredentialsError, signIn } from '@/lib/ct/customer';
import { json } from '@/lib/ct/http';
import { getSession } from '@/lib/ct/session';
import { mapCustomer } from '@/lib/mappers/customer';
import { getMarket } from '@/lib/market/server';
import { clientKey } from '@/lib/rate-limit';
import { isSupportedLocale } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** Sign in with email and password. Every failure looks the same (status, body, headers, and at least MIN_RESPONSE_MS of time). */
export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    assertSameOrigin(request);
    const ip = rateLimit(clientKey(request, 'login'), RATE_LIMITS.loginIp);
    if (!ip.ok) return rateLimited(ip.retryAfterSeconds);

    const body = await readAuthBody(request);
    const email = normalizeEmail(stringField(body, 'email'));
    const password = stringField(body, 'password');
    const plausible = isPlausibleEmail(email) && password.length > 0 && password.length <= PASSWORD_POLICY.maxLength;
    if (!plausible) {
      // Malformed input answers like a wrong password (no probing) and is not counted against any email.
      await padResponse(startedAt);
      return invalidCredentials();
    }
    const lock = isLockedOut(email);
    if (lock.locked) return rateLimited(lock.retryAfterSeconds);

    const session = await getSession();
    let result;
    try {
      result = await signIn(email, password, session);
    } catch (error) {
      if (!(error instanceof InvalidCredentialsError)) throw error;
      registerFailure(email);
      await padResponse(startedAt);
      return invalidCredentials();
    }
    clearFailures(email);

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
