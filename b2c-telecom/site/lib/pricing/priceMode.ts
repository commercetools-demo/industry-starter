// Fixed or Dynamic price selection mode per monthly line (D-013). Pure: no I/O.
import { MONTHLY_POLICY_KEY } from '@/lib/config/pricing';
import type { LineRecurrence, PriceSelectionMode, TermMonths } from '@/lib/types';

export function termFromContractTerm(value: 'month-to-month' | '12-months' | '24-months'): TermMonths {
  if (value === '12-months') return 12;
  if (value === '24-months') return 24;
  return 0;
}

/** Committed terms keep the price they started with; month-to-month follows the catalog. */
export function priceModeForTerm(term: TermMonths): PriceSelectionMode {
  return term === 0 ? 'Dynamic' : 'Fixed';
}

export type MonthlyLineKind = 'plan' | 'addon' | 'equipment-rental' | 'installment' | 'lease';

/** Planner default for non-plan kinds: add-ons and rented equipment are Dynamic; installments and leases (D-015) are Fixed. */
export function lineRecurrence(kind: MonthlyLineKind, term: TermMonths): LineRecurrence {
  const priceSelectionMode: PriceSelectionMode =
    kind === 'plan' ? priceModeForTerm(term) : kind === 'addon' || kind === 'equipment-rental' ? 'Dynamic' : 'Fixed';
  return { policyKey: MONTHLY_POLICY_KEY, priceSelectionMode };
}

/** Message keys (messages `pricing.mode.*`); the Fixed copy takes `{months}`. */
export function priceModeCopyKey(mode: PriceSelectionMode): 'pricing.mode.fixed' | 'pricing.mode.dynamic' {
  return mode === 'Fixed' ? 'pricing.mode.fixed' : 'pricing.mode.dynamic';
}
