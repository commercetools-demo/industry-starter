/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '@/test/request';
import { createSeamMock } from '@/test/portal-mocks';

let m = createSeamMock();
vi.mock('@/lib/portal/seam', () => ({
  readSession: (...a: unknown[]) => (m.seam.readSession as (...x: unknown[]) => unknown)(...a),
  writeSession: (...a: unknown[]) => (m.seam.writeSession as (...x: unknown[]) => unknown)(...a),
  clearSession: () => m.seam.clearSession(),
  getPorts: () => m.seam.getPorts(),
}));

import { POST } from './route';

const post = (json: unknown, cookie?: string) => POST(makeRequest('/api/auth/login', { method: 'POST', json, cookie }));

beforeEach(() => {
  m = createSeamMock();
});

describe('POST /api/auth/login', () => {
  it('unknown email and wrong password return the same body and status', async () => {
    m.ports.login.mockResolvedValue({ kind: 'invalid' });
    const unknown = await post({ email: 'nobody@example.com', password: 'x' });
    const wrong = await post({ email: 'known@example.com', password: 'wrong' });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(unknown.status);
    expect(await wrong.json()).toEqual(await unknown.json());
    expect(m.state.writes).toBe(0);
  });

  it('empty password: nothing sent to commercetools', async () => {
    const res = await post({ email: 'known@example.com', password: '' });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: 'FIELDS_REQUIRED' });
    expect(m.ports.login).not.toHaveBeenCalled();
  });

  it('writes all business unit and store fields in one session update', async () => {
    m.ports.login.mockResolvedValue({
      kind: 'ok',
      customerId: 'c1',
      context: { businessUnitKey: 'bu1', storeKey: 's1', distributionChannelId: 'd1', supplyChannelId: 'i1', productSelectionId: 'p1', accountGroupIds: [] },
    });
    const res = await post({ email: 'known@example.com', password: 'secret-password-1' }, 'your-shop-country-locale=en-US');
    expect(await res.json()).toEqual({ status: 'ok' });
    expect(m.state.writes).toBe(1);
    expect(m.state.session).toMatchObject({
      customerId: 'c1', businessUnitKey: 'bu1', storeKey: 's1', distributionChannelId: 'd1', supplyChannelId: 'i1',
      productSelectionId: 'p1', locale: 'en-US', currency: 'USD', country: 'US',
    });
    expect(m.state.session.cartId).toBeUndefined();
    expect(m.state.session.pending).toBeUndefined();
  });

  it('all units inactive gives reduced pending session', async () => {
    m.state.session = { cartId: 'old', businessUnitKey: 'stale' };
    m.ports.login.mockResolvedValue({ kind: 'pending', customerId: 'c2' });
    const res = await post({ email: 'new@example.com', password: 'secret-password-1' });
    expect(await res.json()).toEqual({ status: 'pending' });
    expect(m.state.session).toEqual({ customerId: 'c2', pending: true });
  });

  it('the last used unit cookie is passed on as a preference', async () => {
    m.ports.login.mockResolvedValue({ kind: 'invalid' });
    await post({ email: 'known@example.com', password: 'x' }, 'portal_last_bu=bu-last');
    expect(m.ports.login).toHaveBeenCalledWith('known@example.com', 'x', { preferredUnitKey: 'bu-last' });
  });

  it('answers no-store', async () => {
    const res = await post({ email: '', password: '' });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});
