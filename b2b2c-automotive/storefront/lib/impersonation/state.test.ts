// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Session } from '@/lib/types';
import { endedSession, IDLE_SECONDS, ABSOLUTE_SECONDS, impersonationState, isImpersonating, maskEmail, startImpersonation, touchImpersonation } from './state';

const T0 = new Date('2026-10-12T10:00:00.000Z');
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);
const base: Session = { storeKey: 'mau-reseller-north', distributionChannelId: 'd', supplyChannelId: 's', productSelectionId: 'p', anonymousId: 'anon', cartId: 'old-cart', branchKey: 'b1' };
const started = () => startImpersonation(base, { customerId: 'cust-1', actorId: 'seller-1', jti: 'jti-1' }, T0);

describe('impersonation session state (V-06)', () => {
  it('a normal session is not impersonating', () => {
    expect(isImpersonating(base)).toBe(false);
    expect(impersonationState(base, T0)).toBe('none');
  });
  it('starting writes the customer, the actor, the record id and both deadlines and drops the old cart', () => {
    const s = started();
    expect(s).toMatchObject({ customerId: 'cust-1', impersonatedBy: 'seller-1', impJti: 'jti-1', storeKey: 'mau-reseller-north' });
    expect(s.impImpExp).toBe(Math.floor(T0.getTime() / 1000) + IDLE_SECONDS);
    expect(s.impAbs).toBe(Math.floor(T0.getTime() / 1000) + ABSOLUTE_SECONDS);
    expect(s.cartId).toBeUndefined();
    expect(s.branchKey).toBe('b1');
    expect(IDLE_SECONDS).toBe(120);
    expect(ABSOLUTE_SECONDS).toBe(30 * 60);
  });
  it('idle 121 seconds ends the session; activity within 120 seconds extends it', () => {
    const s = started();
    expect(impersonationState(s, at(119))).toBe('active');
    expect(impersonationState(s, at(121))).toBe('expired');
    const touched = touchImpersonation(s, at(100));
    expect(impersonationState(touched, at(210))).toBe('active');
    expect(impersonationState(touched, at(221))).toBe('expired');
  });
  it('the absolute cap of 30 minutes ends it even when the shopper stays active', () => {
    let s = started();
    for (let t = 100; t < ABSOLUTE_SECONDS; t += 100) {
      expect(impersonationState(s, at(t))).toBe('active');
      s = touchImpersonation(s, at(t));
    }
    expect(impersonationState(s, at(ABSOLUTE_SECONDS + 1))).toBe('expired');
    expect(touchImpersonation(s, at(ABSOLUTE_SECONDS - 10)).impImpExp).toBeLessThanOrEqual(s.impAbs ?? 0);
  });
  it('a revoked record (status ended) ends it', () => {
    expect(impersonationState(started(), at(5), 'ended')).toBe('expired');
    expect(impersonationState(started(), at(5), 'active')).toBe('active');
  });
  it('a session with an actor but a missing deadline is expired (never open ended)', () => {
    expect(impersonationState({ ...base, customerId: 'c', impersonatedBy: 'seller-1' }, T0)).toBe('expired');
  });
  it('touching a normal session changes nothing', () => {
    expect(touchImpersonation(base, T0)).toEqual(base);
  });
  it('ending signs the customer out, drops the cart and every impersonation field, and rotates the anonymous id', () => {
    const s = { ...started(), cartId: 'customer-cart' };
    const ended = endedSession(s, 'fresh-anon');
    expect(ended).toEqual({ ...base, cartId: undefined, anonymousId: 'fresh-anon' });
    for (const key of ['customerId', 'cartId', 'impersonatedBy', 'impJti', 'impImpExp', 'impAbs']) expect(ended).not.toHaveProperty(key);
  });
});

describe('masked customer data', () => {
  it('masks the e-mail', () => {
    expect(maskEmail('anna.beispiel@example.de')).toBe('a***@e***.de');
    expect(maskEmail('nonsense')).toBe('***');
  });
});
