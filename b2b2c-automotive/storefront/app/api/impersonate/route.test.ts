// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signHandoffForTest } from '@/lib/impersonation/handoff';
import type { Session } from '@/lib/types';

const SECRET = new TextEncoder().encode('i'.repeat(40));
const state = vi.hoisted(() => ({ session: {} as Session, secret: null as Uint8Array | null }));
const claimHandoff = vi.hoisted(() => vi.fn());
const getStoreContext = vi.hoisted(() => vi.fn());
const written = vi.hoisted(() => [] as Session[]);

vi.mock('@/lib/env', () => ({ getImpersonationSecret: () => state.secret }));
vi.mock('@/lib/ct/impersonation', () => ({ claimHandoff }));
vi.mock('@/lib/ct/stores', () => ({ getStoreContext }));
vi.mock('@/lib/session', () => ({
  getSession: async () => state.session,
  getLocale: async () => ({ locale: 'de-DE', currency: 'EUR', country: 'DE' }),
  setSessionCookie: async (s: Session) => void written.push(s),
}));

import { POST } from './route';

const claims = { customerId: 'cust-1', storeKey: 'mau-reseller-north', actorId: 'seller-1', jti: 'jti-1' };
const store = { storeKey: 'mau-reseller-north', distributionChannelId: 'd1', supplyChannelId: 's1', productSelectionId: 'p1' };
const form = (token: unknown) => {
  const body = new URLSearchParams();
  if (token !== undefined) body.set('token', String(token));
  return new Request('http://localhost:3000/api/impersonate', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
};
const ok = async (over: Parameters<typeof signHandoffForTest>[2] = {}, who = claims) => form(await signHandoffForTest(who, SECRET, over));

beforeEach(() => {
  state.session = { anonymousId: 'anon-1', cartId: 'anon-cart' };
  state.secret = SECRET;
  written.length = 0;
  claimHandoff.mockReset().mockResolvedValue(true);
  getStoreContext.mockReset().mockResolvedValue(store);
});

const expectGenericNotFound = async (res: Response) => {
  expect(res.status).toBe(404);
  const text = await res.text();
  expect(text).not.toMatch(/token|signature|expired|record|customer|secret|store/i);
  expect(written).toHaveLength(0);
};

describe('POST /api/impersonate (handoff landing)', () => {
  it('a valid token starts the customer session and redirects 303 to the account of the store', async () => {
    const res = await POST(await ok());
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('http://localhost:3000/de-DE/mau-reseller-north/account');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(claimHandoff).toHaveBeenCalledWith(claims);
    const session = written[0];
    expect(session).toMatchObject({ customerId: 'cust-1', impersonatedBy: 'seller-1', impJti: 'jti-1', storeKey: 'mau-reseller-north', distributionChannelId: 'd1', supplyChannelId: 's1', productSelectionId: 'p1' });
    expect(session.impImpExp).toBeGreaterThan(Date.now() / 1000);
    expect(session.impAbs).toBeGreaterThan(session.impImpExp ?? 0);
    expect(session.cartId).toBeUndefined();
  });
  it('the token is never in the redirect or the response', async () => {
    const token = await signHandoffForTest(claims, SECRET);
    const res = await POST(form(token));
    expect(res.headers.get('location')).not.toContain(token);
    expect(JSON.stringify([...res.headers])).not.toContain(token);
  });
  it('second use fails: the record is no longer issued', async () => {
    claimHandoff.mockResolvedValue(false);
    await expectGenericNotFound(await POST(await ok()));
  });
  it('a token older than 60 seconds fails', async () => {
    await expectGenericNotFound(await POST(await ok({ now: new Date(Date.now() - 61_000) })));
  });
  it('a wrong audience fails', async () => {
    await expectGenericNotFound(await POST(await ok({ audience: 'portal' })));
    expect(claimHandoff).not.toHaveBeenCalled();
  });
  it('a token signed with another secret (tampered signature) fails', async () => {
    const forged = await signHandoffForTest(claims, new TextEncoder().encode('z'.repeat(40)));
    await expectGenericNotFound(await POST(form(forged)));
    const token = await signHandoffForTest(claims, SECRET);
    await expectGenericNotFound(await POST(form(`${token.slice(0, -3)}abc`)));
    expect(claimHandoff).not.toHaveBeenCalled();
  });
  it('a customer of another store fails (the record check refuses it) and a store that cannot be resolved fails', async () => {
    claimHandoff.mockResolvedValue(false);
    await expectGenericNotFound(await POST(await ok({}, { ...claims, storeKey: 'mau-reseller-south' })));
    claimHandoff.mockResolvedValue(true);
    getStoreContext.mockResolvedValue(null);
    await expectGenericNotFound(await POST(await ok()));
  });
  it('no secret configured, a missing token or a very long token all fail the same way', async () => {
    state.secret = null;
    await expectGenericNotFound(await POST(await ok()));
    state.secret = SECRET;
    await expectGenericNotFound(await POST(form(undefined)));
    await expectGenericNotFound(await POST(form('x'.repeat(5000))));
  });
  it('a commercetools failure is the same generic page, not a 500 with detail', async () => {
    claimHandoff.mockRejectedValue({ statusCode: 503, body: { message: 'secret detail' } });
    await expectGenericNotFound(await POST(await ok()));
  });
  it('a JSON body or a token in the query string is not accepted', async () => {
    const token = await signHandoffForTest(claims, SECRET);
    const json = new Request('http://localhost:3000/api/impersonate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) });
    await expectGenericNotFound(await POST(json));
    const query = new Request(`http://localhost:3000/api/impersonate?token=${token}`, { method: 'POST' });
    await expectGenericNotFound(await POST(query));
  });
});
