// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Obj = Record<string, unknown>;
const channel = (key: string, storeKey: string, roles = ['InventorySupply', 'ProductDistribution']): Obj => ({
  id: `id-${key}`,
  key,
  version: 3,
  roles,
  name: { 'de-DE': key, 'en-US': key },
  address: { country: 'DE', streetName: 'Hafenallee', streetNumber: '12', postalCode: '21079', city: 'Hamburg' },
  geoLocation: { type: 'Point', coordinates: [9.98, 53.46] },
  custom: { type: { id: 't' }, fields: { openingHours: JSON.stringify({ mon: ['08:00', '18:00'] }), timezone: 'Europe/Berlin', pickupMode: 'same-day', phone: '+49 40 1', storeKey } },
});
const ref = (c: Obj) => ({ typeId: 'channel', id: c.id, obj: c });

let storeVersion = 7;
let channels: Obj[];
let storeChannels: { supply: string[]; distribution: string[] };
const storePosts: { version: number; actions: Obj[] }[] = [];
const channelPosts: Obj[] = [];
const channelDeletes: Obj[] = [];
let storePostError: unknown;
let channelPostError: unknown;

const storeBody = () => {
  const byKey = (k: string) => channels.find((c) => c.key === k) as Obj;
  return { key: 'mau-reseller-north', version: storeVersion, supplyChannels: storeChannels.supply.map((k) => ref(byKey(k))), distributionChannels: storeChannels.distribution.map((k) => ref(byKey(k))) };
};
vi.mock('@/lib/ct/admin-client', () => ({
  adminRoot: {
    stores: () => ({
      withKey: () => ({
        get: () => ({ execute: async () => ({ body: storeBody() }) }),
        post: ({ body }: { body: { version: number; actions: Obj[] } }) => ({
          execute: async () => {
            storePosts.push(body);
            if (storePostError) throw storePostError;
            return { body: storeBody() };
          },
        }),
      }),
    }),
    channels: () => ({
      post: ({ body }: { body: Obj }) => ({
        execute: async () => {
          channelPosts.push(body);
          if (channelPostError) throw channelPostError;
          return { body: { ...body, id: `id-${body.key}`, version: 1 } };
        },
      }),
      withKey: ({ key }: { key: string }) => ({
        post: ({ body }: { body: { actions: Obj[] } }) => ({
          execute: async () => {
            channelPosts.push({ key, ...body });
            return { body: { ...channel(key, 'mau-reseller-north'), version: 4 } };
          },
        }),
        delete: () => ({
          execute: async () => {
            channelDeletes.push({ key });
          },
        }),
      }),
    }),
  },
}));

import { createBranch, isBranchOf, listBranches, removeBranch, updateBranch } from './branches';

const INPUT = {
  storeKey: 'mau-reseller-north',
  slug: 'wandsbek',
  name: { 'de-DE': 'Wandsbek', 'en-US': 'Wandsbek' },
  address: { streetName: 'Beispielstrasse', streetNumber: '12', postalCode: '22041', city: 'Hamburg', country: 'DE' },
  geoLocation: { lat: 53.5711, lng: 10.0653 },
  openingHours: { mon: ['08:00', '18:00'] as [string, string], tue: ['08:00', '18:00'] as [string, string] },
  timezone: 'Europe/Berlin',
  pickupMode: 'same-day' as const,
  phone: '+49 40 0000000',
};

beforeEach(() => {
  storeVersion = 7;
  channels = [
    channel('mau-dist-north', 'x', ['ProductDistribution']),
    channel('mau-supply-malva', 'x', ['InventorySupply']),
    channel('mau-br-north-hamburg', 'mau-reseller-north'),
    channel('mau-br-north-foreign', 'mau-reseller-south'),
  ];
  storeChannels = {
    supply: ['mau-supply-malva', 'mau-br-north-hamburg', 'mau-br-north-foreign'],
    distribution: ['mau-dist-north', 'mau-br-north-hamburg', 'mau-br-north-foreign'],
  };
  storePosts.length = 0;
  channelPosts.length = 0;
  channelDeletes.length = 0;
  storePostError = undefined;
  channelPostError = undefined;
});

