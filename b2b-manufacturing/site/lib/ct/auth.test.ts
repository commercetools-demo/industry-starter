// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();
vi.mock('./client', () => ({ apiRoot: { login: () => ({ post: (a: unknown) => ({ execute: () => post(a) }) }) } }));
const { loginCustomer } = await import('./auth');
beforeEach(() => post.mockReset());

describe('malva-client-portal › Client sign-in', () => {
  it('uses the login endpoint and merges the anonymous cart', async () => {
    post.mockResolvedValue({ body: { customer: { id: 'c' }, cart: { id: 'k' } } });
    const r = await loginCustomer('a@b.co', 'pw', 'anon');
    expect(r).toEqual({ customer: { id: 'c' }, cart: { id: 'k' } });
    expect(post.mock.calls[0]![0].body).toMatchObject({ anonymousCart: { typeId: 'cart', id: 'anon' }, anonymousCartSignInMode: 'MergeWithExistingCustomerCart' });
  });
  it('omits cart merge arguments without an anonymous cart', async () => {
    post.mockResolvedValue({ body: { customer: { id: 'c' } } });
    await loginCustomer('a@b.co', 'pw');
    expect(post.mock.calls[0]![0].body.anonymousCart).toBeUndefined();
  });
  it('Wrong credentials: null for 400, rethrow other failures', async () => {
    post.mockRejectedValueOnce({ statusCode: 400 });
    expect(await loginCustomer('a@b.co', 'bad')).toBeNull();
    post.mockRejectedValueOnce({ statusCode: 500 });
    await expect(loginCustomer('a@b.co', 'x')).rejects.toBeDefined();
  });
  it('never calls customers().login()', async () => {
    const src = (await import('node:fs')).readFileSync('lib/ct/auth.ts', 'utf8');
    expect(src).not.toMatch(/customers\(\)\s*\.\s*login/);
  });
});
