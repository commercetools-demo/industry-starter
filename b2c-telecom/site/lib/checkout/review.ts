import type { CheckoutReview, CheckoutState, Money } from '@/lib/types';
import { computeServiceStart } from './serviceStart';

const sum = (amounts: Money[], currencyCode: string): Money => ({ centAmount: amounts.reduce((total, amount) => total + amount.centAmount, 0), currencyCode });

/**
 * Review data, derived from the cart state alone (schedules and labels ride on the mapped plan lines, M/L): due today is the cart's total,
 * "monthly after today" is each recurring line at its second period (or its line total without a schedule), the contract total is the
 * sum of L's `totalContractValue` of the committed plans. Pure: the server and the client derive the same review from the same state.
 */
export function buildReview(state: CheckoutState, today: string): CheckoutReview {
  const { cart } = state;
  const currency = cart.currencyCode;
  const after = cart.lines
    .filter((line) => line.chargeType === 'recurring' && line.kind !== 'fee')
    .map((line): Money => {
      const periods = line.schedule?.periods ?? [];
      const next = periods[1] ?? periods[0];
      return next ? { centAmount: next.monthlyAmount.centAmount * line.quantity, currencyCode: currency } : line.total;
    });
  const totals = cart.lines.flatMap((line) => (line.schedule && !line.schedule.openEnded && line.schedule.totalContractValue ? [line.schedule.totalContractValue] : []));
  return {
    state,
    serviceStartDate: computeServiceStart(cart.lines, today),
    dueToday: cart.summary.total,
    monthlyAfterToday: sum(after, currency),
    contractTotal: totals.length > 0 ? sum(totals, currency) : null,
  };
}
