// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The shopper's own account in the store scope (workstream Q-03, Q-04, Q-11): register, profile, email, password, reset, delete (anonymise).
// Every call goes through `/in-store/key=<store>/customers`, so a customer of another reseller is never found. `customerId` always comes from
// the session. No email is sent by anything here (owner answer Q-P01).
import 'server-only';
import type { Customer, CustomerUpdateAction } from '@commercetools/platform-sdk';
import { AccountError, errorCodes, statusOf } from '@/lib/account/errors';
import { loginCustomer, type LoginResult } from '@/lib/auth/login';
import { checkPassword } from '@/lib/auth/password-policy';
import { isPlausibleToken } from '@/lib/auth/demo-reset';
import { cancelAllSubscriptions } from '@/lib/ct/account-subscriptions';
import { createStoreCustomer, CUSTOMER_TYPE_KEY, DuplicateCustomerError } from '@/lib/ct/customers';
import { inStore } from '@/lib/ct/in-store';
import { mapProfile } from '@/lib/mappers/account';
import type { AccountProfile } from '@/lib/types';

const customers = (storeKey: string) => inStore(storeKey).customers();

async function readCustomer(storeKey: string, customerId: string): Promise<Customer> {
  try {
    const { body } = await customers(storeKey).withId({ ID: customerId }).get().execute();
    return body;
  } catch (error) {
    if (statusOf(error) === 404) throw new AccountError('not-found', 404);
    throw error;
  }
}

/** Read, build the actions from the current customer, write; one retry on a version conflict. No write for an empty action list. */
async function updateCustomer(storeKey: string, customerId: string, build: (customer: Customer) => CustomerUpdateAction[]): Promise<Customer> {
  for (let attempt = 0; ; attempt += 1) {
    const current = await readCustomer(storeKey, customerId);
    const actions = build(current);
    if (actions.length === 0) return current;
    try {
      const { body } = await customers(storeKey).withId({ ID: customerId }).post({ body: { version: current.version, actions } }).execute();
      return body;
    } catch (error) {
      if (statusOf(error) !== 409 || attempt >= 1) throw error;
    }
  }
}

function assertPassword(password: string): void {
  const check = checkPassword(password);
  if (!check.ok) throw new AccountError('weak-password', 400, check.rule);
}

/** `setCustomField` for each field (an `undefined` value clears it); the first write on a customer without the type sets the type. */
function customFieldActions(customer: Customer, fields: Record<string, unknown>): CustomerUpdateAction[] {
  const entries = Object.entries(fields);
  if (entries.length === 0) return [];
  if (!customer.custom) {
    const defined = Object.fromEntries(entries.filter(([, value]) => value !== undefined));
    return Object.keys(defined).length ? [{ action: 'setCustomType', type: { typeId: 'type', key: CUSTOMER_TYPE_KEY }, fields: defined }] : [];
  }
  return entries.map(([name, value]) => ({ action: 'setCustomField', name, ...(value === undefined ? {} : { value }) }));
}

// ---- Register -------------------------------------------------------------------------------------------------------------------

export interface RegisterInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  marketingConsent: boolean;
}

/**
 * Creates the customer in the store, with the consent the shopper chose (an unchecked box writes `false` and no date), then signs in through
 * the normal login (anonymous cart merge, sign-in hooks, session). A duplicate email in this store answers the same generic refusal as any other
 * failure to create (nothing is created, nothing says the email exists).
 */
export async function registerCustomer(storeKey: string, input: RegisterInput): Promise<LoginResult> {
  assertPassword(input.password);
  try {
    await createStoreCustomer(storeKey, {
      email: input.email,
      password: input.password,
      ...(input.firstName ? { firstName: input.firstName } : {}),
      ...(input.lastName ? { lastName: input.lastName } : {}),
      customFields: input.marketingConsent ? { marketingConsent: true, marketingConsentAt: new Date().toISOString() } : { marketingConsent: false },
    });
  } catch (error) {
    if (error instanceof DuplicateCustomerError) throw new AccountError('register-failed');
    throw error;
  }
  return loginCustomer({ storeKey, email: input.email, password: input.password });
}

// ---- Password reset (on screen, D4) -----------------------------------------------------------------------------------------------

/** The reset token of the store's customer with this email (valid 30 minutes), or `null` when there is none. Never logged. */
export async function requestPasswordResetToken(storeKey: string, email: string): Promise<string | null> {
  try {
    const { body } = await customers(storeKey).passwordToken().post({ body: { email, ttlMinutes: 30 } }).execute();
    return body.value;
  } catch (error) {
    const status = statusOf(error);
    if (status === 404 || (status === 400 && errorCodes(error).some((c) => c === 'ResourceNotFound' || c === 'InvalidSubject'))) return null;
    throw error;
  }
}

/** An invalid, decoy or expired token is one generic `invalid-token` refusal. */
export async function resetPassword(storeKey: string, token: string, newPassword: string): Promise<void> {
  assertPassword(newPassword);
  if (!isPlausibleToken(token)) throw new AccountError('invalid-token');
  try {
    await customers(storeKey).passwordReset().post({ body: { tokenValue: token, newPassword } }).execute();
  } catch (error) {
    if (statusOf(error) === 400 || statusOf(error) === 404) throw new AccountError('invalid-token');
    throw error;
  }
}

