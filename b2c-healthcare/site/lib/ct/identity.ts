import 'server-only';
import { createHash, randomInt } from 'node:crypto';
import type { Customer } from '@commercetools/platform-sdk';
import { normalizeEmail, splitFullName, validateRegistration, type RegisterProblems } from '@/lib/auth-validation';
import { apiRoot } from '@/lib/ct/client';
import { loadDevRoot } from '@/lib/ct/fixtures';
import { getRateLimitStatus, recordFailedLookup } from '@/lib/ct/ratelimit';
import { checkPassword } from '@/lib/password-policy';
import { clearCustomer } from '@/lib/session';

/**
 * Identity: sign-in, registration (auto-verified, D-029), password change, email-token functions
 * and the sign-out of the cookie session. Server only; every Route Handler under `app/api/auth` calls one of these.
 *
 * No password reset exists on purpose (D-032): there is no reset function, route or link.
 */

/** Custom Type key of the patient customer fields (seeded by workstream E). */
export const PATIENT_TYPE_KEY = 'mlv-patient';
/** Lifetime of the email token; the platform includes the token value in messages only up to 60 minutes. */
export const EMAIL_TOKEN_TTL_MINUTES = 10;

export interface IdentityUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  isEmailVerified: boolean;
}

export interface SignInOutcome {
  user: IdentityUser;
  /** The cart that came back with the sign-in (merged anonymous cart or the most recently modified active cart). */
  cartId?: string;
}

