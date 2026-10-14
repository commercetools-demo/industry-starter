// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const exec = <T,>(value: T) => ({ execute: async () => ({ body: value }) });
  return {
    customerPost: vi.fn(),
    customerGet: vi.fn(),
    customerUpdate: vi.fn(),
    tokenPost: vi.fn(),
    resetPost: vi.fn(),
    passwordPost: vi.fn(),
    loginPost: vi.fn(),
    exec,
    createStoreCustomer: vi.fn(),
    loginCustomer: vi.fn(),
    cancelAll: vi.fn(),
  };
});
const wrap = (fn: (arg: unknown) => unknown) => (arg: unknown) => ({ execute: async () => ({ body: await fn(arg) }) });

vi.mock('@/lib/ct/in-store', () => ({
  inStore: () => ({
    customers: () => ({
      post: wrap(h.customerPost),
      passwordToken: () => ({ post: wrap(h.tokenPost) }),
      passwordReset: () => ({ post: wrap(h.resetPost) }),
      password: () => ({ post: wrap(h.passwordPost) }),
      withId: () => ({ get: wrap(h.customerGet), post: wrap(h.customerUpdate) }),
    }),
    login: () => ({ post: wrap(h.loginPost) }),
  }),
}));
vi.mock('@/lib/ct/customers', () => ({
  createStoreCustomer: h.createStoreCustomer,
  CUSTOMER_TYPE_KEY: 'malva-customer',
  DuplicateCustomerError: class DuplicateCustomerError extends Error {},
}));
vi.mock('@/lib/auth/login', () => ({ loginCustomer: h.loginCustomer }));
vi.mock('@/lib/ct/account-subscriptions', () => ({ cancelAllSubscriptions: h.cancelAll }));
vi.mock('@/lib/ct/vehicles', () => ({ GARAGE_FIELD: 'garage' }));

import { DuplicateCustomerError } from '@/lib/ct/customers';
import { anonymiseCustomer, changeEmail, changePassword, getProfile, registerCustomer, requestPasswordResetToken, resetPassword, updateProfile, verifyPassword } from './account-customer';

const ID = '11111111-1111-4111-8111-111111111111';
const customer = (over: Record<string, unknown> = {}) => ({
  id: ID,
  version: 3,
  email: 'anna@example.com',
  firstName: 'Anna',
  lastName: 'Schneider',
  addresses: [{ id: 'a1', country: 'DE' }, { id: 'a2', country: 'DE' }],
  custom: { type: { typeId: 'type', id: 't' }, fields: { mobile: '+49 1', marketingConsent: false, garage: '{}' } },
  ...over,
});
const ctError = (statusCode: number, code: string) => Object.assign(new Error('ct'), { statusCode, body: { errors: [{ code }] } });

beforeEach(() => {
  for (const key of ['customerPost', 'customerGet', 'customerUpdate', 'tokenPost', 'resetPost', 'passwordPost', 'loginPost', 'createStoreCustomer', 'loginCustomer', 'cancelAll'] as const) h[key].mockReset();
  h.customerGet.mockResolvedValue(customer());
  h.customerUpdate.mockResolvedValue(customer());
  h.createStoreCustomer.mockResolvedValue({ id: ID });
  h.loginCustomer.mockResolvedValue({ customer: { id: ID }, count: 2 });
});

const lastActions = () => (h.customerUpdate.mock.calls.at(-1)?.[0] as { body: { version: number; actions: Array<Record<string, unknown>> } }).body.actions;

describe('register', () => {
  it('creates the customer in the store, then signs in with the cart merge', async () => {
    const result = await registerCustomer('mau-reseller-north', { email: 'a@example.com', password: 'correct horse battery', firstName: 'A', lastName: 'B', marketingConsent: false });
    expect(h.createStoreCustomer).toHaveBeenCalledWith('mau-reseller-north', expect.objectContaining({ email: 'a@example.com', firstName: 'A' }));
    expect(h.loginCustomer).toHaveBeenCalledWith({ storeKey: 'mau-reseller-north', email: 'a@example.com', password: 'correct horse battery' });
    expect(result.count).toBe(2);
  });
  it('consent unchecked writes false and no date', async () => {
    await registerCustomer('s1', { email: 'a@example.com', password: 'correct horse battery', marketingConsent: false });
    expect(h.createStoreCustomer.mock.calls[0][1].customFields).toEqual({ marketingConsent: false });
  });
  it('consent checked writes date', async () => {
    await registerCustomer('s1', { email: 'a@example.com', password: 'correct horse battery', marketingConsent: true });
    const fields = h.createStoreCustomer.mock.calls[0][1].customFields;
    expect(fields.marketingConsent).toBe(true);
    expect(typeof fields.marketingConsentAt).toBe('string');
  });
  it('duplicate email creates nothing and gives the generic message', async () => {
    h.createStoreCustomer.mockRejectedValue(new DuplicateCustomerError());
    await expect(registerCustomer('s1', { email: 'a@example.com', password: 'correct horse battery', marketingConsent: false })).rejects.toMatchObject({ code: 'register-failed' });
    expect(h.loginCustomer).not.toHaveBeenCalled();
  });
  it('weak password names the rule', async () => {
    await expect(registerCustomer('s1', { email: 'a@example.com', password: 'short', marketingConsent: false })).rejects.toMatchObject({ code: 'weak-password', detail: 'too-short' });
    await expect(registerCustomer('s1', { email: 'a@example.com', password: 'password123', marketingConsent: false })).rejects.toMatchObject({ detail: 'too-common' });
    expect(h.createStoreCustomer).not.toHaveBeenCalled();
  });
});

