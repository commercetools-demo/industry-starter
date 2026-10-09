/**
 * Benefit allowance (benefit-allowance-drawdown). Pure types and date rules: no server imports, so the
 * account page and tests can use them.
 *
 * A member has one `malva-allowance` Custom Object per monthly cycle (key `<patientRef>_<YYYY-MM>`; the plan's
 * `|` separator is not a legal Custom Object key character). Amounts are integer cents. The cycle is the UTC
 * calendar month. An allowance is spendable only on this order flow: there is no withdraw, cash-out or transfer.
 */

export interface AllowanceCycle {
  patientRef: string;
  /** `YYYY-MM`. */
  cycle: string;
  currency: string;
  /** What this cycle was granted. */
  granted: number;
  /** Drawn by orders, net of restores. */
  consumed: number;
  /** Forfeited at the end of the cycle (never carried over). */
  lapsed: number;
  /** What the member is granted each cycle; the reload copies it forward. */
  monthly: number;
  /** Order id -> amount drawn, written in the same versioned write as `consumed` (idempotency on the order id). */
  drawdowns: Record<string, number>;
  /** Order ids whose draw was given back (cancel/return), so a restore applies once. */
  restored: string[];
}

/** One entry per order that drew from an allowance: finds the cycle again on cancel (key = order id). */
export interface AllowanceLedgerEntry {
  orderId: string;
  patientRef: string;
  cycle: string;
  amount: number;
  at: string;
  restoredAt?: string;
  /** `restored` = back in an open cycle; `unrecoverable` = the cycle had closed (the amount was forfeited). */
  outcome?: 'restored' | 'unrecoverable';
}

export interface AllowanceView {
  cycle: string;
  currency: string;
  granted: number;
  consumed: number;
  /** What the member can still draw now. */
  balance: number;
  /** ISO date (first day of the next cycle) on which `lapsing` is forfeited. */
  forfeitsOn: string;
  /** What will be forfeited then (= the balance; no carry-over). */
  lapsing: number;
  /** The previous cycle's forfeited amount, when there was one. */
  lastLapsed: { cycle: string; amount: number } | null;
}

export const cycleOf = (at: Date): string => `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}`;

/** The cycle after `cycle` (`2026-12` -> `2027-01`). */
export function nextCycle(cycle: string): string {
  const [y, m] = cycle.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

/** ISO date on which the cycle ends and its remainder is forfeited. */
export const forfeitDate = (cycle: string): string => `${nextCycle(cycle)}-01`;

export const allowanceKey = (patientRef: string, cycle: string): string => `${patientRef}_${cycle}`;

export const balanceOf = (c: Pick<AllowanceCycle, 'granted' | 'consumed' | 'lapsed'>): number => Math.max(0, c.granted - c.consumed - c.lapsed);
