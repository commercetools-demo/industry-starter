import 'server-only';
import { getApiRoot } from './client';
import { withTimeout } from './timeout';

const PAGE_LIMIT = 100;

const quote = (value: string): string => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/**
 * Available quantity per SKU from the inventory entries (never cached). Only physical SKUs are asked: services have no entry
 * and are never queried (D-019). A physical SKU without an entry has 0. Entries of one SKU in several channels are summed.
 */
export async function getAvailableQuantities(skus: string[]): Promise<Record<string, number>> {
  const unique = [...new Set(skus)];
  const result: Record<string, number> = Object.fromEntries(unique.map((sku) => [sku, 0]));
  if (unique.length === 0) return result;
  const where = `sku in (${unique.map((sku) => `"${quote(sku)}"`).join(',')})`;
  const { body } = await withTimeout(getApiRoot().inventory().get({ queryArgs: { where, limit: PAGE_LIMIT } }).execute(), 'inventory.read');
  for (const entry of body.results) {
    if (entry.sku in result) result[entry.sku] = (result[entry.sku] ?? 0) + Math.max(0, entry.availableQuantity);
  }
  return result;
}

/** `available` for one SKU, for the add route. */
export async function getAvailableQuantity(sku: string): Promise<number> {
  return (await getAvailableQuantities([sku]))[sku] ?? 0;
}
