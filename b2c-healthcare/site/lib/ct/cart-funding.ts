import 'server-only';
import type { Cart as CtCart, CartUpdateAction } from '@commercetools/platform-sdk';
import { withCartRetry } from '@/lib/api-retry';
import { apiRoot } from '@/lib/ct/client';
import type { Patient } from '@/lib/ct/patient';
import { getFundingResolver, normalizeScheme, type FundingResolver } from '@/lib/funding/resolver';
import { log } from '@/lib/log';
import { coveredCentsOf, unitPriceOf } from '@/lib/mappers/cart';

/**
 * Payer cost-share on the cart (payer-and-patient-cost-share).
 *
 * The platform price of a line is the LIST price. The resolver says how much of it the plan covers; the cart keeps
 * the patient's share as the line's EXTERNAL price (`setLineItemPrice` with `externalPrice`), so the cart total, the
 * order total and the card amount are the amount the patient owes, and the covered share is stored on the line
 * (`custom.coveredAmount`, per unit). The covered share is NOT a Cart Discount.
 *
 * Re-resolution happens on every cart change, at cart load and again before the order is created. Because
 * `recalculate` does not re-price a line with an external price, every re-resolution first sends
 * `setLineItemPrice` without `externalPrice` (back to the platform price) and recalculates; the list price is then
 * the platform's current one (so a changed catalog price comes through), and the resolver is asked afresh.
 *
 * If the resolver fails the outcome is `unresolved`: the cart is left as is, nothing is priced from the list price
 * on the patient's behalf, and the callers disable checkout (and `placeOrder` refuses).
 */

export interface FundingOutcome {
  cart: CtCart;
  /** The resolver could not answer. */
  unresolved: boolean;
}

/** Lines priced externally go back to the platform price, so `recalculate` sees the current list price. */
export function revertActions(cart: CtCart): CartUpdateAction[] {
  return cart.lineItems.filter((item) => item.priceMode === 'ExternalPrice').map((item): CartUpdateAction => ({ action: 'setLineItemPrice', lineItemId: item.id }));
}

/** Recalculate with the product data refreshed, after external prices were reverted. */
export function recalcActions(cart: CtCart): CartUpdateAction[] {
  return [...revertActions(cart), { action: 'recalculate', updateProductData: true }];
}

const hasCover = (cart: CtCart): boolean => cart.lineItems.some((item) => item.priceMode === 'ExternalPrice' || coveredCentsOf(item) !== undefined);

/** The list unit price of a line: the external price plus the covered share, or the platform price. */
function listUnitOf(item: CtCart['lineItems'][number]): number {
  if (item.priceMode === 'ExternalPrice') return item.price.value.centAmount + (coveredCentsOf(item) ?? 0);
  return unitPriceOf(item).centAmount;
}

async function readCart(id: string): Promise<CtCart> {
  const { body } = await apiRoot.carts().withId({ ID: id }).get().execute();
  return body;
}

/**
 * Resolves the cart's cost-share and writes it: external price per covered line, `coveredAmount` per line. Returns
 * the cart as it is afterwards. A patient without a scheme (and a cart without cover) is a no-op. Never throws for a
 * resolver failure (it answers `unresolved`); platform errors propagate.
 */
export async function applyFunding(cart: CtCart, patient: Pick<Patient, 'patientRef' | 'fundingScheme'>, resolver: FundingResolver = getFundingResolver()): Promise<FundingOutcome> {
  if (cart.lineItems.length === 0) return { cart, unresolved: false };
  if (!normalizeScheme(patient.fundingScheme) && !hasCover(cart)) return { cart, unresolved: false };

  const lines = cart.lineItems.map((item) => ({ sku: item.variant.sku ?? '', unit: listUnitOf(item), quantity: item.quantity }));
  let resolution;
  try {
    resolution = await resolver.resolve({ patientRef: patient.patientRef, fundingScheme: patient.fundingScheme ?? null }, lines);
  } catch (error) {
    log.error('funding', 'cost-share could not be resolved', error instanceof Error ? error : { name: typeof error });
    return { cart, unresolved: true };
  }

  const build = (current: CtCart): CartUpdateAction[] => {
    const actions: CartUpdateAction[] = [];
    current.lineItems.forEach((item, index) => {
      const row = resolution.perLine[index];
      if (!row) return;
      const external = item.priceMode === 'ExternalPrice';
      const currencyCode = item.price.value.currencyCode;
      if (row.covered > 0) {
        if (!external || item.price.value.centAmount !== row.owed) actions.push({ action: 'setLineItemPrice', lineItemId: item.id, externalPrice: { currencyCode, centAmount: row.owed } });
      } else if (external) {
        actions.push({ action: 'setLineItemPrice', lineItemId: item.id });
      }
      if (resolution.scheme && coveredCentsOf(item) !== row.covered) {
        actions.push({ action: 'setLineItemCustomField', lineItemId: item.id, name: 'coveredAmount', value: { currencyCode, centAmount: row.covered } });
      }
    });
    return actions;
  };

  if (build(cart).length === 0) return { cart, unresolved: false };
  const updated = await withCartRetry(async () => {
    const current = await readCart(cart.id);
    // The lines of the fresh read must still be the ones that were resolved; otherwise the caller re-reads and tries again.
    if (current.lineItems.length !== cart.lineItems.length || current.lineItems.some((item, i) => item.id !== cart.lineItems[i].id)) return current;
    const actions = build(current);
    if (actions.length === 0) return current;
    const { body } = await apiRoot.carts().withId({ ID: current.id }).post({ body: { version: current.version, actions } }).execute();
    return body;
  });
  return { cart: updated, unresolved: false };
}

/**
 * Resolves the cost-share again right before the order is created: list prices come from the platform
 * afresh, the resolver answers again, the cart is rewritten if the figures moved. `changed` tells the caller the cart
 * is not the one it read. A patient without a scheme and without cover on the cart is untouched.
 */
export async function refreshFunding(cart: CtCart, patient: Pick<Patient, 'patientRef' | 'fundingScheme'>, resolver?: FundingResolver): Promise<FundingOutcome & { changed: boolean }> {
  if (cart.lineItems.length === 0 || (!normalizeScheme(patient.fundingScheme) && !hasCover(cart))) return { cart, unresolved: false, changed: false };
  const recalculated = await withCartRetry(async () => {
    const current = await readCart(cart.id);
    const { body } = await apiRoot.carts().withId({ ID: current.id }).post({ body: { version: current.version, actions: recalcActions(current) } }).execute();
    return body;
  });
  const funded = await applyFunding(recalculated, patient, resolver);
  return { ...funded, changed: true };
}
