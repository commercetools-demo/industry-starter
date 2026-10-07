import { authError, authFailure, AuthRefusal, rateLimited, readAuthBody, readMergedBundle, startCustomerSession, stringField } from '@/lib/auth/api';
import { isPlausibleEmail, normalizeEmail } from '@/lib/auth/email';
import { buildMergeNotes } from '@/lib/auth/merge';
import { assertSameOrigin } from '@/lib/auth/origin';
import { rateLimit } from '@/lib/auth/rate-limit';
import { safeReturnPath } from '@/lib/auth/return-target';
import { NAME_MAX_LENGTH, RATE_LIMITS } from '@/lib/config/auth';
import { checkPassword } from '@/lib/config/password';
import { AccountExistsError, signIn, signUp, verifyEmailNow } from '@/lib/ct/customer';
import { json } from '@/lib/ct/http';
import { getSession } from '@/lib/ct/session';
import { mapCustomer } from '@/lib/mappers/customer';
import { getMarket } from '@/lib/market/server';
import { clientKey } from '@/lib/rate-limit';
import { isSupportedLocale } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const EXISTS_MESSAGE = 'An account with this email already exists. Log in or reset your password.';

const validName = (value: string): boolean => value.length >= 1 && value.length <= NAME_MAX_LENGTH;

/** Creates the account (group `consumer`), confirms the email at once (D-031), signs in and merges the anonymous bundle. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ip = rateLimit(clientKey(request, 'register'), RATE_LIMITS.registerIp);
    if (!ip.ok) return rateLimited(ip.retryAfterSeconds);

    const body = await readAuthBody(request);
    const firstName = stringField(body, 'firstName').trim();
    const lastName = stringField(body, 'lastName').trim();
    const email = normalizeEmail(stringField(body, 'email'));
    const password = stringField(body, 'password');

    const fields: string[] = [];
    if (!validName(firstName)) fields.push('firstName');
    if (!validName(lastName)) fields.push('lastName');
    if (!isPlausibleEmail(email)) fields.push('email');
    if (fields.length > 0) throw new AuthRefusal(400, 'INVALID_INPUT', 'Check the highlighted fields.', { fields });
    const policy = checkPassword(password, { email });
    if (!policy.ok) return authError(400, 'WEAK_PASSWORD', 'The password does not meet the requirements.', { failed: policy.failed });

    const market = await getMarket();
    const locale = isSupportedLocale(body.locale) ? body.locale : market.locale;
    let customer;
    try {
      customer = await signUp({ email, password, firstName, lastName, locale });
    } catch (error) {
      if (error instanceof AccountExistsError) return authError(409, 'ACCOUNT_EXISTS', EXISTS_MESSAGE);
      throw error;
    }
    try {
      await verifyEmailNow(customer);
    } catch (error) {
      // The account exists; the reset flow confirms the address later. Never fail the registration for this.
      console.error('[auth] email confirmation failed', error instanceof Error ? error.name : 'unknown');
    }

    const result = await signIn(email, password, await getSession());
    const merged = await readMergedBundle(result.customer.id, result.cart?.id, market);
    const response = json(
      {
        user: mapCustomer(result.customer),
        cart: merged.cart,
        mergeNotes: buildMergeNotes(merged.cart),
        redirectTo: safeReturnPath(typeof body.returnTo === 'string' ? body.returnTo : undefined, locale),
      },
      { status: 201 },
    );
    await startCustomerSession(response, result.customer.id, merged.cartId);
    return response;
  } catch (error) {
    return authFailure(error);
  }
}
