import 'server-only';
import { CONTAINERS, queryObjects } from '@/lib/ct/custom-objects';
import type { LedgerEntry } from '@/lib/dispense/ledger-types';
import { checkCeiling, periodOf, type Check } from '@/lib/dispense/rules';

/**
 * Per-party, per-calendar-month ceilings (dispensing-quantity-limit). Native inventory limits cannot know who is
 * buying or what they ordered last week, so the running count is derived from the dispense ledger, which
 * `consumeAuthorization` writes once per placed order. The period is the calendar month, stated in the UI;
 * rolling windows are not used. The ceiling belongs to the patient (the receiving party), not the account.
 */

const safe = (v: string) => v.replace(/[^\w-]/g, '');

/** The month a date or instant falls in (`YYYY-MM`). */
export const monthOf = (isoDateOrInstant: string): string => periodOf(isoDateOrInstant);

/** Packs of `sku` the patient received in `period` (cancelled orders restored by `restoreAuthorization` do not count). */
export async function getUsedInPeriod(patientRef: string, sku: string, period: string): Promise<number> {
  const entries = await queryObjects<LedgerEntry>(CONTAINERS.dispenseLedger, `value(patientRef="${safe(patientRef)}" and period="${safe(period)}")`);
  let used = 0;
  for (const { value } of entries) {
    if (value.restoredAt) continue;
    for (const line of value.lines) if (line.sku === sku) used += line.packs;
  }
  return used;
}

/** All SKUs at once (one ledger read) for a patient and month: `sku -> packs`. */
export async function getUsedBySku(patientRef: string, period: string): Promise<Map<string, number>> {
  const entries = await queryObjects<LedgerEntry>(CONTAINERS.dispenseLedger, `value(patientRef="${safe(patientRef)}" and period="${safe(period)}")`);
  const used = new Map<string, number>();
  for (const { value } of entries) {
    if (value.restoredAt) continue;
    for (const line of value.lines) used.set(line.sku, (used.get(line.sku) ?? 0) + line.packs);
  }
  return used;
}

export interface CeilingRequest {
  patientRef: string;
  sku: string;
  packs: number;
  perOrderMax: number | null;
  periodCeiling: number | null;
  /** Date of the supply; selects the month. */
  at: string;
}

/**
 * Checks one line against both ceilings, counting what the patient already received this month. Used when the
 * prescription card is built, again when the cart loads (a lowered ceiling reaches an open cart) and by
 * `consumeAuthorization` at order creation.
 */
export async function checkLineCeiling(r: CeilingRequest): Promise<Check> {
  const usedInPeriod = r.periodCeiling === null ? 0 : await getUsedInPeriod(r.patientRef, r.sku, monthOf(r.at));
  return checkCeiling({ requested: r.packs, perOrderMax: r.perOrderMax, periodCeiling: r.periodCeiling, usedInPeriod });
}

/**
 * The per-month ceiling of a product. v1 default: the same number as the per-order limit (`maxQtyPerOrder`), so a
 * patient can receive at most that many packs of the item per calendar month. Absent attribute = no ceiling.
 */
export const periodCeilingFor = (maxQtyPerOrder: number | null): number | null => maxQtyPerOrder;
