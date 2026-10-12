// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSessionSecret } from '@/lib/env';
import { signSession } from '@/lib/session-core';
import type { Branch, ShellContext } from '@/lib/types';
import { makeRequest } from '@/test/request';

const jar = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (jar.values.has(name) ? { name, value: jar.values.get(name) } : undefined) }),
}));
const getShellContext = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ct/shell', () => ({ getShellContext }));

import { GET } from './route';

const branch = (key: string): Branch => ({
  key,
  channelId: `ch-${key}`,
  name: key,
  address: { street: 's', postalCode: '1', city: 'c' },
  hours: { mon: ['08:00', '19:00'] },
  timezone: 'Europe/Berlin',
  pickupMode: 'same-day',
});
const ctx = (keys: string[]): ShellContext => ({
  storeId: 's1',
  settings: { name: 'North', shipDays: { min: 2, max: 3 }, timezone: 'Europe/Berlin' },
  branches: keys.map(branch),
  retailChannelId: 'r',
  countries: ['DE'],
});
const base = { storeKey: 'mau-reseller-north', distributionChannelId: 'd', supplyChannelId: 's', productSelectionId: 'p' };
const login = async (extra: Record<string, string> = {}) => jar.values.set('malva_session', await signSession({ ...base, ...extra }, getSessionSecret()));

beforeEach(() => {
  jar.values.clear();
  getShellContext.mockReset();
});

describe('GET /api/store-context/branches', () => {
  it('without a chosen branch the first branch by key is selected', async () => {
    await login();
    getShellContext.mockResolvedValue(ctx(['mau-br-a', 'mau-br-b']));
    const body = await (await GET(makeRequest('/api/store-context/branches?locale=en-US'))).json();
    expect(body).toMatchObject({ single: false, selectedKey: 'mau-br-a', chosen: false });
    expect(body.branches).toHaveLength(2);
    expect(body.branches[0]).toMatchObject({ key: 'mau-br-a', hoursState: expect.any(Object), pickup: expect.any(String) });
    expect(getShellContext).toHaveBeenCalledWith('mau-reseller-north', 'en-US');
  });
  it('a chosen branch is reported as chosen', async () => {
    await login({ branchKey: 'mau-br-b' });
    getShellContext.mockResolvedValue(ctx(['mau-br-a', 'mau-br-b']));
    expect(await (await GET(makeRequest('/api/store-context/branches'))).json()).toMatchObject({ selectedKey: 'mau-br-b', chosen: true });
  });
  it('one branch is single', async () => {
    await login();
    getShellContext.mockResolvedValue(ctx(['mau-br-a']));
    expect(await (await GET(makeRequest('/api/store-context/branches'))).json()).toMatchObject({ single: true, selectedKey: 'mau-br-a' });
  });
  it('is never cached and 404 without a store', async () => {
    expect((await GET(makeRequest('/api/store-context/branches'))).status).toBe(404);
    await login();
    getShellContext.mockResolvedValue(ctx(['mau-br-a']));
    expect((await GET(makeRequest('/api/store-context/branches'))).headers.get('cache-control')).toBe('private, no-store');
  });
});
