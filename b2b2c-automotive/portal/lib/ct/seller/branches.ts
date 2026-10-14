// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Branches (workstream U-05, decision 8): a branch is a channel with BOTH roles `InventorySupply` and `ProductDistribution`,
// native `address` and `geoLocation` and the custom type `branch-info` (seed fields `openingHours` JSON, `timezone`, `phone`,
// `pickupMode`, `storeKey`), listed in the store's `supplyChannels` AND `distributionChannels`. A channel belongs to a store only
// when it is in those lists and its `branch-info.storeKey` equals the store key (never by key prefix). Removing a branch takes it
// out of both lists and leaves the channel (channels in use cannot be deleted). The picker of the storefront reads these channels.
import 'server-only';
import type { Channel, ChannelDraft, Store, StoreUpdateAction } from '@commercetools/platform-sdk';
import { ApiError } from '@/lib/api';
import { adminRoot } from '@/lib/ct/admin-client';
import { fixtureBranches } from '@/lib/portal/u-fixtures';
import { devFixturesEnabled } from '@/lib/portal/seam';
import { branchKeyFor, type BranchInput, type CreateBranchInput, type OpeningHours } from '@/lib/store/schemas';
import type { Branch } from '@/lib/store/types';
import { isConflict, isNotFound, retryOnConflict, statusOf } from './versioned';

export const BRANCH_INFO_TYPE = 'branch-info';

export type { Branch };

const text = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);

function parseHours(raw: unknown): OpeningHours {
  if (typeof raw !== 'string') return {};
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const out: OpeningHours = {};
    for (const day of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const) {
      const pair = value[day];
      if (Array.isArray(pair) && pair.length === 2 && typeof pair[0] === 'string' && typeof pair[1] === 'string') out[day] = [pair[0], pair[1]];
    }
    return out;
  } catch {
    return {};
  }
}

/** True when the channel is a branch of the store: both roles and `branch-info.storeKey` equal to the key. */
export function isBranchOf(channel: Pick<Channel, 'roles' | 'custom'>, storeKey: string): boolean {
  const fields = (channel.custom?.fields ?? {}) as Record<string, unknown>;
  return channel.roles.includes('InventorySupply') && channel.roles.includes('ProductDistribution') && fields.storeKey === storeKey;
}

export function mapBranch(channel: Channel): Branch {
  const f = (channel.custom?.fields ?? {}) as Record<string, unknown>;
  const coordinates = channel.geoLocation?.coordinates;
  return {
    key: channel.key,
    name: { ...(channel.name ?? {}) },
    address: {
      streetName: channel.address?.streetName ?? '',
      ...(channel.address?.streetNumber ? { streetNumber: channel.address.streetNumber } : {}),
      postalCode: channel.address?.postalCode ?? '',
      city: channel.address?.city ?? '',
      country: channel.address?.country ?? '',
    },
    ...(coordinates && coordinates.length === 2 ? { geoLocation: { lat: coordinates[1], lng: coordinates[0] } } : {}),
    openingHours: parseHours(f.openingHours),
    timezone: text(f.timezone) ?? 'Europe/Berlin',
    pickupMode: (['same-day', 'next-day', 'ship-to-store'] as const).find((m) => m === f.pickupMode) ?? 'next-day',
    ...(text(f.phone) ? { phone: text(f.phone) } : {}),
  };
}

const inBoth = (store: Store): Channel[] => {
  const supply = new Set((store.supplyChannels ?? []).map((r) => r.id));
  return (store.distributionChannels ?? []).filter((r) => supply.has(r.id)).flatMap((r) => (r.obj ? [r.obj] : []));
};

async function readStore(storeKey: string): Promise<Store> {
  try {
    return (await adminRoot.stores().withKey({ key: storeKey }).get({ queryArgs: { expand: ['distributionChannels[*]', 'supplyChannels[*]'] } }).execute()).body;
  } catch (error) {
    if (isNotFound(error)) throw new ApiError(404, 'Not found');
    throw error;
  }
}

/** The store's branch channels sorted by key. */
export async function listBranches(storeKey: string): Promise<Branch[]> {
  if (devFixturesEnabled()) return fixtureBranches.list(storeKey);
  const store = await readStore(storeKey);
  return inBoth(store)
    .filter((c) => isBranchOf(c, storeKey))
    .map(mapBranch)
    .sort((a, b) => (a.key < b.key ? -1 : 1));
}

/** 404 (never 403, no existence leak) unless `branchKey` is a branch of the store; returns the channel for an update. */
export async function requireBranchOfStore(storeKey: string, branchKey: string): Promise<Channel> {
  const store = await readStore(storeKey);
  const channel = inBoth(store).find((c) => c.key === branchKey && isBranchOf(c, storeKey));
  if (!channel) throw new ApiError(404, 'Not found');
  return channel;
}

