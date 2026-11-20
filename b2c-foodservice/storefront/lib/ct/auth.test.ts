import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  /** Mode of the guest cart, and of the customer's latest Active cart (null: the customer has none, 'fail': the lookup throws). */
  guestMode: 'Multiple' as string,
  latestMode: null as string | null | 'fail',
  loginPost: vi.fn(),
  customersPost: vi.fn(),
  inStore: vi.fn(),
}));
vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    login: () => ({ post: (a: unknown) => ({ execute: async () => ({ body: await h.loginPost(a) }) }) }),
    carts: () => ({
      get: () => ({
        execute: async () => {
          if (h.latestMode === 'fail') throw new Error('boom');
          return { body: { results: h.latestMode ? [{ shippingMode: h.latestMode }] : [] } };
        },
      }),
      withId: () => ({ get: () => ({ execute: async () => ({ body: { cartState: 'Active', shippingMode: h.guestMode } }) }) }),
    }),
    customers: () => ({
      get: () => ({ execute: async () => ({ body: { results: [{ id: 'c1' }] } }) }),
      post: (a: unknown) => ({ execute: async () => ({ body: await h.customersPost(a) }) }),
      withId: () => ({ get: () => ({ execute: async () => ({ body: { id: 'c1' } }) }) }),
    }),
    inStore: h.inStore,
  },
}));

import { createCustomer, signIn } from '@/lib/ct/auth';

beforeEach(() => {
  vi.clearAllMocks();
  h.guestMode = 'Multiple';
  h.latestMode = null;
  h.loginPost.mockResolvedValue({ customer: { id: 'c1' }, cart: { id: 'cart1', shippingMode: 'Multiple' } });
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

  it('merges into the customer\'s latest cart when it is Multiple', async () => {
    h.latestMode = 'Multiple';
    await signIn('a@example.com', 'pw', { cartId: 'g1' });
    expect(h.loginPost.mock.calls[0][0].body.anonymousCartSignInMode).toBe('MergeWithExistingCustomerCart');
  });

  it('uses the guest cart as the new cart when the customer\'s latest cart is an old Single one (never merged into it)', async () => {
    h.latestMode = 'Single';
    await signIn('a@example.com', 'pw', { cartId: 'g1' });
    expect(h.loginPost.mock.calls[0][0].body).toMatchObject({ anonymousCart: { id: 'g1' }, anonymousCartSignInMode: 'UseAsNewActiveCustomerCart' });
  });

  it('does not merge when the cart lookup fails', async () => {
    h.latestMode = 'fail';
    await signIn('a@example.com', 'pw', { cartId: 'g1' });
    expect(h.loginPost.mock.calls[0][0].body.anonymousCartSignInMode).toBe('UseAsNewActiveCustomerCart');
  });

  it('does not send a guest cart that is not Multiple', async () => {
    h.guestMode = 'Single';
    await signIn('a@example.com', 'pw', { cartId: 'g1', anonymousId: 'anon' });
    const body = h.loginPost.mock.calls[0][0].body;
    expect(body).not.toHaveProperty('anonymousCart');
    expect(body).not.toHaveProperty('anonymousCartSignInMode');
    expect(body.anonymousId).toBe('anon');
  });

  it('returns the cart of the result only when it is Multiple (an old Single customer cart means no bag)', async () => {
    expect((await signIn('a@example.com', 'pw')).cart).toMatchObject({ id: 'cart1' });
    h.loginPost.mockResolvedValue({ customer: { id: 'c1' }, cart: { id: 'old', shippingMode: 'Single' } });
    expect(await signIn('a@example.com', 'pw')).not.toHaveProperty('cart');
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
