import { ApiError, handle } from '@/lib/api';
import { FIELDS_INVALID, REGISTER_REFUSED, clientKeyOf, readJsonObject, toAccountUser, tooManyAttempts } from '@/lib/auth-route';
import { EmailUnavailableError, TooManyAttemptsError, ValidationError, register } from '@/lib/ct/identity';
import { attachAfterSignIn } from '@/lib/attach-guest-bookings';
import { getSession, updateSession } from '@/lib/session';

/**
 * POST /api/auth/register { name, email, password }. Creates the customer, verifies the address automatically
 * (no email provider, D-029) and signs the new patient in. A duplicate address is refused with a text that does
 * not say the address exists; attempts are counted per client.
 */
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const body = await readJsonObject(request);
    const { cartId: anonymousCartId } = await getSession();
    try {
      const outcome = await register({
        name: typeof body.name === 'string' ? body.name : '',
        email: typeof body.email === 'string' ? body.email : '',
        password: typeof body.password === 'string' ? body.password : '',
        anonymousCartId,
        clientKey: clientKeyOf(request),
      });
      await updateSession({ customerId: outcome.user.id, cartId: outcome.cartId });
      await attachAfterSignIn({ customerId: outcome.user.id, email: outcome.user.email, emailVerified: outcome.emailVerified });
      return Response.json({ ...toAccountUser(outcome.user), emailVerified: outcome.emailVerified }, { status: 201 });
    } catch (error) {
      if (error instanceof ValidationError) return Response.json({ error: FIELDS_INVALID, fields: error.problems }, { status: 400 });
      if (error instanceof EmailUnavailableError) throw new ApiError(409, REGISTER_REFUSED);
      if (error instanceof TooManyAttemptsError) return tooManyAttempts(error);
      throw error;
    }
  });
}
