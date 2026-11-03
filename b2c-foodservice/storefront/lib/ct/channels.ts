import 'server-only';
import { apiRoot } from '@/lib/ct/client';
import { cachedPublic } from '@/lib/ct/public-cache';
import { BRANDS, type BrandSlug } from '@/lib/brands';
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

async function fetchBrandChannelIds(): Promise<Record<string, string>> {
  const keys = Object.values(BRANDS).flatMap((b) => (b.inventoryChannelKey ? [{ key: b.inventoryChannelKey, slug: b.slug }] : []));
  if (keys.length === 0) return {};
  const { body } = await apiRoot
    .channels()
    .get({ queryArgs: { where: `key in (${keys.map((k) => `"${k.key}"`).join(', ')})`, limit: 50 } })
    .execute();
  const out: Record<string, string> = {};
  for (const c of body.results) {
    const brand = keys.find((k) => k.key === c.key);
    if (brand) out[c.id] = brand.slug;
  }
  return out;
}

/**
 * Inventory channels that belong to a brand (Malva Drinks), as channel id to brand slug. Their stock is that brand's
 * "online" stock, not a collection store. Public and stable: cached with tag `channels`.
 */
export const getBrandChannelIds: () => Promise<Record<string, string>> = cachedPublic('channels', ['brand-channel-ids'], fetchBrandChannelIds);

/** The inventory channel id of a brand (Malva Drinks), or undefined for a brand without one or when the channel is missing. */
export async function getBrandChannelId(brand: BrandSlug): Promise<string | undefined> {
  if (!BRANDS[brand].inventoryChannelKey) return undefined;
  return Object.entries(await getBrandChannelIds()).find(([, slug]) => slug === brand)?.[0];
}
