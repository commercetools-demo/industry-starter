import 'server-only';
import { getApiRoot } from './client';

const escapeSku = (sku: string): string => sku.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/**
 * Stock the shopper may still add for a SKU, read live from the inventory endpoint (never cached: D-031 makes the
 * app the only guard against over-adding). 0 when the SKU has no inventory entry.
 */
export async function getAvailableQuantity(sku: string): Promise<number> {
  const { body } = await getApiRoot()
    .inventory()
    .get({ queryArgs: { where: `sku="${escapeSku(sku)}"`, limit: 20 } })
    .execute();
  return body.results.reduce((sum, entry) => sum + Math.max(0, entry.availableQuantity), 0);
}
