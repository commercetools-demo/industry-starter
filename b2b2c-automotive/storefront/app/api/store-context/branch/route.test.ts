// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSessionSecret } from '@/lib/env';
import { signSession, verifySession } from '@/lib/session-core';
import type { Branch, ShellContext } from '@/lib/types';
import { makeRequest } from '@/test/request';

const jar = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.values.has(name) ? { name, value: jar.values.get(name) } : undefined),
    set: (name: string, value: string) => jar.values.set(name, value),
    delete: (name: string) => jar.values.delete(name),
  }),
}));

const rescope = vi.hoisted(() => vi.fn(async () => true));
vi.mock('@/lib/ct/cart', () => ({ rescopeCartToBranch: rescope, getCartSummary: vi.fn() }));
const getShellContext = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ct/shell', () => ({ getShellContext }));

import { POST } from './route';

const branch = (key: string, channelId: string): Branch => ({
  key,
  channelId,
  name: key,
  address: { street: 's', postalCode: '1', city: 'c' },
  hours: {},
  timezone: 'Europe/Berlin',
  pickupMode: 'same-day',
});
const ctx: ShellContext = {
  storeId: 's1',
  settings: { name: 'North', shipDays: { min: 2, max: 3 }, timezone: 'Europe/Berlin' },
  branches: [branch('mau-br-north-berlin', 'ch-berlin'), branch('mau-br-north-hamburg', 'ch-hamburg')],
  retailChannelId: 'ch-retail',
  countries: ['DE'],
};
const base = { storeKey: 'mau-reseller-north', distributionChannelId: 'd', supplyChannelId: 's', productSelectionId: 'p' };
const login = async (extra: Record<string, string> = {}) => jar.values.set('malva_session', await signSession({ ...base, ...extra }, getSessionSecret()));
const post = (body: unknown) => POST(makeRequest('/api/store-context/branch', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
const sessionNow = () => verifySession(jar.values.get('malva_session'), getSessionSecret());

beforeEach(() => {
  jar.values.clear();
  rescope.mockClear();
  getShellContext.mockReset();
  getShellContext.mockResolvedValue(ctx);
});

describe('Choosing: POST /api/store-context/branch', () => {
  it('sets branchKey', async () => {
    await login();
    const res = await post({ branchKey: 'mau-br-north-hamburg' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, cartRepriced: false });
    expect((await sessionNow()).branchKey).toBe('mau-br-north-hamburg');
  });
  it('rejects a branch of another store', async () => {
    await login();
    const res = await post({ branchKey: 'mau-br-south-munich' });
    expect(res.status).toBe(400);
    expect((await sessionNow()).branchKey).toBeUndefined();
  });
  it('rejects a malformed body', async () => {
    await login();
    expect((await post({ branchKey: 5 })).status).toBe(400);
    expect((await post({})).status).toBe(400);
  });
  it('unauthenticated anonymous session works', async () => {
    await login(); // an anonymous shopper has a store but no customerId
    expect((await post({ branchKey: 'mau-br-north-berlin' })).status).toBe(200);
  });
  it('without a store in the session the answer is 404', async () => {
    expect((await post({ branchKey: 'mau-br-north-berlin' })).status).toBe(404);
  });
  it('branch change with a cart re-scopes the cart', async () => {
    await login({ cartId: 'cart-1' });
    rescope.mockResolvedValueOnce(true);
    const res = await post({ branchKey: 'mau-br-north-hamburg' });
    expect(await res.json()).toEqual({ ok: true, cartRepriced: true });
    expect(rescope).toHaveBeenCalledWith('mau-reseller-north', 'cart-1', { branchKey: 'mau-br-north-hamburg', branchChannelId: 'ch-hamburg', retailChannelId: 'ch-retail' });
  });
  it('branch change without a cart does not call the cart layer', async () => {
    await login();
    await post({ branchKey: 'mau-br-north-hamburg' });
    expect(rescope).not.toHaveBeenCalled();
  });
  it('a failing cart re-scope still stores the branch', async () => {
    await login({ cartId: 'cart-1' });
    rescope.mockRejectedValueOnce(new Error('boom'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await post({ branchKey: 'mau-br-north-hamburg' });
    expect(await res.json()).toEqual({ ok: true, cartRepriced: false });
    expect((await sessionNow()).branchKey).toBe('mau-br-north-hamburg');
    error.mockRestore();
  });
});
