import 'server-only';
import { apiRoot } from '@/lib/ct/client';
import { checkShelfLife, isRefusal, type Refusal } from '@/lib/dispense/rules';
import type { Money } from '@/lib/types';

/**
 * Remaining shelf life (expiry-dated-supply). The promise ("minimum N months of shelf life on delivery") is the
 * product attribute `minRemainingShelfLifeDays`; the fact is the inventory entry custom field `expiryDate`
 * (one worst-case date per location, Q-039). The promise is a commitment derived from stock, the lot actually
 * supplied is recorded later on the order line (`lib/dispense/line-record.ts`); one never overwrites the other.
 * Stock figures are eventually consistent for a few seconds: fine for display, and the promise is re-checked
 * before dispatch (`promiseStillMet`).
 */

export const SHORT_DATED_CHANNEL_KEY = 'mlv-short-dated';

export interface Supply {
  sku: string;
  available: number;
  /** ISO date; absent for undated goods. */
  expiryDate?: string;
}

/** Inventory entries (no supply channel) for the SKUs, keyed by SKU. A SKU without an entry is not in the map. */
export async function getSupplyBySku(skus: string[]): Promise<Map<string, Supply>> {
  const out = new Map<string, Supply>();
  const unique = [...new Set(skus)].filter((s) => /^[\w.-]+$/.test(s));
  if (unique.length === 0) return out;
  const where = `sku in (${unique.map((s) => `"${s}"`).join(', ')}) and supplyChannel is not defined`;
  const { body } = await apiRoot.inventory().get({ queryArgs: { where, limit: 500 } }).execute();
  for (const entry of body.results) {
    const expiry = (entry.custom?.fields as { expiryDate?: unknown } | undefined)?.expiryDate;
    out.set(entry.sku, {
      sku: entry.sku,
      available: entry.availableQuantity,
      ...(typeof expiry === 'string' && expiry ? { expiryDate: expiry.slice(0, 10) } : {}),
    });
  }
  return out;
}

export type ShelfLifeOffer =
  /** Undated goods, or stock that meets the promise: nothing to show beyond the promise itself. */
  | { status: 'ok' }
  /** Cannot meet the standard promise but is offered on its own terms: actual expiry and its own price. */
  | { status: 'short-dated'; expiryDate: string; daysLeft: number; price: Money }
  /** Cannot meet the promise and has no short-dated price: not offered as normal stock; the reason is available. */
  | { status: 'excluded'; refusal: Refusal };

export interface ShelfLifeAssessmentInput {
  minRemainingShelfLifeDays: number | null;
  expiryDate?: string;
  today: string;
  /** Price on the `mlv-short-dated` price channel, when the variant has one. */
  shortDatedPrice?: Money | null;
}

/**
 * Presentation of dated stock. Stock that meets the promise (or is undated) is normal. Otherwise it is offered as
 * short-dated with its actual expiry and own price when such a price exists, else excluded with a reason.
 * Stock already past its date is never offered.
 */
export function assessShelfLife(i: ShelfLifeAssessmentInput): ShelfLifeOffer {
  const check = checkShelfLife({ minRemainingShelfLifeDays: i.minRemainingShelfLifeDays, expiryDate: i.expiryDate, today: i.today });
  if (!isRefusal(check)) return { status: 'ok' };
  const daysLeft = check.daysLeft ?? 0;
  if (i.shortDatedPrice && i.expiryDate && daysLeft > 0) return { status: 'short-dated', expiryDate: i.expiryDate, daysLeft, price: i.shortDatedPrice };
  return { status: 'excluded', refusal: check };
}

/**
 * Re-check before dispatch ("stock ages before dispatch"): an order placed against stock that met the promise is
 * checked again at picking, so the problem is raised before dispatch rather than discovered on receipt. `leadDays`
 * is the transit time to delivery. Returns the refusal when the promise can no longer be met, else null.
 */
export function promiseStillMet(i: { minRemainingShelfLifeDays: number | null; expiryDate?: string; today: string; leadDays?: number }): Refusal | null {
  const check = checkShelfLife({ minRemainingShelfLifeDays: i.minRemainingShelfLifeDays, expiryDate: i.expiryDate, today: i.today, deliveryLeadDays: i.leadDays });
  return isRefusal(check) ? check : null;
}

/** The price on `mlv-short-dated` from a product projection whose price channels were expanded. */
export function shortDatedPriceOf(prices: { value: { centAmount: number; currencyCode: string; fractionDigits?: number }; channel?: { obj?: { key?: string } } }[] | undefined, currency: string): Money | null {
  const price = (prices ?? []).find((p) => p.channel?.obj?.key === SHORT_DATED_CHANNEL_KEY && p.value.currencyCode === currency);
  return price ? { centAmount: price.value.centAmount, currencyCode: price.value.currencyCode, fractionDigits: price.value.fractionDigits ?? 2 } : null;
}