describe('branches', () => {
  it('lists only channels with both roles in both lists whose branch-info.storeKey is the store, never by key prefix', async () => {
    const list = await listBranches('mau-reseller-north');
    expect(list.map((b) => b.key)).toEqual(['mau-br-north-hamburg']);
    expect(list[0]).toMatchObject({ geoLocation: { lat: 53.46, lng: 9.98 }, pickupMode: 'same-day', timezone: 'Europe/Berlin', phone: '+49 40 1', openingHours: { mon: ['08:00', '18:00'] } });
  });

  it('isBranchOf needs both roles and the store key', () => {
    expect(isBranchOf(channel('a', 's') as never, 's')).toBe(true);
    expect(isBranchOf(channel('a', 's') as never, 'other')).toBe(false);
    expect(isBranchOf(channel('a', 's', ['InventorySupply']) as never, 's')).toBe(false);
  });

  it('new key follows mau-br-<store suffix>-<slug>; create makes a channel with both roles and the branch-info fields (including storeKey) and adds it to both lists', async () => {
    storeChannels.supply.push('mau-br-north-wandsbek');
    channels.push(channel('mau-br-north-wandsbek', 'mau-reseller-north'));
    const created = await createBranch('mau-reseller-north', INPUT);
    expect(created.key).toBe('mau-br-north-wandsbek');
    const draft = channelPosts[0] as { key: string; roles: string[]; geoLocation: Obj; address: Obj; custom: { type: Obj; fields: Record<string, string> } };
    expect(draft.key).toBe('mau-br-north-wandsbek');
    expect(draft.roles).toEqual(['InventorySupply', 'ProductDistribution']);
    expect(draft.geoLocation).toEqual({ type: 'Point', coordinates: [10.0653, 53.5711] });
    expect(draft.custom.type).toEqual({ typeId: 'type', key: 'branch-info' });
    expect(draft.custom.fields).toEqual({ openingHours: JSON.stringify(INPUT.openingHours), timezone: 'Europe/Berlin', pickupMode: 'same-day', storeKey: 'mau-reseller-north', phone: '+49 40 0000000' });
    expect(storePosts[0].actions).toEqual([
      { action: 'addSupplyChannel', supplyChannel: { typeId: 'channel', key: 'mau-br-north-wandsbek' } },
      { action: 'addDistributionChannel', distributionChannel: { typeId: 'channel', key: 'mau-br-north-wandsbek' } },
    ]);
    expect(storePosts[0].version).toBe(7);
  });

  it('a duplicate short name is a 409 and the store is not touched', async () => {
    channelPostError = { statusCode: 400, body: { errors: [{ code: 'DuplicateField' }] } };
    await expect(createBranch('mau-reseller-north', INPUT)).rejects.toMatchObject({ status: 409, code: 'BRANCH_EXISTS' });
    expect(storePosts).toHaveLength(0);
  });

  it('when the store update fails the new channel is removed again (no orphan)', async () => {
    storePostError = { statusCode: 500 };
    await expect(createBranch('mau-reseller-north', INPUT)).rejects.toBeDefined();
    expect(channelDeletes).toEqual([{ key: 'mau-br-north-wandsbek' }]);
  });

  it('a channel whose branch-info.storeKey is another store is 404 for update and remove, and nothing is written', async () => {
    await expect(updateBranch('mau-reseller-north', 'mau-br-north-foreign', INPUT)).rejects.toMatchObject({ status: 404 });
    await expect(removeBranch('mau-reseller-north', 'mau-br-north-foreign')).rejects.toMatchObject({ status: 404 });
    await expect(removeBranch('mau-reseller-north', 'mau-dist-north')).rejects.toMatchObject({ status: 404 });
    expect(channelPosts).toHaveLength(0);
    expect(storePosts).toHaveLength(0);
  });

  it('delete removes the channel from the store supply and distribution channels and leaves the channel', async () => {
    await removeBranch('mau-reseller-north', 'mau-br-north-hamburg');
    expect(storePosts[0].actions).toEqual([
      { action: 'removeSupplyChannel', supplyChannel: { typeId: 'channel', key: 'mau-br-north-hamburg' } },
      { action: 'removeDistributionChannel', distributionChannel: { typeId: 'channel', key: 'mau-br-north-hamburg' } },
    ]);
    expect(channelDeletes).toEqual([]);
  });

  it('update changes name, address, location and the branch-info fields of the channel', async () => {
    await updateBranch('mau-reseller-north', 'mau-br-north-hamburg', { ...INPUT, phone: undefined });
    const post = channelPosts[0] as { actions: Obj[] };
    const names = post.actions.map((a) => a.action);
    expect(names.slice(0, 3)).toEqual(['changeName', 'setAddress', 'setGeoLocation']);
    const fields = post.actions.filter((a) => a.action === 'setCustomField');
    expect(fields.find((f) => f.name === 'storeKey')?.value).toBe('mau-reseller-north');
    expect(fields.find((f) => f.name === 'phone')?.value).toBeNull();
  });
});
