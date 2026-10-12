// The store a seller edits, read with the admin client: languages, countries, selling currencies, its retail price channel
// and its branch channels, and the key and version of its own product selection.
import 'server-only';
import type { Store } from '@commercetools/platform-sdk';
import { CatalogError } from '@/lib/catalog/errors';
import type { PriceCurrency } from '@/lib/catalog/price-keys';
import { catalogRoot } from './catalog-root';
import { isNotFound } from './versioned';

export interface ChannelInfo {
  id: string;
  key: string;
}

export interface SellerStore {
  key: string;
  languages: string[];
  countries: string[];
  /** EUR always; USD for a store that sells in the US. */
  currencies: PriceCurrency[];
  retailChannel: ChannelInfo;
  branchChannels: ChannelInfo[];
  selection: { id: string; key: string };
}

const byKey = (a: { key: string }, b: { key: string }) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

/** The retail channel is the distribution channel that does not also supply stock (a branch has both roles). */
export function splitChannels(store: Pick<Store, 'distributionChannels'>): { retail: ChannelInfo; branches: ChannelInfo[] } | null {
  const all = (store.distributionChannels ?? [])
    .map((ref) => ({ id: ref.id, key: ref.obj?.key ?? '', roles: ref.obj?.roles ?? [] }))
    .filter((c) => c.key)
    .sort(byKey);
  const retail = all.find((c) => !c.roles.includes('InventorySupply')) ?? all[0];
  if (!retail) return null;
  return { retail: { id: retail.id, key: retail.key }, branches: all.filter((c) => c.key !== retail.key).map(({ id, key }) => ({ id, key })) };
}

export async function getSellerStore(storeKey: string): Promise<SellerStore> {
  const root = await catalogRoot();
  let store: Store;
  try {
    store = (await root.stores().withKey({ key: storeKey }).get({ queryArgs: { expand: ['distributionChannels[*]', 'productSelections[*].productSelection'] } }).execute()).body;
  } catch (error) {
    if (isNotFound(error)) throw new CatalogError(404, 'STORE_NOT_FOUND', 'Not found');
    throw error;
  }
  const channels = splitChannels(store);
  const selection = (store.productSelections ?? [])
    .filter((s) => s.active !== false)
    .map((s) => ({ id: s.productSelection.id, key: s.productSelection.obj?.key ?? s.productSelection.id }))
    .sort(byKey)[0];
  if (!channels || !selection) throw new CatalogError(404, 'STORE_NOT_READY', 'Not found');
  const countries = (store.countries ?? []).map((c) => c.code);
  return {
    key: store.key,
    languages: store.languages ?? [],
    countries,
    currencies: countries.includes('US') ? ['EUR', 'USD'] : ['EUR'],
    retailChannel: channels.retail,
    branchChannels: channels.branches,
    selection,
  };
}
