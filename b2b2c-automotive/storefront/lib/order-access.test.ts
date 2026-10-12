// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { canViewOrder, signOrderAccessToken } from './order-access';

const order = { id: 'o-1', storeKey: 'mau-reseller-north', customerId: 'c-1', anonymousId: 'a-1' };

describe('order access (stub of workstream O, replaced by P)', () => {
  it('owner customer may view', async () => expect(await canViewOrder({ customerId: 'c-1' }, order)).toBe(true));
  it('same browser anonymous may view', async () => expect(await canViewOrder({ anonymousId: 'a-1' }, order)).toBe(true));
  it('stranger may not view', async () => expect(await canViewOrder({ customerId: 'c-2', anonymousId: 'a-2' }, order)).toBe(false));
  it('token holder may view', async () => {
    const token = await signOrderAccessToken({ orderId: 'o-1', storeKey: 'mau-reseller-north' });
    expect(await canViewOrder({}, order, token)).toBe(true);
  });
  it('token for another order or store fails', async () => {
    expect(await canViewOrder({}, order, await signOrderAccessToken({ orderId: 'o-2', storeKey: 'mau-reseller-north' }))).toBe(false);
    expect(await canViewOrder({}, order, await signOrderAccessToken({ orderId: 'o-1', storeKey: 'mau-other' }))).toBe(false);
    expect(await canViewOrder({}, order, 'garbage')).toBe(false);
  });
});
