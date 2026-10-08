import 'server-only';
import type { ShoppingList } from '@commercetools/platform-sdk';
import type { Patient } from '@/lib/ct/patient';
import { findOwnPrescription, type RxContext } from '@/lib/ct/prescriptions';
import { getCatalogBySku } from '@/lib/ct/rx-catalog';
import { getCartSummary } from '@/lib/ct/cart';
import { addLines, createList, getOrCreateDefaultList, getOwnList, ListLimitError, type LineInput } from '@/lib/ct/shopping-lists';
import { DEFAULT_LIST_ID, type ListLineView, type ListView } from '@/lib/lists-types';
import { listLineFieldsOf, localizedName, mapListSummary } from '@/lib/mappers/shopping-list';

/**
 * The list detail page: each line's price comes from ONE catalog read for all its SKUs (product projection with the
 * visitor's currency and country), never from a throwaway cart. A line saved at one price and now priced differently
 * carries the delta so the page can say so; nothing is repriced silently. A product that left the catalog (or has no
 * price in the region) is flagged unavailable.
 */
export async function getListView(list: ShoppingList, ctx: RxContext): Promise<ListView> {
  const catalog = await getCatalogBySku(list.lineItems.map((i) => i.variant?.sku ?? '').filter(Boolean), ctx);
  const lines: ListLineView[] = list.lineItems.map((item) => {
    const sku = item.variant?.sku ?? '';
    const entry = catalog.get(sku);
    const price = entry && entry.medication.sellableInRegion !== false ? entry.medication.price : null;
    const saved = listLineFieldsOf(item)?.savedPrice ?? null;
    const delta = price && saved && saved.currencyCode === price.currencyCode && saved.centAmount !== price.centAmount ? price.centAmount - saved.centAmount : null;
    return { id: item.id, name: entry?.medication.name || localizedName(item.name, ctx.locale), sku, price, savedPrice: saved, priceDeltaCents: delta, unavailable: price === null };
  });
  return { ...mapListSummary(list, ctx.locale), lines };
}

export interface SaveResult {
  listId: string;
  /** Lines newly saved (a line already on the list is not saved twice). */
  saved: number;
  /** Lines that were already on the list. */
  alreadySaved: number;
}

/**
 * "Save to My medicines" on a prescription card: the patient's OWN prescription only (foreign and unknown numbers are
 * the same null); the line carries the SKU, the prescription reference and today's catalog price. The sig is not
 * stored. Any line of the prescription can be saved, also one that cannot be dispensed today: it is checked again when
 * the list is added to the cart.
 */
export async function saveRxLines(
  customerId: string,
  patient: Patient,
  rxNumber: string,
  lineRefs: string[],
  o: { listId?: string; defaultName: string; ctx: RxContext },
): Promise<SaveResult | null> {
  const rx = await findOwnPrescription(patient.patientRef, rxNumber);
  if (!rx) return null;
  const chosen = rx.lines.filter((l) => lineRefs.includes(l.lineRef));
  if (chosen.length === 0) return null;
  const list = o.listId && o.listId !== DEFAULT_LIST_ID ? await getOwnList(o.listId, customerId) : await getOrCreateDefaultList(customerId, o.ctx.locale, o.defaultName);
  if (!list) return null;
  const catalog = await getCatalogBySku(chosen.map((l) => l.sku), o.ctx);
  const lines: LineInput[] = chosen.map((l) => ({ sku: l.sku, rxNumber: rx.number, rxLineRef: l.lineRef, price: catalog.get(l.sku)?.medication.price ?? null }));
  const result = await addLines(list.id, customerId, lines);
  if (!result) return null;
  return { listId: list.id, saved: result.added, alreadySaved: lines.length - result.added };
}

/**
 * "Create a first list from the current cart": every prescription line in the signed-in customer's cart becomes a list
 * line (SKU, prescription reference, the price the cart shows now). An empty cart is a readable refusal.
 */
export async function createListFromCart(customerId: string, cartId: string | undefined, name: string, ctx: RxContext): Promise<ShoppingList> {
  const cart = await getCartSummary(customerId, cartId, ctx.currency);
  const lines: LineInput[] = (cart?.lines ?? [])
    .filter((l) => l.rxNumber && l.rxLineRef && l.sku)
    .map((l) => ({ sku: l.sku, rxNumber: l.rxNumber, rxLineRef: l.rxLineRef, price: l.unitPrice }));
  if (lines.length === 0) throw new ListLimitError('EMPTY');
  return createList(customerId, name, ctx.locale, { lines });
}
