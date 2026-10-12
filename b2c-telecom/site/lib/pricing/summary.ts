// The order summary, defined once. Every surface that shows "Due today" (bundle, checkout, finder price strip, confirmation) reads
// these figures and these rows, so the rows add up to Due today and "Then monthly" is the same number everywhere.
//
// Rules (pricing-consistency):
//  - Due today is what the engine charges for the order placed now, tax included when the rate is not part of the price.
//  - Then monthly is what recurring orders will charge: the engine-selected recurring price of each recurring line times quantity.
//    Promotions apply to the first order only (every Cart Discount is NonRecurringOrdersOnly), so no promotion is subtracted from it.
//  - The summed rows are the net line subtotals, the order-level discount (negative), shipping and tax that is added on top.
//    "You save" (all promotions) is informational and is NOT one of the summed rows.
import type { CartLine, CartSummary, Money } from '@/lib/types';

export type SummaryRowId = 'plans' | 'addons' | 'devices' | 'oneTime' | 'orderDiscount' | 'shipping' | 'tax';

export interface SummaryRow {
  id: SummaryRowId;
  /** Signed: the order-level discount is negative. */
  amount: Money;
}

const sumOf = (amounts: Money[], currencyCode: string): Money => ({ centAmount: amounts.reduce((total, amount) => total + amount.centAmount, 0), currencyCode });

/** What recurring orders will charge: the standing price of every recurring (non-fee) line times its quantity. */
export function thenMonthlyOf(lines: readonly CartLine[], currencyCode: string): Money {
  return sumOf(
    lines.filter((line) => line.chargeType === 'recurring' && line.kind !== 'fee').map((line) => ({ centAmount: line.unitListPrice.centAmount * line.quantity, currencyCode })),
    currencyCode,
  );
}

/** Tax that is added on top of the total (null when the rate is part of the price, or when there is no taxed price yet). */
export function taxAddedOf(totalPrice: Money, taxedGross: Money | null): Money | null {
  if (!taxedGross || taxedGross.centAmount === totalPrice.centAmount) return null;
  return { centAmount: taxedGross.centAmount - totalPrice.centAmount, currencyCode: totalPrice.currencyCode };
}

/** The rows above Due today, in order, without the zero ones. */
export function summaryRows(summary: CartSummary): SummaryRow[] {
  const rows: SummaryRow[] = [
    { id: 'plans', amount: summary.plans },
    { id: 'addons', amount: summary.addons },
    { id: 'devices', amount: summary.devicesMonthly },
    { id: 'oneTime', amount: summary.oneTime },
    { id: 'orderDiscount', amount: { ...summary.orderDiscount, centAmount: -summary.orderDiscount.centAmount } },
    ...(summary.shipping ? [{ id: 'shipping' as const, amount: summary.shipping }] : []),
    ...(summary.taxAdded ? [{ id: 'tax' as const, amount: summary.taxAdded }] : []),
  ];
  return rows.filter((row) => row.amount.centAmount !== 0);
}

/** Sum of the rows: equals `summary.dueToday` for a cart the engine priced. */
export function rowsSum(summary: CartSummary): Money {
  return sumOf(
    summaryRows(summary).map((row) => row.amount),
    summary.dueToday.currencyCode,
  );
}