/** Wrong password or unknown email: one error for both, so nothing can tell them apart. */
export class InvalidCredentialsError extends Error {
  constructor() {
    super('invalid credentials');
    this.name = 'InvalidCredentialsError';
  }
}
export class TooManyAttemptsError extends Error {
  readonly retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super('too many attempts');
    this.name = 'TooManyAttemptsError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
/** The address already has an account. Never shown as such: the route words it generically. */
export class EmailUnavailableError extends Error {
  constructor() {
    super('email unavailable');
    this.name = 'EmailUnavailableError';
  }
}
export class ValidationError extends Error {
  readonly problems: RegisterProblems;
  constructor(problems: RegisterProblems) {
    super('validation failed');
    this.name = 'ValidationError';
    this.problems = problems;
  }
}
export class WrongCurrentPasswordError extends Error {
  constructor() {
    super('wrong current password');
    this.name = 'WrongCurrentPasswordError';
  }
}

// ---------------------------------------------------------------------------------------------
// helpers

const statusOf = (e: unknown): number | undefined => {
  const x = e as { statusCode?: unknown; code?: unknown } | undefined;
  return typeof x?.statusCode === 'number' ? x.statusCode : typeof x?.code === 'number' ? x.code : undefined;
};
const errorCodes = (e: unknown): string[] => {
  const errors = (e as { body?: { errors?: unknown } } | undefined)?.body?.errors;
  return Array.isArray(errors) ? errors.map((x) => (x as { code?: unknown })?.code).filter((c): c is string => typeof c === 'string') : [];
};
const hasCode = (e: unknown, code: string): boolean => errorCodes(e).includes(code);

function toUser(c: Customer): IdentityUser {
  return { id: c.id, email: c.email, firstName: c.firstName, lastName: c.lastName, isEmailVerified: c.isEmailVerified };
}

/** Opaque per-patient reference stored on the customer; clinical records link to it, never to name or email. */
export function newPatientRef(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let ref = 'pt_';
  for (let i = 0; i < 8; i += 1) ref += alphabet[randomInt(alphabet.length)];
  return ref;
}

/** Throttle bucket id: a hash, so no email address or IP appears in a Custom Object key. */
export function attemptBucket(kind: 'login' | 'register' | 'password', ...parts: string[]): string {
  return `${kind}-${createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32)}`;
}

/** Throws TooManyAttemptsError when the bucket is full. A throttle-store outage does not block sign-in (logged, fails open). */
async function assertNotLimited(bucket: string): Promise<void> {
  let status;
  try {
    status = await getRateLimitStatus(bucket);
  } catch (error) {
    console.error('[identity] attempt counter unavailable', error instanceof Error ? error.name : typeof error);
    return;
  }
  if (status.limited) throw new TooManyAttemptsError(status.retryAfterSeconds);
}

async function recordFailure(bucket: string): Promise<void> {
  try {
    await recordFailedLookup(bucket);
  } catch (error) {
    console.error('[identity] attempt counter unavailable', error instanceof Error ? error.name : typeof error);
  }
}

/**
 * Runs `attempt` with the anonymous cart; when the platform refuses because of that cart (gone, not
 * anonymous, wrong owner) runs it once more without, so a stale session cart never blocks sign-in.
 */
async function withAnonymousCart<T>(anonymousCartId: string | undefined, attempt: (cart?: { id: string; typeId: 'cart' }) => Promise<T>, isCredentialProblem: (e: unknown) => boolean): Promise<T> {
  if (!anonymousCartId) return attempt();
  try {
    return await attempt({ id: anonymousCartId, typeId: 'cart' });
  } catch (error) {
    const status = statusOf(error);
    if (isCredentialProblem(error) || !(status === 400 || status === 404 || status === 409)) throw error;
    return attempt();
  }
}

// ---------------------------------------------------------------------------------------------
// sign-in

export interface LoginInput {
  email: string;
  password: string;
  /** Session cart of the anonymous visitor; merged into the customer's cart (the platform's merge rules). */
  anonymousCartId?: string;
  /** Client address (or any stable client hint) for the attempt bucket. */
  clientKey?: string;
}

/**
 * `POST /login` with `anonymousCart`: the anonymous cart is merged into the customer's most recently modified
 * active cart (or becomes it), nothing is dropped. Unknown email and wrong password are the same error and the
 * same throttle bucket (email + client), so neither the message nor the lockout reveals which addresses exist.
 */
export async function login(input: LoginInput): Promise<SignInOutcome> {
  const email = normalizeEmail(input.email);
  const bucket = attemptBucket('login', email, input.clientKey ?? '');
  await assertNotLimited(bucket);
  const isInvalid = (e: unknown) => hasCode(e, 'InvalidCredentials');
  try {
    const { body } = await withAnonymousCart(
      input.anonymousCartId,
      (cart) =>
        apiRoot
          .login()
          .post({
            body: {
              email,
              password: input.password,
              ...(cart ? { anonymousCart: cart, anonymousCartSignInMode: 'MergeWithExistingCustomerCart' as const } : {}),
              updateProductData: false,
            },
          })
          .execute(),
      isInvalid,
    );
    return { user: toUser(body.customer), cartId: body.cart?.id };
  } catch (error) {
    if (isInvalid(error)) {
      await recordFailure(bucket);
      throw new InvalidCredentialsError();
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------
// registration

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  anonymousCartId?: string;
  clientKey?: string;
}

/**
 * Creates the customer (full name, email, password, `custom.patientRef`; no funding scheme) and verifies the
 * address straight away through the email-token flow (D-029: no email provider). The customer is active at once;
 * there is no seller activation step. A duplicate address raises EmailUnavailableError, counted per client so the
 * endpoint cannot be used to enumerate accounts.
 */
export async function register(input: RegisterInput): Promise<SignInOutcome & { emailVerified: boolean }> {
  const problems = validateRegistration(input);
  if (Object.keys(problems).length > 0) throw new ValidationError(problems);
  const email = normalizeEmail(input.email);
  const bucket = attemptBucket('register', input.clientKey || email);
  await assertNotLimited(bucket);
  const isDuplicate = (e: unknown) => hasCode(e, 'DuplicateField');
  let created;
  try {
    created = await withAnonymousCart(
      input.anonymousCartId,
      (cart) =>
        apiRoot
          .customers()
          .post({
            body: {
              email,
              password: input.password,
              ...splitFullName(input.name),
              ...(cart ? { anonymousCart: cart } : {}),
              custom: { type: { typeId: 'type', key: PATIENT_TYPE_KEY }, fields: { patientRef: newPatientRef() } },
            },
          })
          .execute(),
      isDuplicate,
    );
  } catch (error) {
    if (isDuplicate(error)) {
      await recordFailure(bucket);
      throw new EmailUnavailableError();
    }
    throw error;
  }
  let customer = created.body.customer;
  try {
    const token = await issueEmailToken(customer.id, EMAIL_TOKEN_TTL_MINUTES);
    const { body } = await apiRoot.customers().emailConfirm().post({ body: { tokenValue: token } }).execute();
    customer = body;
  } catch (error) {
    // The account exists and works; only the verified flag is missing. Not fatal for the visitor.
    console.error('[identity] automatic email verification failed', error instanceof Error ? error.name : typeof error, statusOf(error) ?? '');
  }
  return { user: toUser(customer), cartId: created.body.cart?.id, emailVerified: customer.isEmailVerified };
}

// ---------------------------------------------------------------------------------------------
// email verification (used by registration; the resend, expired and opened-twice paths have no UI in the demo)

/** Issues a verification token for an identified customer. The token must reach the customer only through a delivery channel, never in an API response. */
export async function issueEmailToken(customerId: string, ttlMinutes: number = EMAIL_TOKEN_TTL_MINUTES): Promise<string> {
  const { body } = await apiRoot.customers().emailToken().post({ body: { id: customerId, ttlMinutes } }).execute();
  return body.value;
}

export type EmailConfirmation = { status: 'verified' | 'already-verified' | 'expired'; customerId?: string };

/**
 * Confirms an address from a verification link.
 *  - valid token: verified;
 *  - the account is already verified (link opened twice): `already-verified`, not a token error;
 *  - invalid or expired token: `expired`, never retried silently. If the visitor's session customer is verified
 *    already, a used link also answers `already-verified`.
 */
export async function confirmEmail(tokenValue: string, sessionCustomerId?: string): Promise<EmailConfirmation> {
  const dead = async (): Promise<EmailConfirmation> => {
    if (sessionCustomerId) {
      const me = await getCustomerById(sessionCustomerId);
      if (me?.isEmailVerified) return { status: 'already-verified', customerId: me.id };
    }
    return { status: 'expired' };
  };
  let customer: Customer;
  try {
    customer = (await apiRoot.customers().withEmailToken({ emailToken: tokenValue }).get().execute()).body;
  } catch (error) {
    if (statusOf(error) === 400 || statusOf(error) === 404) return dead();
    throw error;
  }
  if (customer.isEmailVerified) return { status: 'already-verified', customerId: customer.id };
  try {
    await apiRoot.customers().emailConfirm().post({ body: { tokenValue } }).execute();
  } catch (error) {
    if (statusOf(error) === 400 || statusOf(error) === 404) return dead();
    throw error;
  }
  return { status: 'verified', customerId: customer.id };
}

export type VerificationResend =
  | { status: 'sign-in-required' }
  | { status: 'already-verified' }
  | { status: 'issued'; tokenValue: string; ttlMinutes: number };

/**
 * A fresh token can only be requested for an account the storefront can identify (the endpoint takes a customer
 * id, not an email). Without a signed-in customer the visitor is asked to sign in first.
 */
export async function requestFreshVerification(customerId: string | undefined): Promise<VerificationResend> {
  if (!customerId) return { status: 'sign-in-required' };
  const me = await getCustomerById(customerId);
  if (!me) return { status: 'sign-in-required' };
  if (me.isEmailVerified) return { status: 'already-verified' };
  return { status: 'issued', tokenValue: await issueEmailToken(customerId), ttlMinutes: EMAIL_TOKEN_TTL_MINUTES };
}

// ---------------------------------------------------------------------------------------------
// account

/** One customer by id (never cached: per patient); null when it no longer exists. */
export async function getCustomerById(customerId: string): Promise<IdentityUser | null> {
  try {
    const { body } = await ((await loadDevRoot()) ?? apiRoot).customers().withId({ ID: customerId }).get().execute();
    return toUser(body);
  } catch (error) {
    if (statusOf(error) === 404) return null;
    throw error;
  }
}

/** Signed-in password change: the current password must match (a wrong one is counted per customer). */
export async function changePassword(customerId: string, currentPassword: string, newPassword: string): Promise<void> {
  const problem = checkPassword(newPassword);
  if (problem) throw new ValidationError({ password: problem });
  const bucket = attemptBucket('password', customerId);
  await assertNotLimited(bucket);
  const { body: customer } = await apiRoot.customers().withId({ ID: customerId }).get().execute();
  try {
    await apiRoot.customers().password().post({ body: { id: customerId, version: customer.version, currentPassword, newPassword } }).execute();
  } catch (error) {
    if (hasCode(error, 'InvalidCurrentPassword')) {
      await recordFailure(bucket);
      throw new WrongCurrentPasswordError();
    }
    throw error;
  }
}

/** Sign-out: the session cookie is the only server-side state (customer tokens are never kept), so clearing it is all. */
export async function logout(): Promise<void> {
  await clearCustomer();
}
