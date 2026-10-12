// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({ post: vi.fn(), customersLogin: vi.fn() }));

vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    login: () => ({ post: (args: unknown) => ({ execute: () => sdk.post(args) }) }),
    customers: () => ({ login: sdk.customersLogin }),
  },
}));

beforeEach(() => {
  sdk.post.mockReset();
  sdk.customersLogin.mockReset();
});

describe('Sign-in', () => {
  it('Signs in through the login endpoint and returns ids only', async () => {
    sdk.post.mockResolvedValue({
      body: { customer: { id: 'c1', email: 'a@example.com', firstName: 'A', customerGroup: { id: 'g1' }, customerGroupAssignments: [{ customerGroup: { id: 'g2' } }, { customerGroup: { id: 'g1' } }] } },
    });
    const { loginCustomer } = await import('./auth');
    const result = await loginCustomer('a@example.com', 'pw-1234567890');
    expect(result).toEqual({ customerId: 'c1', accountGroupIds: ['g1', 'g2'] });
    expect(sdk.post).toHaveBeenCalledWith({ body: { email: 'a@example.com', password: 'pw-1234567890', updateProductData: false } });
    expect(sdk.customersLogin).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('pw-1234567890');
  });

  it('A customer without groups has an empty list', async () => {
    sdk.post.mockResolvedValue({ body: { customer: { id: 'c2' } } });
    const { loginCustomer } = await import('./auth');
    expect(await loginCustomer('b@example.com', 'x')).toEqual({ customerId: 'c2', accountGroupIds: [] });
  });

  it('Wrong password and unknown email give the same error', async () => {
    sdk.post.mockRejectedValue({ statusCode: 400, body: { errors: [{ code: 'InvalidCredentials', message: 'Account with the given credentials not found.' }] } });
    const { loginCustomer, AuthError } = await import('./auth');
    const failure = await loginCustomer('nobody@example.com', 'x').catch((e) => e);
    expect(failure).toBeInstanceOf(AuthError);
    expect(failure.code).toBe('INVALID_CREDENTIALS');
    expect(failure.message).toBe('INVALID_CREDENTIALS');
  });

  it('Other failures propagate', async () => {
    sdk.post.mockRejectedValue({ statusCode: 503 });
    const { loginCustomer } = await import('./auth');
    await expect(loginCustomer('a@example.com', 'x')).rejects.toMatchObject({ statusCode: 503 });
    sdk.post.mockRejectedValue({ statusCode: 400, body: { errors: [{ code: 'InvalidInput' }] } });
    await expect(loginCustomer('a@example.com', 'x')).rejects.toMatchObject({ statusCode: 400 });
  });
});
