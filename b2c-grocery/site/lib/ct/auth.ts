import 'server-only';
import type { Cart as CtCart, Customer as CtCustomer } from '@commercetools/platform-sdk';
import { getApiRoot } from './client';

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid credentials');
    this.name = 'InvalidCredentialsError';
  }
}
export class AccountExistsError extends Error {
  constructor() {
    super('Account exists');
    this.name = 'AccountExistsError';
  }
}
export class InvalidTokenError extends Error {
  constructor() {
    super('Invalid or expired token');
    this.name = 'InvalidTokenError';
  }
}

type CtErrorShape = { statusCode?: unknown; body?: { errors?: { code?: unknown }[] } };
const statusOf = (e: unknown): number | undefined => {
  const code = typeof e === 'object' && e !== null ? (e as CtErrorShape).statusCode : undefined;
  return typeof code === 'number' ? code : undefined;
};
const hasCode = (e: unknown, code: string): boolean =>
  typeof e === 'object' && e !== null && ((e as CtErrorShape).body?.errors ?? []).some((x) => x.code === code);

/**
 * Sign in through `/login` (never `customers().login()`), merging the anonymous cart into the customer's cart.
 * Wrong password and unknown email are both `InvalidCredentials` (HTTP 400, verified live) and throw the same error.
 * A stale anonymous cart (ordered, deleted) must not block sign-in, so any other failure retries without it.
 */
export async function signIn(email: string, password: string, anonymousCartId?: string): Promise<{ customer: CtCustomer; cart?: CtCart }> {
  const attempt = async (withCart: boolean) =>
    (
      await getApiRoot()
        .login()
        .post({
          body: {
            email,
            password,
            ...(withCart && anonymousCartId
              ? { anonymousCart: { id: anonymousCartId, typeId: 'cart' as const }, anonymousCartSignInMode: 'MergeWithExistingCustomerCart' as const }
              : {}),
          },
        })
        .execute()
    ).body;
  try {
    return await attempt(true);
  } catch (e) {
    if (hasCode(e, 'InvalidCredentials')) throw new InvalidCredentialsError();
    if (!anonymousCartId) throw e;
  }
  try {
    return await attempt(false);
  } catch (e) {
    if (hasCode(e, 'InvalidCredentials')) throw new InvalidCredentialsError();
    throw e;
  }
}

/** D-038: no email is sent. Creates the email token and confirms it at once so the customer is verified. */
export async function verifyEmailNow(customer: CtCustomer): Promise<void> {
  const root = getApiRoot().customers();
  const { body: token } = await root.emailToken().post({ body: { id: customer.id, version: customer.version, ttlMinutes: 5 } }).execute();
  await root.emailConfirm().post({ body: { tokenValue: token.value } }).execute();
}

/** Creates the customer (verified immediately). A duplicate email (`DuplicateField`, HTTP 400) throws `AccountExistsError`. */
export async function signUp(draft: { email: string; password: string; firstName: string; lastName: string }): Promise<CtCustomer> {
  let customer: CtCustomer;
  try {
    customer = (await getApiRoot().customers().post({ body: draft }).execute()).body.customer;
  } catch (e) {
    if (hasCode(e, 'DuplicateField')) throw new AccountExistsError();
    throw e;
  }
  await verifyEmailNow(customer);
  return customer;
}

/** The reset token, or `null` when no customer has that email (commercetools answers 404). Never reveals existence to the caller. */
export async function createPasswordResetToken(email: string): Promise<string | null> {
  try {
    const { body } = await getApiRoot().customers().passwordToken().post({ body: { email, ttlMinutes: 60 } }).execute();
    return body.value;
  } catch (e) {
    if (statusOf(e) === 404) return null;
    throw e;
  }
}

/** Unknown, used or expired token (404 `ResourceNotFound`, or 400 `InvalidInput`) throws `InvalidTokenError`. */
export async function resetPassword(tokenValue: string, newPassword: string): Promise<CtCustomer> {
  try {
    return (await getApiRoot().customers().passwordReset().post({ body: { tokenValue, newPassword } }).execute()).body;
  } catch (e) {
    const status = statusOf(e);
    if (status === 404 || status === 400) throw new InvalidTokenError();
    throw e;
  }
}
