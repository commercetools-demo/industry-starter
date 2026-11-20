import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  loginPost: vi.fn(),
  customersPost: vi.fn(),
  inStore: vi.fn(),
}));
vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    login: () => ({ post: (a: unknown) => ({ execute: async () => ({ body: await h.loginPost(a) }) }) }),
    customers: () => ({
      post: (a: unknown) => ({ execute: async () => ({ body: await h.customersPost(a) }) }),
      withId: () => ({ get: () => ({ execute: async () => ({ body: { id: 'c1' } }) }) }),
    }),
    inStore: h.inStore,
  },
}));

import { createCustomer, signIn } from '@/lib/ct/auth';

beforeEach(() => {
  vi.clearAllMocks();
  h.loginPost.mockResolvedValue({ customer: { id: 'c1' }, cart: { id: 'cart1' } });
  h.customersPost.mockResolvedValue({ customer: { id: 'c1' } });
});

describe('lib/ct/auth', () => {
  it('signIn passes anonymousCart and the merge mode only when a guest cart exists', async () => {
    await signIn('a@example.com', 'pw', { cartId: 'g1', anonymousId: 'anon' });
    const withCart = h.loginPost.mock.calls[0][0].body;
    expect(withCart.anonymousCart).toEqual({ typeId: 'cart', id: 'g1' });
    expect(withCart.anonymousCartSignInMode).toBe('MergeWithExistingCustomerCart');
    expect(withCart.anonymousId).toBe('anon');
    await signIn('a@example.com', 'pw');
    const without = h.loginPost.mock.calls[1][0].body;
    expect(without).not.toHaveProperty('anonymousCart');
    expect(without).not.toHaveProperty('anonymousCartSignInMode');
    expect(without).not.toHaveProperty('anonymousId');
  });

  it('signIn never calls the in-store endpoint', async () => {
    await signIn('a@example.com', 'pw', { cartId: 'g1' });
    expect(h.inStore).not.toHaveBeenCalled();
  });

  it('createCustomer creates a verified customer then signIn is a two-step flow', async () => {
    const customer = await createCustomer({ email: 'a@example.com', password: 'pw', firstName: 'A', lastName: 'B', locale: 'en-US' });
    expect(customer.id).toBe('c1');
    expect(h.customersPost.mock.calls[0][0].body.isEmailVerified).toBe(true);
    expect(h.customersPost.mock.calls[0][0].body).not.toHaveProperty('anonymousCart');
    expect(h.loginPost).not.toHaveBeenCalled();
  });
});
