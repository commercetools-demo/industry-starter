// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/lib/types';

const state = vi.hoisted(() => ({ session: {} as Session }));
const endRecord = vi.hoisted(() => vi.fn());
const written = vi.hoisted(() => [] as Session[]);
vi.mock('@/lib/ct/impersonation', () => ({ endRecord }));
vi.mock('@/lib/session', () => ({
  getSession: async () => state.session,
  setSessionCookie: async (s: Session) => void written.push(s),
}));

import { POST } from './route';

beforeEach(() => {
  endRecord.mockReset().mockResolvedValue(undefined);
  written.length = 0;
});

describe('POST /api/impersonate/exit', () => {
  it('clears the customer session and marks the record ended', async () => {
    state.session = { storeKey: 'mau-reseller-north', customerId: 'cust-1', cartId: 'customer-cart', anonymousId: 'anon-1', impersonatedBy: 'seller-1', impJti: 'jti-1', impImpExp: 1, impAbs: 2 };
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(endRecord).toHaveBeenCalledWith('jti-1');
    const next = written[0];
    expect(next.storeKey).toBe('mau-reseller-north');
    expect(next.anonymousId).not.toBe('anon-1');
    for (const key of ['customerId', 'cartId', 'impersonatedBy', 'impJti', 'impImpExp', 'impAbs']) expect(next).not.toHaveProperty(key);
  });
  it('a normal shopper session is left alone (nothing is signed out by this route)', async () => {
    state.session = { storeKey: 'mau-reseller-north', customerId: 'cust-1', cartId: 'cart-1' };
    const res = await POST();
    expect(res.status).toBe(200);
    expect(written).toHaveLength(0);
    expect(endRecord).not.toHaveBeenCalled();
  });
});
