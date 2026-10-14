// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const merge = vi.hoisted(() => vi.fn());
const readAnonymous = vi.hoisted(() => vi.fn());
const clearAnonymous = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ct/vehicles', () => ({ mergeGarageOnSignIn: merge }));
vi.mock('@/lib/vehicles/cookie', () => ({ readAnonymousGarage: readAnonymous, clearAnonymousGarage: clearAnonymous }));

import { clearSignInHooks, registerSignInHook, runSignInHooks } from './sign-in-hooks';

beforeEach(() => {
  clearSignInHooks();
  for (const m of [merge, readAnonymous, clearAnonymous]) m.mockReset();
});

describe('sign-in hooks', () => {
  it('runs hooks in registration order with the customer id', async () => {
    const order: string[] = [];
    registerSignInHook(() => void order.push('a'), 'a');
    registerSignInHook(async ({ customerId }) => void order.push(`b:${customerId}`), 'b');
    await runSignInHooks({ session: {}, customerId: 'c-1' });
    expect(order).toEqual(['a', 'b:c-1']);
  });
  it('a failing hook is logged and does not stop the others or fail sign-in', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const after = vi.fn();
    registerSignInHook(() => Promise.reject(new Error('boom with a@example.com')), 'bad');
    registerSignInHook(after, 'good');
    await expect(runSignInHooks({ session: {}, customerId: 'c-1' })).resolves.toBeUndefined();
    expect(after).toHaveBeenCalled();
    expect(spy.mock.calls.flat().join(' ')).not.toContain('a@example.com');
    spy.mockRestore();
  });
  it('registering the same name again replaces the hook', async () => {
    const first = vi.fn();
    const second = vi.fn();
    registerSignInHook(first, 'x');
    registerSignInHook(second, 'x');
    await runSignInHooks({ session: {}, customerId: 'c' });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe('garage merge hook (J contract)', () => {
  it('merges the cookie garage into the account garage and clears the cookie', async () => {
    const anonymous = { vehicles: [{ id: 'a' }], activeId: 'a' };
    readAnonymous.mockResolvedValue(anonymous);
    merge.mockResolvedValue({ vehicles: [], activeId: null });
    const { garageMergeHook } = await import('./garage-merge-hook');
    await garageMergeHook({ session: {}, customerId: 'c-1' });
    expect(merge).toHaveBeenCalledWith('c-1', anonymous);
    expect(clearAnonymous).toHaveBeenCalledTimes(1);
  });
  it('is registered when the auth root is imported', async () => {
    readAnonymous.mockResolvedValue({ vehicles: [], activeId: null });
    merge.mockResolvedValue({ vehicles: [], activeId: null });
    clearSignInHooks();
    vi.resetModules();
    const root = await import('./index');
    await root.runSignInHooks({ session: {}, customerId: 'c-9' });
    expect(merge).toHaveBeenCalledWith('c-9', { vehicles: [], activeId: null });
  });
  it('a failing garage merge does not fail sign-in', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    readAnonymous.mockResolvedValue({ vehicles: [], activeId: null });
    merge.mockRejectedValue({ statusCode: 500 });
    clearSignInHooks();
    vi.resetModules();
    const root = await import('./index');
    await expect(root.runSignInHooks({ session: {}, customerId: 'c' })).resolves.toBeUndefined();
  });
});
