import 'server-only';
import type { Store } from '@commercetools/platform-sdk';
import { apiRoot } from './client';
import type { StoreFields } from '../session-core';

const cache = new Map<string, Promise<StoreFields>>();

export function storeFieldsFrom(store: Store): StoreFields {
  const selection = store.productSelections?.find((s) => s.active !== false);
  return {
    storeKey: store.key,
    storeId: store.id,
    distributionChannelId: store.distributionChannels?.[0]?.id,
    supplyChannelId: store.supplyChannels?.[0]?.id,
    productSelectionId: selection?.productSelection.id,
  };
}

/** One lookup per server instance and store. A failed lookup is dropped from the cache so the next call retries. */
export function getStoreChannelData(storeKey: string): Promise<StoreFields> {
  const cached = cache.get(storeKey);
  if (cached) return cached;
  const lookup = apiRoot.stores().withKey({ key: storeKey }).get().execute().then((r) => storeFieldsFrom(r.body));
  cache.set(storeKey, lookup);
  lookup.catch(() => { if (cache.get(storeKey) === lookup) cache.delete(storeKey); });
  return lookup;
}

export const clearStoreCache = (): void => cache.clear();

/** The default public store, named by CTP_DEFAULT_STORE_KEY. */
export async function getDefaultStore(): Promise<StoreFields> {
  const key = process.env.CTP_DEFAULT_STORE_KEY;
  if (!key) throw new Error('Missing environment variable CTP_DEFAULT_STORE_KEY (see site/.env.example)');
  try {
    return await getStoreChannelData(key);
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 404) throw new Error(`CTP_DEFAULT_STORE_KEY names the store "${key}", which does not exist in the project`);
    throw error;
  }
}
