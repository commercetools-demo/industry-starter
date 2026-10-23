import 'server-only';
import type { InventoryEntry } from '@commercetools/platform-sdk';
import { availabilityState } from '@/lib/availability';
import { apiRoot } from '@/lib/ct/client';
import { AppError } from '@/lib/errors';
import { LOW_STOCK_THRESHOLD } from '@/lib/shop-config';
import type { InventoryDetail, SkuAvailability, Store } from '@/lib/types';

export const SKU_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

/** Injection guard: a SKU is only ever put into a query predicate after this check. */
export function assertValidSku(sku: string): string {
  if (!SKU_PATTERN.test(sku)) throw new AppError('validation_failed', 400);
  return sku;
}

function mapEntries(
  sku: string,
  entries: InventoryEntry[],
  stores: Pick<Store, 'id' | 'key'>[],
): SkuAvailability {
  const online = entries.find((e) => !e.supplyChannel);
  const quantityByChannel = new Map<string, number>();
  for (const e of entries) {
    if (e.supplyChannel) quantityByChannel.set(e.supplyChannel.id, e.availableQuantity);
  }
  return {
    sku,
    ship: availabilityState(online?.availableQuantity ?? 0, LOW_STOCK_THRESHOLD),
    stores: stores.map((s) => {
      const quantity = quantityByChannel.get(s.id) ?? 0;
      return { storeKey: s.key, quantity, state: availabilityState(quantity, LOW_STOCK_THRESHOLD) };
    }),
  };
}

/**
 * Stock for one SKU: the online warehouse (entry without a supply channel) decides `ship`, each store channel
 * decides its own line. Not cached: this is the strongly consistent source used for a binding check.
 */
export async function getStoreAvailability(
  sku: string,
  storeChannels: Pick<Store, 'id' | 'key'>[],
): Promise<SkuAvailability> {
  assertValidSku(sku);
  const { body } = await apiRoot
    .inventory()
    .get({ queryArgs: { where: `sku="${sku}"`, limit: 100 } })
    .execute();
  return mapEntries(sku, body.results, storeChannels);
}

/** Same read for several SKUs in one call (cart and listing use). */
export async function getAvailabilityForSkus(
  skus: string[],
  storeChannels: Pick<Store, 'id' | 'key'>[],
): Promise<SkuAvailability[]> {
  const unique = [...new Set(skus.map(assertValidSku))];
  if (unique.length === 0) return [];
  const { body } = await apiRoot
    .inventory()
    .get({ queryArgs: { where: `sku in (${unique.map((s) => `"${s}"`).join(', ')})`, limit: 500 } })
    .execute();
  return unique.map((sku) =>
    mapEntries(sku, body.results.filter((e) => e.sku === sku), storeChannels),
  );
}

/**
 * Stock detail for the product page (workstream H, 3.3): per SKU the online entry (no supply channel) with its restock
 * and cart quantity fields, and the quantity per store channel id. A SKU with no entry is absent from the result.
 * Strongly consistent source (`variant.availability` is eventually consistent and is not used here); never cached.
 */
export async function getInventoryDetail(skus: string[]): Promise<Record<string, InventoryDetail>> {
  const unique = [...new Set(skus.map(assertValidSku))];
  if (unique.length === 0) return {};
  const { body } = await apiRoot
    .inventory()
    .get({ queryArgs: { where: `sku in (${unique.map((s) => `"${s}"`).join(', ')})`, limit: 500 } })
    .execute();
  const out: Record<string, InventoryDetail> = {};
  for (const e of body.results) {
    const entry = (out[e.sku] ??= { online: 0, stores: {} });
    if (e.supplyChannel) {
      entry.stores[e.supplyChannel.id] = e.availableQuantity;
    } else {
      entry.online = e.availableQuantity;
      if (e.restockableInDays !== undefined) entry.restockableInDays = e.restockableInDays;
      if (e.expectedDelivery) entry.expectedDelivery = e.expectedDelivery;
      if (e.minCartQuantity !== undefined) entry.minQty = e.minCartQuantity;
      if (e.maxCartQuantity !== undefined) entry.maxQty = e.maxCartQuantity;
    }
  }
  return out;
}

/** Available quantity of one SKU at one store channel (0 when there is no entry). The binding check before a collect line. */
export async function getStoreStock(sku: string, channelId: string): Promise<number> {
  assertValidSku(sku);
  if (!/^[A-Za-z0-9-]{1,64}$/.test(channelId)) throw new AppError('validation_failed', 400);
  const { body } = await apiRoot
    .inventory()
    .get({ queryArgs: { where: `sku="${sku}" and supplyChannel(id="${channelId}")`, limit: 1 } })
    .execute();
  return body.results[0]?.availableQuantity ?? 0;
}