describe('password reset', () => {
  it('asks the in-store token endpoint with ttl 30 and returns the token', async () => {
    h.tokenPost.mockResolvedValue({ value: 'tok-value' });
    await expect(requestPasswordResetToken('s1', 'a@example.com')).resolves.toBe('tok-value');
    expect(h.tokenPost).toHaveBeenCalledWith({ body: { email: 'a@example.com', ttlMinutes: 30 } });
  });
  it('an unknown email gives null', async () => {
    h.tokenPost.mockRejectedValue(ctError(404, 'ResourceNotFound'));
    await expect(requestPasswordResetToken('s1', 'nobody@example.com')).resolves.toBeNull();
  });
  it('an outage is not hidden', async () => {
    h.tokenPost.mockRejectedValue(ctError(500, 'x'));
    await expect(requestPasswordResetToken('s1', 'a@example.com')).rejects.toBeDefined();
  });
  it('reset with a bad token gives the generic invalid-token error', async () => {
    h.resetPost.mockRejectedValue(ctError(400, 'InvalidSubject'));
    await expect(resetPassword('s1', 'a'.repeat(40), 'correct horse battery')).rejects.toMatchObject({ code: 'invalid-token' });
  });
  it('a malformed token never reaches commercetools', async () => {
    await expect(resetPassword('s1', '<x>', 'correct horse battery')).rejects.toMatchObject({ code: 'invalid-token' });
    expect(h.resetPost).not.toHaveBeenCalled();
  });
  it('reset weak password names rule', async () => {
    await expect(resetPassword('s1', 'a'.repeat(40), 'short')).rejects.toMatchObject({ code: 'weak-password', detail: 'too-short' });
    expect(h.resetPost).not.toHaveBeenCalled();
  });
  it('reset sends token and new password', async () => {
    h.resetPost.mockResolvedValue(customer());
    await resetPassword('s1', 'a'.repeat(40), 'correct horse battery');
    expect(h.resetPost).toHaveBeenCalledWith({ body: { tokenValue: 'a'.repeat(40), newPassword: 'correct horse battery' } });
  });
});

