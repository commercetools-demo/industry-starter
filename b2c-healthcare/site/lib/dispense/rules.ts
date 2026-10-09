/**
 * Dispensing rules as pure functions (prescription-bound-supply, dispensing-quantity-limit, expiry-dated-supply).
 * No server imports and no commercetools types: the server code reads the data and hands it in, so every
 * scenario is a table test. Dates are ISO `YYYY-MM-DD` strings; "today" is always passed in.
 *
 * Enforcement is in the BFF only: a request made directly against the commerce API is not checked by these
 * functions. See README, "Known gap: limits bypassable through the API".
 */

export type RefusalReason = 'NO_REFILLS' | 'EXPIRED' | 'OUT_OF_STOCK' | 'CEILING' | 'SHELF_LIFE';
export type Verdict = 'OK' | RefusalReason;

/** One refusal: the reason plus whatever the message needs ("N available", the ceiling, the actual expiry). */
export interface Refusal {
  reason: RefusalReason;
  /** Quantity still available under the rule that refused (units for an authorization, packs for stock and ceilings). */
  remaining: number;
  /** CEILING: the ceiling that applies. */
  ceiling?: number;
  /** CEILING: `order` = per-order limit (native inventory limit), `period` = calendar-month ceiling. */
  scope?: 'order' | 'period';
  /** SHELF_LIFE: the actual expiry date of the stock. */
  expiryDate?: string;
  /** SHELF_LIFE: whole days of shelf life left. */
  daysLeft?: number;
}

export type Check = { reason: 'OK'; remaining: number } | Refusal;

export const isRefusal = (c: Check): c is Refusal => c.reason !== 'OK';

// ---------------------------------------------------------------- dates

const DAY_MS = 86_400_000;
const parseDay = (iso: string): number => Date.parse(`${iso}T00:00:00Z`);

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseDay(to) - parseDay(from)) / DAY_MS);
}

/** Calendar-month period id (`2026-10`) of an ISO date or instant. The period is stated in the UI; it is never rolling. */
export const periodOf = (isoDateOrInstant: string): string => isoDateOrInstant.slice(0, 7);

export const todayIso = (now: Date = new Date()): string => now.toISOString().slice(0, 10);

// ---------------------------------------------------------------- authorization

export interface AuthorizationInput {
  refillsLeft: number;
  /** ISO date after which the prescription cannot be dispensed; absent = no expiry. */
  expiresAt?: string;
  /** Units the authorization permits per fill (the prescribed quantity of the line). */
  lineQty: number;
  /** Units requested; defaults to one fill (`lineQty`). */
  requestedQty?: number;
  today: string;
}

/**
 * An authorization allows supply only inside its window and with enough remaining quantity (all or nothing).
 * Expiry is checked first: an out-of-window authorization is refused as EXPIRED even when it is also exhausted.
 * Remaining quantity = refills left x the quantity of one fill.
 */
export function checkAuthorization(i: AuthorizationInput): Check {
  const remaining = Math.max(0, i.refillsLeft) * i.lineQty;
  if (i.expiresAt !== undefined && i.today > i.expiresAt) return { reason: 'EXPIRED', remaining: 0 };
  const requested = i.requestedQty ?? i.lineQty;
  if (remaining < requested) return { reason: 'NO_REFILLS', remaining };
  return { reason: 'OK', remaining };
}

export type ReplenishmentDecision =
  | { run: true }
  /** The run does not place an order; `reason` is recorded on the standing order so a blocked run does not look like an outage. */
  | { run: false; reason: 'EXPIRED' | 'NO_REFILLS'; recordedAs: string };

/**
 * Gate for a standing replenishment (subscription / recurring order): a schedule is not an entitlement.
 * Checked before each generated order; when the authorization has lapsed or is exhausted the run is skipped and the
 * reason is returned for T to record.
 */
