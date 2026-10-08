import 'server-only';
import type { Order } from '@commercetools/platform-sdk';
import { addRxLines } from '@/lib/ct/cart';
import type { Patient } from '@/lib/ct/patient';
import { RxNotFoundError, validateRxSelection, type RxContext } from '@/lib/ct/prescriptions';
import { isLimitError } from '@/lib/dispense/limit-errors';
import { rxFieldsOf } from '@/lib/mappers/cart';
import type { NotAddedReason, ReorderResult } from '@/lib/order-types';
import type { RxLineStatus } from '@/lib/types';

export const REASON: Partial<Record<RxLineStatus, NotAddedReason>> = { NO_REFILLS: 'NO_REFILLS', EXPIRED: 'EXPIRED', OUT_OF_STOCK: 'OUT_OF_STOCK' };

const nameOf = (name: Record<string, string>, locale: string): string => name[locale] ?? Object.values(name)[0] ?? '';

type Groups = Map<string, { lineRef: string; name: string }[]>;

/**
 * The shared core of "reorder" and "add a whole saved list" (workstream T): re-validates every prescription line now
 * (N `validateRxSelection`), adds the dispensable ones through `addRxLines`, and names each one that could not be
 * added with its reason into `out.notAdded`. Returns the id of the cart that now holds the lines.
 */
export async function addPrescribedGroups(
  groups: Groups,
  out: ReorderResult,
  input: { customerId: string; cartId: string | undefined; patient: Patient; ctx: RxContext },
): Promise<string | undefined> {
  const { customerId, cartId, patient, ctx } = input;
  const { added, notAdded } = out;
  let currentCartId = cartId;
  for (const [rxNumber, lines] of groups) {
    const nameOfRef = (ref: string) => lines.find((l) => l.lineRef === ref)?.name ?? '';
    let selection;
    try {
      selection = await validateRxSelection(patient, rxNumber, lines.map((l) => l.lineRef), ctx);
    } catch (error) {
      if (!(error instanceof RxNotFoundError)) throw error;
      for (const l of lines) notAdded.push({ name: l.name, reason: 'UNAVAILABLE' });
      continue;
    }
    for (const row of selection.refused) notAdded.push({ name: nameOfRef(row.lineRef), reason: REASON[row.status] ?? 'UNAVAILABLE' });
    if (selection.accepted.length === 0) continue;
    try {
      const { cart } = await addRxLines(customerId, currentCartId, rxNumber, selection.accepted, ctx);
      currentCartId = cart.id;
      for (const a of selection.accepted) added.push(nameOfRef(a.lineRef));
    } catch (error) {
      // The platform's own per-order limit refuses the whole update; say so per line instead of failing the reorder.
      if (!isLimitError(error)) throw error;
      for (const a of selection.accepted) notAdded.push({ name: nameOfRef(a.lineRef), reason: 'UNAVAILABLE' });
    }
  }
  return currentCartId;
}

/**
 * Reorder = re-run the prescription rules (N: `validateRxSelection`, now, not as they were when the order was
 * placed) for every line of a past order and add the lines that may still be dispensed through the same path as
 * "Add to cart" (`addRxLines`: the platform cart stays authoritative for prices). Every line that could not be added
 * is named with its reason: no refills, expired, out of stock, or unavailable (no longer on the prescription, the
 * prescription is gone, the platform's own limit refused). Nothing is dropped silently. Also answers the id of the
 * cart that now holds the lines (the first add may have created it), for the session.
 */
export async function reorderOrder(
  order: Pick<Order, 'lineItems'>,
  input: { customerId: string; cartId: string | undefined; patient: Patient; ctx: RxContext; locale: string },
): Promise<{ result: ReorderResult; cartId: string | undefined }> {
  const { customerId, cartId, patient, ctx, locale } = input;
  const added: string[] = [];
  const notAdded: ReorderResult['notAdded'] = [];
  const groups = new Map<string, { lineRef: string; name: string }[]>();
  for (const item of order.lineItems) {
    const name = nameOf(item.name, locale);
    const f = rxFieldsOf(item);
    if (!f) notAdded.push({ name, reason: 'UNAVAILABLE' });
    else groups.set(f.rxNumber, [...(groups.get(f.rxNumber) ?? []), { lineRef: f.rxLineRef, name }]);
  }

  const currentCartId = await addPrescribedGroups(groups, { added, notAdded }, { customerId, cartId, patient, ctx });
  return { result: { added, notAdded }, cartId: currentCartId };
}