describe('profile and security', () => {
  it('profile update sets names and mobile', async () => {
    await updateProfile('s1', ID, { firstName: 'Anne', lastName: 'Schmidt', mobile: '+49 2' });
    expect(lastActions()).toEqual([
      { action: 'setFirstName', firstName: 'Anne' },
      { action: 'setLastName', lastName: 'Schmidt' },
      { action: 'setCustomField', name: 'mobile', value: '+49 2' },
    ]);
  });
  it('an empty mobile clears the field', async () => {
    await updateProfile('s1', ID, { mobile: '' });
    expect(lastActions()).toEqual([{ action: 'setCustomField', name: 'mobile' }]);
  });
  it('consent change writes date, unchanged consent writes nothing', async () => {
    await updateProfile('s1', ID, { marketingConsent: true });
    const actions = lastActions();
    expect(actions[0]).toEqual({ action: 'setCustomField', name: 'marketingConsent', value: true });
    expect(actions[1]).toMatchObject({ action: 'setCustomField', name: 'marketingConsentAt' });
    h.customerUpdate.mockClear();
    await updateProfile('s1', ID, { marketingConsent: false });
    expect(h.customerUpdate).not.toHaveBeenCalled();
  });
  it('consent off clears the date', async () => {
    h.customerGet.mockResolvedValue(customer({ custom: { type: { typeId: 'type', id: 't' }, fields: { marketingConsent: true, marketingConsentAt: '2026-01-01T00:00:00Z' } } }));
    await updateProfile('s1', ID, { marketingConsent: false });
    expect(lastActions()).toEqual([
      { action: 'setCustomField', name: 'marketingConsent', value: false },
      { action: 'setCustomField', name: 'marketingConsentAt' },
    ]);
  });
  it('a customer without the custom type gets it with the first field', async () => {
    h.customerGet.mockResolvedValue(customer({ custom: undefined }));
    await updateProfile('s1', ID, { mobile: '+49 3' });
    expect(lastActions()).toEqual([{ action: 'setCustomType', type: { typeId: 'type', key: 'malva-customer' }, fields: { mobile: '+49 3' } }]);
  });
  it('retries once on a version conflict', async () => {
    h.customerUpdate.mockRejectedValueOnce(ctError(409, 'ConcurrentModification')).mockResolvedValueOnce(customer());
    await updateProfile('s1', ID, { firstName: 'Anne' });
    expect(h.customerUpdate).toHaveBeenCalledTimes(2);
  });
  it('profile read maps to the account profile', async () => {
    await expect(getProfile('s1', ID)).resolves.toMatchObject({ email: 'anna@example.com', mobile: '+49 1', marketingConsent: false });
  });
  it('email change uses changeEmail after the password check', async () => {
    h.loginPost.mockResolvedValue({ customer: {} });
    await changeEmail('s1', ID, { newEmail: 'new@example.com', currentPassword: 'pw' });
    expect(h.loginPost).toHaveBeenCalledWith({ body: { email: 'anna@example.com', password: 'pw' } });
    expect(lastActions()).toEqual([{ action: 'changeEmail', email: 'new@example.com' }]);
  });
  it('email change with a wrong password changes nothing', async () => {
    h.loginPost.mockRejectedValue(ctError(400, 'InvalidCredentials'));
    await expect(changeEmail('s1', ID, { newEmail: 'new@example.com', currentPassword: 'bad' })).rejects.toMatchObject({ code: 'wrong-password' });
    expect(h.customerUpdate).not.toHaveBeenCalled();
  });
  it('email change rejected for taken email generically', async () => {
    h.loginPost.mockResolvedValue({});
    h.customerUpdate.mockRejectedValue(ctError(400, 'DuplicateField'));
    await expect(changeEmail('s1', ID, { newEmail: 'taken@example.com', currentPassword: 'pw' })).rejects.toMatchObject({ code: 'email-update-failed' });
  });
  it('wrong current password gives one message', async () => {
    h.passwordPost.mockRejectedValue(ctError(400, 'InvalidCurrentPassword'));
    await expect(changePassword('s1', ID, { currentPassword: 'bad', newPassword: 'correct horse battery' })).rejects.toMatchObject({ code: 'wrong-password' });
  });
  it('weak new password names rule', async () => {
    await expect(changePassword('s1', ID, { currentPassword: 'pw', newPassword: '1234567890' })).rejects.toMatchObject({ code: 'weak-password', detail: 'too-common' });
    expect(h.passwordPost).not.toHaveBeenCalled();
  });
  it('change password posts id, version and both passwords', async () => {
    h.passwordPost.mockResolvedValue(customer());
    await changePassword('s1', ID, { currentPassword: 'pw', newPassword: 'correct horse battery' });
    expect(h.passwordPost).toHaveBeenCalledWith({ body: { id: ID, version: 3, currentPassword: 'pw', newPassword: 'correct horse battery' } });
  });
  it('verifyPassword is true for a good login and false for InvalidCredentials', async () => {
    h.loginPost.mockResolvedValueOnce({});
    await expect(verifyPassword('s1', 'a@example.com', 'pw')).resolves.toBe(true);
    h.loginPost.mockRejectedValueOnce(ctError(400, 'InvalidCredentials'));
    await expect(verifyPassword('s1', 'a@example.com', 'x')).resolves.toBe(false);
  });
});

describe('delete account (anonymise)', () => {
  it('anonymise requires the current password', async () => {
    h.loginPost.mockRejectedValue(ctError(400, 'InvalidCredentials'));
    await expect(anonymiseCustomer('s1', ID, 'bad')).rejects.toMatchObject({ code: 'wrong-password' });
    expect(h.customerUpdate).not.toHaveBeenCalled();
    expect(h.cancelAll).not.toHaveBeenCalled();
  });
  it('anonymise removes addresses, email, names and custom fields, locks the credentials and cancels subscriptions', async () => {
    h.loginPost.mockResolvedValue({});
    h.tokenPost.mockResolvedValue({ value: 'lock-token' });
    h.resetPost.mockResolvedValue(customer());
    await anonymiseCustomer('s1', ID, 'pw');
    expect(h.cancelAll).toHaveBeenCalledWith('s1', ID);
    const reset = h.resetPost.mock.calls[0][0] as { body: { tokenValue: string; newPassword: string } };
    expect(reset.body.tokenValue).toBe('lock-token');
    expect(reset.body.newPassword).toHaveLength(64);
    const actions = lastActions();
    expect(actions.find((a) => a.action === 'changeEmail')).toMatchObject({ email: expect.stringMatching(/^deleted\+[a-z0-9]{8}@deleted\.invalid$/) });
    expect(actions.filter((a) => a.action === 'removeAddress').map((a) => a.addressId)).toEqual(['a1', 'a2']);
    expect(actions.some((a) => a.action === 'setFirstName')).toBe(true);
    expect(actions).toContainEqual({ action: 'setCustomType' });
  });
  it('anonymise keeps orders untouched (no order calls exist in the module)', async () => {
    const source = await import('node:fs').then((fs) => fs.readFileSync('lib/ct/account-customer.ts', 'utf8'));
    expect(source).not.toMatch(/orders\(\)/);
  });
});
