import 'server-only';
import { randomInt } from 'node:crypto';
import type { Cart as CtCart, Customer as CtCustomer, CustomerDraft, CustomerSignInResult } from '@commercetools/platform-sdk';
import { CUSTOMER_GROUP_KEY, CUSTOMER_NUMBER_ATTEMPTS, TOKEN_TTL_MINUTES } from '@/lib/config/auth';
import { DEMO_MARKER_FIELD, DEMO_MARKER_VALUE } from '@/lib/config/demo';
import type { SessionData } from '@/lib/session-types';
import { errorCodeOf, getSignInMergeArgs, statusOf } from './cart';
import { getApiRoot } from './client';
import { isDemoMode } from './env-core';
import { withTimeout } from './timeout';

// Customer reads and writes of workstream R. Credentials are owned by commercetools, customers are global (D-030, D-058): sign-in is
// `POST /login`, never an in-store path. Passwords, tokens and reset links are never logged and never put into an error message.

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid credentials');
    this.name = 'InvalidCredentialsError';
  }
}
export class AccountExistsError extends Error {
  constructor() {
    super('An account with this email already exists');
    this.name = 'AccountExistsError';
  }
}
export class InvalidTokenError extends Error {
  constructor() {
    super('The token is invalid, expired or already used');
    this.name = 'InvalidTokenError';
  }
}

/** Custom field of `malva-customer`: sessions issued before this instant are refused (set when the password is reset). */
export const SESSIONS_VALID_AFTER_FIELD = 'sessionsValidAfter';
const CUSTOMER_TYPE_KEY = 'malva-customer';

const duplicateFieldOf = (err: unknown): string | undefined => {
  const first = (err as { body?: { errors?: { code?: unknown; field?: unknown }[] } } | null)?.body?.errors?.[0];
  return first?.code === 'DuplicateField' && typeof first.field === 'string' ? first.field : undefined;
};

export interface SignInResult {
  customer: CtCustomer;
  /** The customer's cart after the merge (null when there was none). */
  cart: CtCart | null;
}

async function postLogin(body: { email: string; password: string; anonymousCart?: { typeId: 'cart'; id: string }; anonymousCartSignInMode?: 'MergeWithExistingCustomerCart' }): Promise<CustomerSignInResult> {
  const { body: result } = await withTimeout(getApiRoot().login().post({ body: { ...body, updateProductData: true } }).execute(), 'customer.login');
  return result;
}

/**
 * `POST /login` carrying the session's anonymous cart (M's `getSignInMergeArgs`: id only, no version) so commercetools merges it into
 * the customer's cart. Any failure that is not `InvalidCredentials` while an anonymous cart was sent is retried ONCE without it (a
 * stale or foreign cart must not block the sign-in).
 */
export async function signIn(email: string, password: string, session: SessionData = {}): Promise<SignInResult> {
  const merge = getSignInMergeArgs(session);
  try {
    const result = await postLogin({ email, password, ...merge });
    return { customer: result.customer, cart: result.cart ?? null };
  } catch (err) {
    const status = statusOf(err);
    if (errorCodeOf(err) === 'InvalidCredentials') throw new InvalidCredentialsError();
    if (!merge.anonymousCart || (status !== 400 && status !== 404 && status !== 409)) throw err;
  }
  try {
    const result = await postLogin({ email, password });
    return { customer: result.customer, cart: result.cart ?? null };
  } catch (err) {
    if (errorCodeOf(err) === 'InvalidCredentials') throw new InvalidCredentialsError();
    throw err;
  }
}

/** `MV-<5 random digits>-<digit sum mod 10>`. */
export function generateCustomerNumber(random: (max: number) => number = (max) => randomInt(max)): string {
  const digits = Array.from({ length: 5 }, () => random(10));
  const check = digits.reduce((sum, digit) => sum + digit, 0) % 10;
  return `MV-${digits.join('')}-${check}`;
}

export interface SignUpInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  locale: string;
}

/** Creates the customer (group `consumer`, generated customer number). Duplicate email -> AccountExistsError; a duplicate number is retried. */
export async function signUp(input: SignUpInput, newNumber: () => string = generateCustomerNumber): Promise<CtCustomer> {
  for (let attempt = 1; ; attempt += 1) {
    const draft: CustomerDraft = {
      email: input.email,
      password: input.password,
      firstName: input.firstName,
      lastName: input.lastName,
      customerNumber: newNumber(),
      customerGroup: { typeId: 'customer-group', key: CUSTOMER_GROUP_KEY },
      locale: input.locale,
      ...(isDemoMode() ? { custom: { type: { typeId: 'type' as const, key: CUSTOMER_TYPE_KEY }, fields: { [DEMO_MARKER_FIELD]: DEMO_MARKER_VALUE } } } : {}),
    };
    try {
      const { body } = await withTimeout(getApiRoot().customers().post({ body: draft }).execute(), 'customer.create');
      return body.customer;
    } catch (err) {
      const field = duplicateFieldOf(err);
      if (field === 'email') throw new AccountExistsError();
      if (field === 'customerNumber' && attempt < CUSTOMER_NUMBER_ATTEMPTS) continue;
      throw err;
    }
  }
}

