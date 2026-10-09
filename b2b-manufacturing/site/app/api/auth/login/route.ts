import { ApiError, handle, ok, parseBody } from '@/lib/api';
import { limitLogin } from '@/lib/auth-limits';
import { loginCustomer } from '@/lib/ct/auth';
import { signInSessionPatch } from '@/lib/ct/business-units';
import { getSession, saveSession } from '@/lib/session';
import { setCart } from '@/lib/session-core';
import { loginSchema } from '@/lib/schemas';

export const POST = handle(async (request: Request) => {
  const { email, password } = await parseBody(request, loginSchema, 'Enter your email and password.');
  await limitLogin(request, email);
  const login = await loginCustomer(email, password, (await getSession()).cartId);
  if (!login) throw new ApiError(401, 'Email or password is incorrect.');
  // Every lookup completes before anything is written, so a failure leaves the cookie as it was.
  let next = await signInSessionPatch(await getSession(), login.customer);
  if (login.cart) next = setCart(next, login.cart.id);
  await saveSession(next);
  return ok({ businessUnitKey: next.businessUnitKey ?? null });
});
