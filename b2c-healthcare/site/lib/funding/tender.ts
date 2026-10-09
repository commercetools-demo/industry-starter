import { forfeitDate, type AllowanceView } from '@/lib/funding/allowance-types';
import { splitBasket, type BasketLine } from '@/lib/funding/eligibility';
import type { Money, TenderView } from '@/lib/types';

/**
 * Tender order (Q-064): allowance, then the restricted instrument, then the card. Pure arithmetic on integer cents
 * over the payable total the platform calculated; used by the server reads that build `TenderView` and by
 * `placeOrder`. The browser never computes any of it.
 */

export const METHOD_ALLOWANCE = 'allowance';
export const METHOD_RESTRICTED = 'restricted-health-account';

export interface TenderPlan {
  total: number;
  allowance: number;
  restricted: number;
  card: number;
}

export interface PlanInput {
  /** The payable total (cart total, gross when taxed), including delivery. */
  total: number;
  /** What the member can draw now (0 without an allowance). */
  allowanceBalance: number;
  /** What the restricted instrument may pay: the eligible subtotal. */
  eligibleSubtotal: number;
  /** The patient chose to use the restricted instrument. */
  restrictedChosen: boolean;
}

/** Allowance first (up to the balance), then the restricted instrument (up to the eligible subtotal), the card pays the rest. */
export function planTender({ total, allowanceBalance, eligibleSubtotal, restrictedChosen }: PlanInput): TenderPlan {
  const allowance = Math.min(Math.max(0, allowanceBalance), Math.max(0, total));
  const afterAllowance = total - allowance;
  const restricted = restrictedChosen ? Math.min(afterAllowance, Math.max(0, eligibleSubtotal)) : 0;
  return { total, allowance, restricted, card: afterAllowance - restricted };
}

export interface LineSettlement {
  id: string;
  allowance: number;
  restricted: number;
  card: number;
}

/**
 * Which instrument settled which line, for the order record. The allowance is spread over delivery first, then the
 * ineligible lines, then the eligible ones (so the eligible value stays available to the restricted instrument);
 * the restricted instrument takes eligible lines in order; the card takes whatever is left. The parts of each line
 * add up to the line's amount.
 */
export function allocateTender(lines: BasketLine[], plan: TenderPlan): LineSettlement[] {
  const out: LineSettlement[] = lines.map((l) => ({ id: l.id, allowance: 0, restricted: 0, card: 0 }));
  const linesTotal = lines.reduce((sum, l) => sum + l.amount, 0);
  const other = Math.max(0, plan.total - linesTotal);
  let allowance = Math.max(0, plan.allowance - other);
  const room = lines.map((l) => l.amount);
  const take = (indexes: number[], amount: number, key: 'allowance' | 'restricted'): number => {
    let left = amount;
    for (const i of indexes) {
      const part = Math.min(left, room[i]!);
      out[i]![key] += part;
      room[i]! -= part;
      left -= part;
    }
    return left;
  };
  const eligible = lines.map((l, i) => (l.eligible ? i : -1)).filter((i) => i >= 0);
  const ineligible = lines.map((l, i) => (l.eligible ? -1 : i)).filter((i) => i >= 0);
  allowance = take(ineligible, allowance, 'allowance');
  take(eligible, allowance, 'allowance');
  take(eligible, plan.restricted, 'restricted');
  lines.forEach((_l, i) => {
    out[i]!.card = room[i]!;
  });
  return out;
}

export interface TenderViewInput {
  currencyCode: string;
  fractionDigits: number;
  total: number;
  allowance: AllowanceView | null;
  lines: BasketLine[];
  /** A restricted-instrument Payment is on the cart. */
  restrictedChosen: boolean;
}

/** The `TenderView` shown on the cart and in the checkout summary. */
export function buildTenderView(input: TenderViewInput): TenderView {
  const money = (centAmount: number): Money => ({ centAmount, currencyCode: input.currencyCode, fractionDigits: input.fractionDigits });
  const split = splitBasket(input.lines);
  const available = split.eligibleSubtotal > 0;
  const balance = input.allowance?.balance ?? 0;
  const plan = planTender({ total: input.total, allowanceBalance: balance, eligibleSubtotal: split.eligibleSubtotal, restrictedChosen: input.restrictedChosen && available });
  // What the instrument would pay if it were used (shown before the patient chooses it).
  const wouldPay = planTender({ total: input.total, allowanceBalance: balance, eligibleSubtotal: split.eligibleSubtotal, restrictedChosen: available }).restricted;
  return {
    allowance: input.allowance ? { balance: money(balance), applies: money(plan.allowance), forfeitsOn: forfeitDate(input.allowance.cycle) } : null,
    restricted: {
      available,
      ...(available ? {} : { reason: 'none-eligible' as const }),
      eligibleSubtotal: money(split.eligibleSubtotal),
      applies: money(wouldPay),
      chosen: input.restrictedChosen && available,
    },
    card: money(plan.card),
    needsOtherTender: money(Math.max(0, input.total - Math.min(input.total, split.eligibleSubtotal))),
  };
}
