// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { SignJWT } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canViewOrder, signOrderAccessToken, verifyOrderAccessToken } from './order-access';

const order = { id: 'o-1', storeKey: 'mau-reseller-north', customerId: 'c-1', anonymousId: 'a-1' };
const input = { orderId: 'o-1', storeKey: 'mau-reseller-north' };
const secret = () => new TextEncoder().encode(process.env.ORDER_ACCESS_SECRET);
const forge = (audience: string, exp: string | number) =>
  new SignJWT({ oid: 'o-1', sk: 'mau-reseller-north' }).setProtectedHeader({ alg: 'HS256' }).setAudience(audience).setIssuedAt().setExpirationTime(exp).sign(secret());

afterEach(() => vi.unstubAllEnvs());

describe('order access', () => {
  it('token verifies for the same order and store', async () => expect(await verifyOrderAccessToken(await signOrderAccessToken(input), input)).toBe(true));
  it('token for another order fails', async () => expect(await verifyOrderAccessToken(await signOrderAccessToken({ ...input, orderId: 'o-2' }), input)).toBe(false));
  it('token for another store fails', async () => expect(await verifyOrderAccessToken(await signOrderAccessToken({ ...input, storeKey: 'mau-other' }), input)).toBe(false));
  it('expired token fails', async () => expect(await verifyOrderAccessToken(await forge('order-view', Math.floor(Date.now() / 1000) - 60), input)).toBe(false));
  it('wrong audience fails', async () => expect(await verifyOrderAccessToken(await forge('session', '30d'), input)).toBe(false));
  it('a token signed with the session secret fails', async () => {
    const key = new TextEncoder().encode(process.env.SESSION_SECRET);
    const token = await new SignJWT({ oid: 'o-1', sk: 'mau-reseller-north' }).setProtectedHeader({ alg: 'HS256' }).setAudience('order-view').setExpirationTime('30d').sign(key);
    expect(await verifyOrderAccessToken(token, input)).toBe(false);
  });
  it('garbage fails', async () => expect(await verifyOrderAccessToken('garbage', input)).toBe(false));
  it('weak secret fails at startup', async () => {
    vi.stubEnv('ORDER_ACCESS_SECRET', 'short');
    await expect(signOrderAccessToken(input)).rejects.toThrow('ORDER_ACCESS_SECRET must be at least 32 characters');
  });
  it('owner customer may view', async () => expect(await canViewOrder({ customerId: 'c-1' }, order)).toBe(true));
  it('same browser anonymous may view', async () => expect(await canViewOrder({ anonymousId: 'a-1' }, order)).toBe(true));
  it('stranger may not view', async () => expect(await canViewOrder({ customerId: 'c-2', anonymousId: 'a-2' }, order)).toBe(false));
  it('an empty session never matches an order without owner fields', async () => expect(await canViewOrder({}, { id: 'o-1', storeKey: 'x' })).toBe(false));
  it('token holder may view', async () => expect(await canViewOrder({}, order, await signOrderAccessToken(input))).toBe(true));
  it('token for another order or store does not open the order', async () => {
    expect(await canViewOrder({}, order, await signOrderAccessToken({ ...input, orderId: 'o-2' }))).toBe(false);
    expect(await canViewOrder({}, order, await signOrderAccessToken({ ...input, storeKey: 'mau-other' }))).toBe(false);
  });
});
