import 'server-only';
import { apiRoot } from '@/lib/ct/client';
import { cachedPublic } from '@/lib/ct/public-cache';
import { mapChannels } from '@/lib/mappers/channel';
import type { Store } from '@/lib/types';

/** All seeded stores for a display locale. The predicate stays role-only; the key prefix is applied in the mapper. */
async function fetchStoreChannels(locale: string): Promise<Store[]> {
  const { body } = await apiRoot
    .channels()
    .get({ queryArgs: { where: 'roles contains any ("InventorySupply")', limit: 500 } })
    .execute();
  return mapChannels(body.results, locale);
}

/** Public, stable data: cached with tag `channels` (TTL.channels). */
export const getStoreChannels: (locale: string) => Promise<Store[]> = cachedPublic(
  'channels',
  ['store-channels'],
  fetchStoreChannels,
);

/** Stores of one country. Collection is a US feature (D-035): Canada has none. */
export async function getStoresForCountry(country: string, locale: string): Promise<Store[]> {
  const stores = await getStoreChannels(locale);
  return stores.filter((s) => s.country === country);
}

export async function getChannelByKey(key: string, locale: string): Promise<Store | null> {
  const stores = await getStoreChannels(locale);
  return stores.find((s) => s.key === key) ?? null;
}
