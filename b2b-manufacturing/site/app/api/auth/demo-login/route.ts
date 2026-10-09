import { ApiError, handle, ok, parseBody } from '@/lib/api';
import { limitLogin } from '@/lib/auth-limits';
import { loginCustomer } from '@/lib/ct/auth';
import { signInSessionPatch } from '@/lib/ct/business-units';
import { DEMO_USERS, demoPassword, demoUserByEmail } from '@/lib/demo-login';
import { demoLoginSchema } from '@/lib/schemas';
import { getSession, saveSession } from '@/lib/session';
import { setCart } from '@/lib/session-core';

/** The sample customers to offer, or none where demo sign-in is switched off. */
export const GET = handle(async () => {
  const res = ok({ users: demoPassword() ? DEMO_USERS.map(({ email, name, company, role }) => ({ email, name, company, role })) : [] });
  res.headers.set('Cache-Control', 'no-store');
  return res;
});

/** Signs in one of the sample customers; only the email is sent, the password is read from the server's environment. */
export const POST = handle(async (request: Request) => {
  const password = demoPassword();
  if (!password) throw new ApiError(404, 'Not found.');
  const { email } = await parseBody(request, demoLoginSchema, 'Choose a sample customer.');
  if (!demoUserByEmail(email)) throw new ApiError(400, 'Choose a sample customer.');
  await limitLogin(request, email);
  const login = await loginCustomer(email, password, (await getSession()).cartId);
  if (!login) throw new ApiError(401, 'The sample customer could not be signed in.');
  let next = await signInSessionPatch(await getSession(), login.customer);
  if (login.cart) next = setCart(next, login.cart.id);
  await saveSession(next);
  return ok({ businessUnitKey: next.businessUnitKey ?? null });
});
