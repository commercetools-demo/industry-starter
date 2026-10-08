// Shapes of the auto-refill pages (workstream T). Types and pure constants only: safe in client components.

/** The seeded Recurrence Policies (scripts/seed/data/recurrence.ts) as the buyer chooses them. */
export type Cadence = 'monthly' | 'quarterly';
export const CADENCES: readonly Cadence[] = ['monthly', 'quarterly'];
export const POLICY_KEY: Record<Cadence, string> = { monthly: 'mlv-monthly', quarterly: 'mlv-quarterly' };

/** commercetools `RecurringOrderState`. */
export type RefillState = 'Active' | 'Paused' | 'Expired' | 'Canceled' | 'Failed';

/** What the last scheduled check did (`malva-refill-log`). */
export type RefillOutcome = 'allowed' | 'skipped' | 'stopped';

/** Why a run did not go ahead; shown as words ("Last run: skipped, authorization expired"). */
export type RefillReason = 'authorization-expired' | 'authorization-exhausted' | 'ceiling' | 'prescription-missing' | 'payment-method-missing';

export interface RefillLogView {
  /** ISO instant of the check. */
  runAt: string;
  outcome: RefillOutcome;
  reason?: RefillReason;
}

export interface RefillLineView {
  name: string;
  quantity: number;
}

export interface RefillView {
  id: string;
  state: RefillState;
  /** The cadence as the buyer chose it; `other` for a schedule that was changed outside the storefront. */
  cadence: Cadence | 'other';
  /** ISO instant of the next refill; null when paused, ended or failed. */
  nextOrderAt: string | null;
  lastOrderAt: string | null;
  /** True when the next refill has been set to be skipped. */
  skipping: boolean;
  lines: RefillLineView[];
  /** Whether the price is looked up again at each refill (`Dynamic`) or fixed when it was set up. */
  priceMode: 'Dynamic' | 'Fixed';
  /** Last scheduled check, when there is one. */
  lastRun: RefillLogView | null;
}

export type RefillAction = 'pause' | 'resume' | 'skip' | 'cancel';

export interface EnableRefillBody {
  orderId: string;
  lineIds: string[];
  cadence: Cadence;
}
