import { ApiError, handle, ok, parseBody } from '@/lib/api';
import { limitRegistration } from '@/lib/auth-limits';
import { loginCustomer } from '@/lib/ct/auth';
import { registerCompany } from '@/lib/ct/registration';
import { getStoreChannelData } from '@/lib/ct/stores';
import { looksLikeBot } from '@/lib/bot-check';
import { checkPassword, PASSWORD_MESSAGES } from '@/lib/password';
import { getSession, saveSession } from '@/lib/session';
import { setBusinessContext, setCart, setCustomer } from '@/lib/session-core';
import { registerSchema } from '@/lib/schemas';

const DUPLICATE_MESSAGE = 'We could not create the account. An account may already exist for this email address: try signing in.';

export const POST = handle(async (request: Request) => {
  await limitRegistration(request);
  const input = await parseBody(request, registerSchema, 'Check the highlighted fields.');
  // A bot gets the same generic answer as a duplicate email, and nothing is created.
  if (looksLikeBot(input)) throw new ApiError(400, DUPLICATE_MESSAGE);
  const rule = checkPassword(input.password);
  if (rule) throw new ApiError(400, PASSWORD_MESSAGES[rule], { fieldErrors: { password: PASSWORD_MESSAGES[rule] } });

  const result = await registerCompany(input);
  if (result.status === 'duplicate') throw new ApiError(400, DUPLICATE_MESSAGE);

  // Sign the new administrator in, carrying over any quote list built before registering.
  const session = await getSession();
  const login = await loginCustomer(input.email, input.password, session.cartId);
  if (!login) throw new ApiError(500, 'Your account was created. Please sign in.');
  const store = await getStoreChannelData(process.env.CTP_DEFAULT_STORE_KEY ?? 'mpw-web');
  let next = setCustomer(session, { customerId: login.customer.id, customerEmail: login.customer.email, customerFirstName: login.customer.firstName, customerLastName: login.customer.lastName });
  next = setBusinessContext(next, { ...store, businessUnitKey: result.businessUnitKey });
  if (login.cart) next = setCart(next, login.cart.id);
  await saveSession(next);
  return ok({ businessUnitKey: result.businessUnitKey });
});
