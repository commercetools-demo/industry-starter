import { checkCeiling, checkReplenishmentRun, isRefusal } from '@/lib/dispense/rules';
import type { RefillReason } from '@/lib/refill-types';

/**
 * The gate in front of every generated refill (subscriptions-and-recurring-orders; prescription-bound-supply: a
 * schedule is not an entitlement). Pure: the runner reads the data and hands it in, so every case is a table test.
 * The platform generates the orders on schedule; this decides, ahead of the run, whether the run may go ahead.
 *
 * Precedence, strictest first:
 *  1. a prescription with no refill left          -> the series STOPS (cancel): it cannot recover on its own;
 *  2. a prescription that has expired or is gone  -> the series is PAUSED, the run is skipped and the reason recorded
 *     (the buyer can resume after getting a new prescription; resuming re-checks);
 *  3. no saved payment method                     -> PAUSED (the refill could not be paid);
 *  4. a per-order or calendar-month ceiling       -> only THIS run is skipped; the series continues.
 * `today` is the DAY OF THE RUN (the next order's date), not the day of the check: an authorization can lapse between
 * the check and the run, and it is the run that dispenses.
 */

export interface RunLine {
  lineRef: string;
  /** Prescribed quantity of one fill. */
  qty: number;
  /** Packs this refill dispenses (the unit the ceilings count in). */
  packs: number;
  /** The prescription as stored; null when it no longer exists or is not the patient's. */
  rx: { refillsLeft: number; expiresAt?: string } | null;
  perOrderMax: number | null;
  periodCeiling: number | null;
  /** Packs of this line's SKU the patient already received in the calendar month of the run. */
  usedInPeriod: number;
}

export interface RunInput {
  lines: RunLine[];
  /** ISO date of the run. */
  today: string;
  hasPaymentMethod: boolean;
}

export type RunAction = 'skip' | 'pause' | 'cancel';

export type RunDecision =
  | { run: true }
  | {
      run: false;
      /** What to do with the recurring order. */
      action: RunAction;
      /** What the buyer reads: a skipped run, or a series that has stopped. */
      outcome: 'skipped' | 'stopped';
      reason: RefillReason;
      /** The prescription lines that caused it (references only). */
      lineRefs: string[];
    };

const blocked = (action: RunAction, outcome: 'skipped' | 'stopped', reason: RefillReason, lineRefs: string[]): RunDecision => ({ run: false, action, outcome, reason, lineRefs });

export function decideRun(input: RunInput): RunDecision {
  const exhausted: string[] = [];
  const lapsed: string[] = [];
  const capped: string[] = [];
  for (const line of input.lines) {
    if (!line.rx) {
      lapsed.push(line.lineRef);
      continue;
    }
    const gate = checkReplenishmentRun({ refillsLeft: line.rx.refillsLeft, expiresAt: line.rx.expiresAt, lineQty: line.qty, today: input.today });
    if (!gate.run) {
      (gate.reason === 'EXPIRED' ? lapsed : exhausted).push(line.lineRef);
      continue;
    }
    const ceiling = checkCeiling({ requested: line.packs, perOrderMax: line.perOrderMax, periodCeiling: line.periodCeiling, usedInPeriod: line.usedInPeriod });
    if (isRefusal(ceiling)) capped.push(line.lineRef);
  }
  if (exhausted.length > 0) return blocked('cancel', 'stopped', 'authorization-exhausted', exhausted);
  if (lapsed.length > 0) {
    const missing = input.lines.some((l) => lapsed.includes(l.lineRef) && !l.rx);
    return blocked('pause', 'skipped', missing ? 'prescription-missing' : 'authorization-expired', lapsed);
  }
  if (!input.hasPaymentMethod) return blocked('pause', 'skipped', 'payment-method-missing', []);
  if (capped.length > 0) return blocked('skip', 'skipped', 'ceiling', capped);
  return { run: true };
}