// ---- Profile and security ---------------------------------------------------------------------------------------------------------

export async function getProfile(storeKey: string, customerId: string): Promise<AccountProfile> {
  return mapProfile(await readCustomer(storeKey, customerId));
}

export interface ProfileInput {
  firstName?: string;
  lastName?: string;
  /** Empty clears it. */
  mobile?: string;
  marketingConsent?: boolean;
}

export async function updateProfile(storeKey: string, customerId: string, input: ProfileInput): Promise<AccountProfile> {
  const updated = await updateCustomer(storeKey, customerId, (customer) => {
    const actions: CustomerUpdateAction[] = [];
    if (input.firstName !== undefined && input.firstName !== (customer.firstName ?? '')) actions.push({ action: 'setFirstName', firstName: input.firstName });
    if (input.lastName !== undefined && input.lastName !== (customer.lastName ?? '')) actions.push({ action: 'setLastName', lastName: input.lastName });
    const fields: Record<string, unknown> = {};
    const current = customer.custom?.fields ?? {};
    if (input.mobile !== undefined && input.mobile !== (typeof current.mobile === 'string' ? current.mobile : '')) fields.mobile = input.mobile === '' ? undefined : input.mobile;
    if (input.marketingConsent !== undefined && input.marketingConsent !== (current.marketingConsent === true)) {
      fields.marketingConsent = input.marketingConsent;
      fields.marketingConsentAt = input.marketingConsent ? new Date().toISOString() : undefined;
    }
    return [...actions, ...customFieldActions(customer, fields)];
  });
  return mapProfile(updated);
}

/** True when the store accepts this email and password. A failed login changes nothing (no cart is passed). */
export async function verifyPassword(storeKey: string, email: string, password: string): Promise<boolean> {
  try {
    await inStore(storeKey).login().post({ body: { email, password } }).execute();
    return true;
  } catch (error) {
    if (statusOf(error) === 400) return false;
    throw error;
  }
}

async function requirePassword(storeKey: string, customer: Customer, password: string): Promise<void> {
  if (!(await verifyPassword(storeKey, customer.email, password))) throw new AccountError('wrong-password');
}

export async function changeEmail(storeKey: string, customerId: string, input: { newEmail: string; currentPassword: string }): Promise<AccountProfile> {
  const customer = await readCustomer(storeKey, customerId);
  await requirePassword(storeKey, customer, input.currentPassword);
  try {
    const updated = await updateCustomer(storeKey, customerId, (c) => (c.email.toLowerCase() === input.newEmail.toLowerCase() ? [] : [{ action: 'changeEmail', email: input.newEmail }]));
    return mapProfile(updated);
  } catch (error) {
    // Taken emails and every other refusal read the same.
    if (statusOf(error) === 400) throw new AccountError('email-update-failed');
    throw error;
  }
}

export async function changePassword(storeKey: string, customerId: string, input: { currentPassword: string; newPassword: string }): Promise<void> {
  assertPassword(input.newPassword);
  for (let attempt = 0; ; attempt += 1) {
    const customer = await readCustomer(storeKey, customerId);
    try {
      await customers(storeKey).password().post({ body: { id: customerId, version: customer.version, currentPassword: input.currentPassword, newPassword: input.newPassword } }).execute();
      return;
    } catch (error) {
      const status = statusOf(error);
      if (status === 409 && attempt < 1) continue;
      if (status === 400) throw new AccountError('wrong-password');
      throw error;
    }
  }
}

// ---- Delete account (D11) ---------------------------------------------------------------------------------------------------------

const randomText = (bytes: number, encode: (b: Uint8Array) => string): string => encode(crypto.getRandomValues(new Uint8Array(bytes)));
const base64url = (b: Uint8Array): string => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * Anonymises the account after the password check: credentials are locked (password reset to a random 64 character value), recurring orders are
 * cancelled, then the email becomes `deleted+<8>@deleted.invalid`, names a placeholder, addresses are removed and the custom type (mobile,
 * consent, garage) is cleared. Orders are never touched: the reseller keeps them under its retention rules.
 */
export async function anonymiseCustomer(storeKey: string, customerId: string, currentPassword: string): Promise<void> {
  const customer = await readCustomer(storeKey, customerId);
  await requirePassword(storeKey, customer, currentPassword);
  const token = await requestPasswordResetToken(storeKey, customer.email);
  if (token) await customers(storeKey).passwordReset().post({ body: { tokenValue: token, newPassword: randomText(48, base64url) } }).execute();
  await cancelAllSubscriptions(storeKey, customerId);
  const suffix = randomText(8, (b) => [...b].map((x) => 'abcdefghijklmnopqrstuvwxyz0123456789'[x % 36]).join(''));
  await updateCustomer(storeKey, customerId, (c) => [
    { action: 'changeEmail', email: `deleted+${suffix}@deleted.invalid` },
    { action: 'setFirstName', firstName: 'Deleted' },
    { action: 'setLastName', lastName: 'Customer' },
    ...(c.addresses ?? []).flatMap((a): CustomerUpdateAction[] => (a.id ? [{ action: 'removeAddress', addressId: a.id }] : [])),
    ...(c.custom ? ([{ action: 'setCustomType' }] as CustomerUpdateAction[]) : []),
  ]);
}