/** Asserts the branch belongs to the store; used by the stock module. */
export async function assertBranchOfStore(storeKey: string, branchKey: string): Promise<void> {
  if (devFixturesEnabled()) {
    if (!(await fixtureBranches.list(storeKey)).some((b) => b.key === branchKey)) throw new ApiError(404, 'Not found');
    return;
  }
  await requireBranchOfStore(storeKey, branchKey);
}

function infoFields(input: BranchInput, storeKey: string): Record<string, string> {
  return {
    openingHours: JSON.stringify(input.openingHours),
    timezone: input.timezone,
    pickupMode: input.pickupMode,
    storeKey,
    ...(input.phone ? { phone: input.phone } : {}),
  };
}

const addressOf = (input: BranchInput) => ({ country: input.address.country, streetName: input.address.streetName, ...(input.address.streetNumber ? { streetNumber: input.address.streetNumber } : {}), postalCode: input.address.postalCode, city: input.address.city });

export function buildChannelDraft(storeKey: string, key: string, input: BranchInput): ChannelDraft {
  return {
    key,
    roles: ['InventorySupply', 'ProductDistribution'],
    name: input.name,
    address: addressOf(input),
    ...(input.geoLocation ? { geoLocation: { type: 'Point' as const, coordinates: [input.geoLocation.lng, input.geoLocation.lat] } } : {}),
    custom: { type: { typeId: 'type', key: BRANCH_INFO_TYPE }, fields: infoFields(input, storeKey) },
  };
}

const channelRef = (key: string) => ({ typeId: 'channel' as const, key });

export async function createBranch(storeKey: string, input: CreateBranchInput): Promise<Branch> {
  if (devFixturesEnabled()) return fixtureBranches.create(storeKey, input);
  const key = branchKeyFor(storeKey, input.slug);
  let channel: Channel;
  try {
    channel = (await adminRoot.channels().post({ body: buildChannelDraft(storeKey, key, input) }).execute()).body;
  } catch (error) {
    const codes = ((error as { body?: { errors?: { code?: string }[] } }).body?.errors ?? []).map((e) => e.code);
    if ((statusOf(error) === 400 && codes.includes('DuplicateField')) || isConflict(error)) throw new ApiError(409, 'A branch with this short name already exists', 'BRANCH_EXISTS');
    throw error;
  }
  try {
    await retryOnConflict(async () => {
      const store = (await adminRoot.stores().withKey({ key: storeKey }).get().execute()).body;
      const actions: StoreUpdateAction[] = [
        { action: 'addSupplyChannel', supplyChannel: channelRef(key) },
        { action: 'addDistributionChannel', distributionChannel: channelRef(key) },
      ];
      await adminRoot.stores().withKey({ key: storeKey }).post({ body: { version: store.version, actions } }).execute();
    });
  } catch (error) {
    // Compensation: a channel that never reached the store would be an orphan nobody can see.
    try {
      await adminRoot.channels().withKey({ key }).delete({ queryArgs: { version: channel.version } }).execute();
    } catch {
      // leave it; the key is unique and a retry reports BRANCH_EXISTS
    }
    throw error;
  }
  return mapBranch(channel);
}

export async function updateBranch(storeKey: string, branchKey: string, input: BranchInput): Promise<Branch> {
  if (devFixturesEnabled()) return fixtureBranches.update(storeKey, branchKey, input);
  const updated = await retryOnConflict(async () => {
    const channel = await requireBranchOfStore(storeKey, branchKey);
    const fields = infoFields(input, storeKey);
    const actions = [
      { action: 'changeName' as const, name: input.name },
      { action: 'setAddress' as const, address: addressOf(input) },
      { action: 'setGeoLocation' as const, geoLocation: input.geoLocation ? { type: 'Point' as const, coordinates: [input.geoLocation.lng, input.geoLocation.lat] } : undefined },
      ...Object.entries({ ...fields, ...(input.phone ? {} : { phone: null }) }).map(([name, value]) => ({ action: 'setCustomField' as const, name, value })),
    ];
    return (await adminRoot.channels().withKey({ key: branchKey }).post({ body: { version: channel.version, actions } }).execute()).body;
  });
  return mapBranch(updated);
}

/** Takes the branch out of the store's supply and distribution channels; the channel itself stays. */
export async function removeBranch(storeKey: string, branchKey: string): Promise<void> {
  if (devFixturesEnabled()) return fixtureBranches.remove(storeKey, branchKey);
  await requireBranchOfStore(storeKey, branchKey);
  await retryOnConflict(async () => {
    const store = (await adminRoot.stores().withKey({ key: storeKey }).get().execute()).body;
    const actions: StoreUpdateAction[] = [
      { action: 'removeSupplyChannel', supplyChannel: channelRef(branchKey) },
      { action: 'removeDistributionChannel', distributionChannel: channelRef(branchKey) },
    ];
    await adminRoot.stores().withKey({ key: storeKey }).post({ body: { version: store.version, actions } }).execute();
  });
}