export function checkReplenishmentRun(i: Omit<AuthorizationInput, 'requestedQty'>): ReplenishmentDecision {
  const check = checkAuthorization(i);
  if (check.reason === 'OK') return { run: true };
  const reason = check.reason === 'EXPIRED' ? 'EXPIRED' : 'NO_REFILLS';
  return { run: false, reason, recordedAs: reason === 'EXPIRED' ? 'authorization-expired' : 'authorization-exhausted' };
}

// ---------------------------------------------------------------- stock

export function checkStock(i: { available: number; requested: number }): Check {
  const available = Math.max(0, i.available);
  return available < i.requested ? { reason: 'OUT_OF_STOCK', remaining: available } : { reason: 'OK', remaining: available };
}

// ---------------------------------------------------------------- ceilings

export interface CeilingInput {
  /** Packs requested. */
  requested: number;
  /** Per-order limit (the native inventory limit / product attribute `maxQtyPerOrder`); null = none. */
  perOrderMax: number | null;
  /** Per-party, per-calendar-month ceiling; null = none. */
  periodCeiling: number | null;
  /** Packs this party already received in the current period (from the dispense ledger). */
  usedInPeriod: number;
}

/**
 * Two ceilings, both stated in the refusal: the per-order limit (a property of the product, also enforced
 * by the platform) and the cumulative calendar-month ceiling for the party (computed outside the platform).
 * The refusal names the one that leaves the smaller amount.
 */
export function checkCeiling(i: CeilingInput): Check {
  const left: { scope: 'order' | 'period'; ceiling: number; remaining: number }[] = [];
  if (i.perOrderMax !== null) left.push({ scope: 'order', ceiling: i.perOrderMax, remaining: i.perOrderMax });
  if (i.periodCeiling !== null) left.push({ scope: 'period', ceiling: i.periodCeiling, remaining: Math.max(0, i.periodCeiling - i.usedInPeriod) });
  if (left.length === 0) return { reason: 'OK', remaining: Number.POSITIVE_INFINITY };
  const tightest = left.reduce((a, b) => (b.remaining < a.remaining ? b : a));
  if (i.requested > tightest.remaining) return { reason: 'CEILING', remaining: tightest.remaining, ceiling: tightest.ceiling, scope: tightest.scope };
  return { reason: 'OK', remaining: tightest.remaining };
}

// ---------------------------------------------------------------- shelf life

export interface ShelfLifeInput {
  /** Product promise: minimum days of shelf life on delivery; null/0 = no promise. */
  minRemainingShelfLifeDays: number | null;
  /** Inventory entry `expiryDate` (single worst-case date per location); undefined = undated goods. */
  expiryDate?: string;
  today: string;
  /** Days between today and delivery; the promise is judged at delivery. Default 0. */
  deliveryLeadDays?: number;
}

/** Undated goods are unaffected. Dated stock must still have `minRemainingShelfLifeDays` left on delivery. */
export function checkShelfLife(i: ShelfLifeInput): Check {
  if (!i.expiryDate) return { reason: 'OK', remaining: Number.POSITIVE_INFINITY };
  const daysLeft = daysBetween(i.today, i.expiryDate) - (i.deliveryLeadDays ?? 0);
  const need = i.minRemainingShelfLifeDays ?? 0;
  if (daysLeft < need || daysLeft < 0) return { reason: 'SHELF_LIFE', remaining: 0, expiryDate: i.expiryDate, daysLeft: Math.max(0, daysLeft) };
  return { reason: 'OK', remaining: Number.POSITIVE_INFINITY };
}

/** "Minimum N months of shelf life on delivery": whole months, rounded down, at least 1 while any promise exists. */
export function shelfLifeMonths(days: number | null): number | null {
  if (!days || days <= 0) return null;
  return Math.max(1, Math.floor(days / 30));
}

/** First refusal in the order given (the caller orders them by what the patient can act on); null when all pass. */
export function firstRefusal(checks: Check[]): Refusal | null {
  return checks.find(isRefusal) ?? null;
}
