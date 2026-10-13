// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
// Spec "Account bound to a reseller" (workstream Q-02): the sign-in is the in-store LOGIN endpoint, so a customer of reseller A is unknown at B.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '@/test/request';

const state = vi.hoisted(() => ({ session: {} as Record<string, unknown>, storeKeys: [] as string[] }));
const loginPost = vi.hoisted(() => vi.fn());

vi.mock('@/lib/session', () => ({ getSession: async () => state.session, updateSession: async (patch: (s: Record<string, unknown>) => Record<string, unknown>) => (state.session = patch(state.session)) }));
vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    inStoreKeyWithStoreKeyValue: ({ storeKey }: { storeKey: string }) => {
      state.storeKeys.push(storeKey);
      return { login: () => ({ post: (args: unknown) => ({ execute: () => loginPost(args) }) }) };
    },
  },
  projectKey: 'p',
}));
vi.mock('@/lib/auth', () => ({ runSignInHooks: vi.fn() }));

const post = (email: string, ip: string) => makeRequest('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify({ email, password: 'pw' }) });
const invalid = () => Object.assign(new Error('x'), { statusCode: 400, body: { errors: [{ code: 'InvalidCredentials' }] } });

beforeEach(() => {
  vi.resetModules();
  loginPost.mockReset().mockRejectedValue(invalid());
  state.session = { storeKey: 'mau-reseller-south' };
  state.storeKeys = [];
});

describe('login is bound to the store', () => {
  it('customer of another store gets the generic message', async () => {
    const { POST } = await import('./login/route');
    const res = await POST(post('anna@example.com', '10.0.0.1'));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'invalid-credentials' });
    expect(state.storeKeys).toEqual(['mau-reseller-south']);
    expect(state.session.customerId).toBeUndefined();
  });
  it('message equals wrong-password message', async () => {
    const { POST } = await import('./login/route');
    const otherStore = await POST(post('anna@example.com', '10.0.0.2'));
    const wrongPassword = await POST(post('someone-else@example.com', '10.0.0.3'));
    expect(otherStore.status).toBe(wrongPassword.status);
    expect(await otherStore.text()).toBe(await wrongPassword.text());
  });
});
