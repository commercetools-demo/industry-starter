// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Maps the store (custom type `store-settings`) and its branch channels (custom type `branch-info`) to app types.
import type { Channel, ChannelReference, Store } from '@commercetools/platform-sdk';
import { z } from 'zod';
import type { Branch, OpeningHours, PickupMode, ShellContext, StoreSettings } from '@/lib/types';
import { getLocalizedString } from '@/lib/utils';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const hoursSchema = z.partialRecord(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']), z.tuple([z.string().regex(TIME), z.string().regex(TIME)]));
const PICKUP_MODES: PickupMode[] = ['same-day', 'next-day', 'ship-to-store'];

type Fields = Record<string, unknown> | undefined;
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
/** An https or http URL, else nothing (settings are editable by sellers; never render a `javascript:` link). */
const url = (v: unknown): string | undefined => {
  const s = str(v);
  if (!s) return undefined;
  try {
    return ['http:', 'https:'].includes(new URL(s).protocol) ? s : undefined;
  } catch {
    return s.startsWith('/') && !s.startsWith('//') ? s : undefined;
  }
};

/** Opening hours JSON; invalid JSON or shape means no hours (closed) and a logged warning, never a throw. */
export function parseOpeningHours(raw: unknown, key: string): OpeningHours {
  if (raw === undefined || raw === null || raw === '') return {};
  try {
    const parsed = hoursSchema.safeParse(typeof raw === 'string' ? JSON.parse(raw) : raw);
    if (parsed.success) return parsed.data as OpeningHours;
  } catch {
    // fall through to the warning
  }
  console.warn(`[store] branch ${key} has malformed openingHours; treated as closed`);
  return {};
}

/** Store identity and promises. The store name is localized; `logoUrl` is optional (text wordmark when absent). */
export function mapStoreSettings(store: Store, locale: string): StoreSettings {
  const f = store.custom?.fields as Fields;
  return {
    name: getLocalizedString(store.name, locale) || store.key,
    logoUrl: url(f?.logoUrl),
    faviconUrl: url(f?.faviconUrl),
    freeShippingThresholdCent: num(f?.freeShippingThresholdCent),
    currency: str(f?.currency),
    shipDays: { min: num(f?.shipDaysMin) ?? 2, max: num(f?.shipDaysMax) ?? 3 },
    timezone: str(f?.timezone) ?? 'Europe/Berlin',
    helpUrl: url(f?.helpUrl),
    trackUrl: url(f?.trackUrl),
  };
}

/** A branch channel; `null` when the channel has no `branch-info` type or no id. */
export function mapBranch(channel: Channel, locale: string, storeTimezone = 'Europe/Berlin'): Branch | null {
  if (!channel.custom || !channel.id || !channel.key) return null;
  const f = channel.custom.fields as Fields;
  if (!f || f.openingHours === undefined && f.pickupMode === undefined && f.timezone === undefined) return null;
  const coordinates = channel.geoLocation?.coordinates;
  const mode = PICKUP_MODES.find((m) => m === f.pickupMode) ?? 'same-day';
  return {
    key: channel.key,
    channelId: channel.id,
    name: getLocalizedString(channel.name, locale) || channel.key,
    address: { street: channel.address?.streetName ?? '', postalCode: channel.address?.postalCode ?? '', city: channel.address?.city ?? '' },
    geo: coordinates && coordinates.length >= 2 ? { lat: coordinates[1], lng: coordinates[0] } : undefined,
    hours: parseOpeningHours(f.openingHours, channel.key),
    timezone: str(f.timezone) ?? storeTimezone,
    pickupMode: mode,
    phone: str(f.phone),
  };
}

const isChannel = (ref: ChannelReference): ref is ChannelReference & { obj: Channel } => Boolean(ref.obj);

/**
 * Everything the shell needs from a store read with `distributionChannels[*]` expanded: settings, the branches (channels
 * with `branch-info`, sorted by key) and the retail channel (the distribution channel without `branch-info`).
 */
export function mapShellContext(store: Store, locale: string): ShellContext {
  const settings = mapStoreSettings(store, locale);
  const channels = (store.distributionChannels ?? []).filter(isChannel).map((r) => r.obj);
  const branches: Branch[] = [];
  let retailChannelId: string | undefined;
  for (const channel of [...channels].sort((a, b) => ((a.key ?? '') < (b.key ?? '') ? -1 : 1))) {
    const branch = mapBranch(channel, locale, settings.timezone);
    if (branch) branches.push(branch);
    else retailChannelId ??= channel.id;
  }
  return { storeId: store.id, settings, branches, retailChannelId, countries: (store.countries ?? []).map((c) => c.code) };
}
