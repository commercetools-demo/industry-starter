import { ApiError, handle } from '@/lib/api';
import { LOGIN_FAILED, clientKeyOf, readJsonObject, toAccountUser, tooManyAttempts } from '@/lib/auth-route';
import { InvalidCredentialsError, TooManyAttemptsError, login } from '@/lib/ct/identity';
import { attachAfterSignIn } from '@/lib/attach-guest-bookings';
import { demoPassword, findDemoPatient } from '@/lib/demo-login';
import { getSession, updateSession } from '@/lib/session';

/**
 * POST /api/auth/demo-login { slug }. Demo shops only: signs in one of the three synthetic patients with the server-side
 * `DEMO_LOGIN_PASSWORD`. Answers 404 (as if the route did not exist) when that variable is not set or the slug is unknown.
 */
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const password = demoPassword();
    const body = await readJsonObject(request);
    const patient = findDemoPatient(body.slug);
    if (!password || !patient) throw new ApiError(404, 'Not found');
    const { cartId: anonymousCartId } = await getSession();
    try {
      const outcome = await login({ email: patient.email, password, anonymousCartId, clientKey: clientKeyOf(request) });
      await updateSession({ customerId: outcome.user.id, cartId: outcome.cartId });
      await attachAfterSignIn({ customerId: outcome.user.id, email: outcome.user.email, emailVerified: outcome.user.isEmailVerified });
      return toAccountUser(outcome.user);
    } catch (error) {
      if (error instanceof InvalidCredentialsError) throw new ApiError(401, LOGIN_FAILED);
      if (error instanceof TooManyAttemptsError) return tooManyAttempts(error);
      throw error;
    }
  });
}
