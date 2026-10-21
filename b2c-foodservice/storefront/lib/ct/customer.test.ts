// @vitest-environment node
import type { Customer } from '@commercetools/platform-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), password: vi.fn(), login: vi.fn(), del: vi.fn() }));
vi.mock('@/lib/env', () => ({ getEnv: () => ({}) }));
vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    login: () => ({ post: (a: unknown) => ({ execute: () => sdk.login(a) }) }),
    customers: () => ({
      withId: () => ({
        get: () => ({ execute: () => sdk.get() }),
        post: (a: unknown) => ({ execute: () => sdk.post(a) }),
        delete: (a: unknown) => ({ execute: () => sdk.del(a) }),
      }),
      password: () => ({ post: (a: unknown) => ({ execute: () => sdk.password(a) }) }),
    }),
  },
}));

import { WrongPasswordError, changePassword, deleteCustomerAccount, getProfile, isInvalidCurrentPassword, updateProfile } from '@/lib/ct/customer';

const addr = (id: string, phone?: string) => ({ id, key: `k-${id}`, country: 'US', firstName: 'Maya', lastName: 'O', streetName: '1 Main St', city: 'NYC', postalCode: '10012', ...(phone ? { phone } : {}) });
const customer = (over: Record<string, unknown> = {}): Customer =>
  ({ id: 'c1', version: 4, email: 'maya@example.com', firstName: 'Maya', lastName: 'Okonkwo', addresses: [addr('a1', '+1 555 0100'), addr('a2')], defaultShippingAddressId: 'a1', ...over }) as unknown as Customer;
const actions = () => sdk.post.mock.calls.at(-1)?.[0].body.actions;

beforeEach(() => {
  for (const f of Object.values(sdk)) f.mockReset();
  sdk.get.mockResolvedValue({ body: customer() });
  sdk.post.mockImplementation(async () => ({ body: customer() }));
  sdk.password.mockResolvedValue({ body: customer() });
});

describe('profile', () => {
  it('reads the phone of the default shipping address, not of the customer', async () => {
    expect(await getProfile('c1')).toEqual({
      firstName: 'Maya', lastName: 'Okonkwo', email: 'maya@example.com', phone: '+1 555 0100', defaultShippingAddressId: 'a1',
    });
  });

  it('Profile saves names with the right actions (and only those that changed)', async () => {
    await updateProfile('c1', { firstName: 'Mia', lastName: 'Okonkwo' });
    expect(actions()).toEqual([{ action: 'setFirstName', firstName: 'Mia' }]);
    await updateProfile('c1', { firstName: 'Mia', lastName: 'Obi' });
    expect(actions()).toEqual([{ action: 'setFirstName', firstName: 'Mia' }, { action: 'setLastName', lastName: 'Obi' }]);
  });

  it('nothing changed means no write', async () => {
    await updateProfile('c1', { firstName: 'Maya', phone: '+1 555 0100' });
    expect(sdk.post).not.toHaveBeenCalled();
  });

  it('Email is read-only: there is no changeEmail action in any update', async () => {
    await updateProfile('c1', { firstName: 'A', lastName: 'B', phone: '+1 555 0199', defaultShippingAddressId: 'a2' });
    expect(JSON.stringify(sdk.post.mock.calls)).not.toContain('changeEmail');
  });

  it('Phone edits the default address (changeAddress on its id, other fields kept)', async () => {
    await updateProfile('c1', { phone: '+1 555 0199' });
    expect(actions()).toEqual([
      { action: 'changeAddress', addressId: 'a1', address: expect.objectContaining({ key: 'k-a1', streetName: '1 Main St', phone: '+1 555 0199' }) },
    ]);
    expect(actions()[0].address).not.toHaveProperty('id');
  });

  it('an empty phone clears the number', async () => {
    await updateProfile('c1', { phone: '' });
    expect(actions()[0].address.phone).toBeUndefined();
  });

  it('a new default address takes the phone, in one update', async () => {
    await updateProfile('c1', { defaultShippingAddressId: 'a2', phone: '+1 555 0111' });
    expect(actions()).toEqual([
      { action: 'setDefaultShippingAddress', addressId: 'a2' },
      { action: 'changeAddress', addressId: 'a2', address: expect.objectContaining({ phone: '+1 555 0111' }) },
    ]);
  });

  it('Phone disabled with no address: a phone without an address is refused and nothing is written', async () => {
    sdk.get.mockResolvedValue({ body: customer({ addresses: [], defaultShippingAddressId: undefined }) });
    await expect(updateProfile('c1', { phone: '+1 555 0199' })).rejects.toMatchObject({ code: 'validation_failed', status: 422 });
    expect(sdk.post).not.toHaveBeenCalled();
  });

  it("someone else's address cannot become the default", async () => {
    await expect(updateProfile('c1', { defaultShippingAddressId: 'foreign' })).rejects.toMatchObject({ status: 404 });
  });
});

describe('password', () => {
  it('sends the id, the latest version and both passwords', async () => {
    await changePassword('c1', 'old-pass-1', 'new-pass-22');
    expect(sdk.password).toHaveBeenCalledWith({ body: { id: 'c1', version: 4, currentPassword: 'old-pass-1', newPassword: 'new-pass-22' } });
  });

  it('recognises commercetools InvalidCurrentPassword', () => {
    expect(isInvalidCurrentPassword({ statusCode: 400, body: { errors: [{ code: 'InvalidCurrentPassword' }] } })).toBe(true);
    expect(isInvalidCurrentPassword({ statusCode: 400, body: { errors: [{ code: 'InvalidField' }] } })).toBe(false);
    expect(isInvalidCurrentPassword(new Error('x'))).toBe(false);
  });
});

describe('deleteCustomerAccount', () => {
  it('Delete account: re-verifies the password at login (no cart fields), then deletes with dataErasure false', async () => {
    sdk.login.mockResolvedValue({ body: {} });
    sdk.del.mockResolvedValue({ body: {} });
    await deleteCustomerAccount('c1', 'right-pass-1');
    expect(sdk.login).toHaveBeenCalledWith({ body: { email: 'maya@example.com', password: 'right-pass-1' } });
    expect(sdk.del).toHaveBeenCalledWith({ queryArgs: { version: 4, dataErasure: false } });
  });

  it('a wrong password deletes nothing', async () => {
    sdk.login.mockRejectedValue({ statusCode: 400 });
    await expect(deleteCustomerAccount('c1', 'nope')).rejects.toBeInstanceOf(WrongPasswordError);
    expect(sdk.del).not.toHaveBeenCalled();
  });

  it('another login failure is not mistaken for a wrong password', async () => {
    sdk.login.mockRejectedValue({ statusCode: 503 });
    await expect(deleteCustomerAccount('c1', 'x')).rejects.toMatchObject({ statusCode: 503 });
    expect(sdk.del).not.toHaveBeenCalled();
  });
});
