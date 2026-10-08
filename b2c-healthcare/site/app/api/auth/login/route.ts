import { ApiError, handle } from '@/lib/api';
import { validateSignIn } from '@/lib/auth-validation';
import { FIELDS_INVALID, LOGIN_FAILED, clientKeyOf, readJsonObject, toAccountUser, tooManyAttempts } from '@/lib/auth-route';
import { InvalidCredentialsError, TooManyAttemptsError, login } from '@/lib/ct/identity';
import { getSession, updateSession } from '@/lib/session';

/**
 * POST /api/auth/login { email, password }. Signs in with the anonymous session cart (merged by the platform),
 * writes `customerId` and the resulting `cartId` to the session and returns the minimal user.
 * Unknown email and wrong password answer identically (401, same text).
 */
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const body = await readJsonObject(request);
    const problems = validateSignIn(body);
    if (Object.keys(problems).length > 0) {
      return Response.json({ error: FIELDS_INVALID, fields: problems }, { status: 400 });
    }
    const { cartId: anonymousCartId } = await getSession();
    try {
      const outcome = await login({
        email: body.email as string,
        password: body.password as string,
        anonymousCartId,
        clientKey: clientKeyOf(request),
      });
      // `cartId: undefined` removes a stale anonymous cart that did not come back with the customer.
      await updateSession({ customerId: outcome.user.id, cartId: outcome.cartId });
      return toAccountUser(outcome.user);
    } catch (error) {
      if (error instanceof InvalidCredentialsError) throw new ApiError(401, LOGIN_FAILED);
      if (error instanceof TooManyAttemptsError) return tooManyAttempts(error);
      throw error;
    }
  });
}
