/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { verifyHandoff } from '@/lib/impersonation/token';
import { createVFake, type VFake } from '@/lib/portal/v-fixture-root';
import { endShopAs, startShopAs } from './impersonation';
import { V_CONTAINERS, listObjects } from './v-objects';
import { setVRootForTest } from './v-root';

const NOW = new Date('2026-10-12T10:00:00Z');
const secret = 'k'.repeat(40);
let fake: VFake;

beforeEach(() => {
  fake = createVFake({ now: () => NOW, demo: true });
  setVRootForTest(fake.root);
});
afterEach(() => setVRootForTest(undefined));

describe('shop as customer (portal side)', () => {
  it('writes a single-use issued record and signs a token for the customer of this store', async () => {
    const { token, jti, name } = await startShopAs('fx-store-online', 'fx-shopper-online-1', 'actor-1', NOW, secret);
    expect(name).toBe('Anna Muster');
    expect(await verifyHandoff(token, { secret, now: NOW })).toMatchObject({ customerId: 'fx-shopper-online-1', storeKey: 'fx-store-online', actorId: 'actor-1', jti });
    const records = await listObjects(V_CONTAINERS.impersonation);
    expect(records).toEqual([{ key: jti, version: 1, value: { customerId: 'fx-shopper-online-1', storeKey: 'fx-store-online', actorId: 'actor-1', createdAt: NOW.toISOString(), status: 'issued' } }]);
  });

  it('a customer of another store is 404 and nothing is written or signed', async () => {
    await expect(startShopAs('fx-store-south', 'fx-shopper-online-1', 'actor-1', NOW, secret)).rejects.toMatchObject({ status: 404 });
    expect(await listObjects(V_CONTAINERS.impersonation)).toHaveLength(0);
  });

  it('without a configured secret it says the feature is not set up and writes nothing', async () => {
    await expect(startShopAs('fx-store-online', 'fx-shopper-online-1', 'actor-1', NOW, undefined)).rejects.toMatchObject({ status: 409, code: 'NOT_CONFIGURED' });
    expect(await listObjects(V_CONTAINERS.impersonation)).toHaveLength(0);
  });

  it('exit ends the seller records of the store only', async () => {
    const a = await startShopAs('fx-store-online', 'fx-shopper-online-1', 'actor-1', NOW, secret);
    await startShopAs('fx-store-south', 'fx-shopper-south-1', 'actor-1', NOW, secret);
    expect(await endShopAs('fx-store-online', 'actor-1')).toBe(1);
    const records = await listObjects<{ status: string; storeKey: string }>(V_CONTAINERS.impersonation);
    expect(records.find((r) => r.key === a.jti)?.value.status).toBe('ended');
    expect(records.filter((r) => r.value.storeKey === 'fx-store-south')[0].value.status).toBe('issued');
  });
});