/**
 * D-031: the server creates the email token and confirms it at once (no email is sent). Idempotent: an already verified customer is
 * returned as is. The token value stays in a local variable.
 */
export async function verifyEmailNow(customer: Pick<CtCustomer, 'id' | 'version' | 'isEmailVerified'>): Promise<Pick<CtCustomer, 'id' | 'version' | 'isEmailVerified'>> {
  if (customer.isEmailVerified) return customer;
  const root = getApiRoot();
  const { body: token } = await withTimeout(
    root.customers().emailToken().post({ body: { id: customer.id, version: customer.version, ttlMinutes: TOKEN_TTL_MINUTES.email } }).execute(),
    'customer.emailToken',
  );
  const { body: confirmed } = await withTimeout(root.customers().emailConfirm().post({ body: { tokenValue: token.value } }).execute(), 'customer.emailConfirm');
  return confirmed;
}

/** 60-minute, single-use token; a second request invalidates the first. `null` for an unknown email (the 404 is swallowed). */
export async function createPasswordResetToken(email: string): Promise<{ value: string; customerId: string } | null> {
  try {
    const { body } = await withTimeout(
      getApiRoot().customers().passwordToken().post({ body: { email, ttlMinutes: TOKEN_TTL_MINUTES.reset, invalidateOlderTokens: true } }).execute(),
      'customer.passwordToken',
    );
    return { value: body.value, customerId: body.customerId };
  } catch (err) {
    if (statusOf(err) === 404) return null;
    throw err;
  }
}

/** Looks the customer up by token WITHOUT consuming it. `null` when the token is unknown, expired or consumed. */
export async function validatePasswordToken(token: string): Promise<CtCustomer | null> {
  if (!/^[A-Za-z0-9_.~=-]{8,256}$/.test(token)) return null;
  try {
    const { body } = await withTimeout(getApiRoot().customers().withPasswordToken({ passwordToken: token }).get().execute(), 'customer.passwordTokenLookup');
    return body;
  } catch (err) {
    const status = statusOf(err);
    if (status === 404 || status === 400) return null;
    throw err;
  }
}

/** Consumes the token and sets the new password. Invalid, expired or used token -> InvalidTokenError. */
export async function resetPassword(token: string, newPassword: string): Promise<CtCustomer> {
  try {
    const { body } = await withTimeout(getApiRoot().customers().passwordReset().post({ body: { tokenValue: token, newPassword } }).execute(), 'customer.passwordReset');
    return body;
  } catch (err) {
    const status = statusOf(err);
    if (status === 400 || status === 404) throw new InvalidTokenError();
    throw err;
  }
}

/** `null` for an unknown id. Always a fresh read (never cached: it decides whether a session is still valid). */
export async function getCustomerById(id: string): Promise<CtCustomer | null> {
  try {
    const { body } = await withTimeout(getApiRoot().customers().withId({ ID: id }).get().execute(), 'customer.get');
    return body;
  } catch (err) {
    if (statusOf(err) === 404) return null;
    throw err;
  }
}

/** The instant (epoch ms) before which a session of this customer is invalid, or undefined. */
export function sessionsValidAfterOf(customer: CtCustomer): number | undefined {
  const value = (customer.custom?.fields as Record<string, unknown> | undefined)?.[SESSIONS_VALID_AFTER_FIELD];
  if (typeof value !== 'string') return undefined;
  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : time;
}

/** Sets `custom.fields.sessionsValidAfter = now`: every session signed in earlier stops working. Retries once on a version conflict. */
export async function markSessionsInvalid(customerId: string, now: Date = new Date()): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    const customer = await getCustomerById(customerId);
    if (!customer) return;
    const value = now.toISOString();
    const actions = customer.custom
      ? [{ action: 'setCustomField' as const, name: SESSIONS_VALID_AFTER_FIELD, value }]
      : [{ action: 'setCustomType' as const, type: { typeId: 'type' as const, key: CUSTOMER_TYPE_KEY }, fields: { [SESSIONS_VALID_AFTER_FIELD]: value } }];
    try {
      await withTimeout(getApiRoot().customers().withId({ ID: customerId }).post({ body: { version: customer.version, actions } }).execute(), 'customer.markSessionsInvalid');
      return;
    } catch (err) {
      if (statusOf(err) !== 409 || attempt >= 1) throw err;
    }
  }
}
