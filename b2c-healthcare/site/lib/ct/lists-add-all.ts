import 'server-only';
import type { ShoppingList } from '@commercetools/platform-sdk';
import { addPrescribedGroups } from '@/lib/ct/orders-reorder';
import type { Patient } from '@/lib/ct/patient';
import type { RxContext } from '@/lib/ct/prescriptions';
import { getCatalogBySku } from '@/lib/ct/rx-catalog';
import type { AddAllResult } from '@/lib/lists-types';
import { listLineFieldsOf, localizedName } from '@/lib/mappers/shopping-list';

/**
 * "Add all to cart" for a saved list (saved-lists, one operation). Not a platform `addShoppingList` copy: a copy
 * would put medicines into the cart without the prescription rules. Every line is re-validated now through the same
 * path as reorder (N: own prescription, refills, expiry, stock, ceilings, shelf life), the dispensable ones are added
 * with the platform's own prices, and each line that could not be added is NAMED with its reason; the added ones
 * stay in the cart. The list itself is never changed. Lines without a prescription reference or whose product left
 * the catalog (or has no price in the visitor's region) are `UNAVAILABLE`.
 */
export async function addListToCart(
  list: Pick<ShoppingList, 'lineItems'>,
  input: { customerId: string; cartId: string | undefined; patient: Patient; ctx: RxContext },
): Promise<{ result: AddAllResult; cartId: string | undefined }> {
  const added: string[] = [];
  const notAdded: AddAllResult['notAdded'] = [];
  const catalog = await getCatalogBySku(
    list.lineItems.map((i) => i.variant?.sku ?? '').filter(Boolean),
    input.ctx,
  );
  const groups = new Map<string, { lineRef: string; name: string }[]>();
  for (const item of list.lineItems) {
    const entry = catalog.get(item.variant?.sku ?? '');
    const name = entry?.medication.name || localizedName(item.name, input.ctx.locale);
    const fields = listLineFieldsOf(item);
    if (!fields || !entry || entry.medication.sellableInRegion === false || !entry.medication.price) notAdded.push({ name, reason: 'UNAVAILABLE' });
    else groups.set(fields.rxNumber, [...(groups.get(fields.rxNumber) ?? []), { lineRef: fields.rxLineRef, name }]);
  }
  const cartId = await addPrescribedGroups(groups, { added, notAdded }, input);
  return { result: { added, notAdded }, cartId };
}
