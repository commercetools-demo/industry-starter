import { ENDED_RECURRING_STATES } from '@/lib/config/account';
import { addMonths } from '@/lib/pricing/dates';
import { periodOn } from '@/lib/pricing/schedule';
import type { ActivePlan, ContractRow, Money, Order, OrderLine, RecurringSummary } from '@/lib/types';

// What the customer holds and pays, derived only from their orders and recurring orders (D-021). Pure: no I/O, no clock (callers pass
// `today` as YYYY-MM-DD, UTC).

const PLAN_KINDS: readonly OrderLine['kind'][] = ['internet-plan', 'phone-plan'];

/**
 * An order counts while it is not cancelled and not every one of its recurring orders has ended. `recurring` is `null` when the
 * recurring-order read failed: the orders alone decide then.
 */
export function isActiveOrder(order: Order, recurring: RecurringSummary[] | null): boolean {
  if (order.status === 'cancelled') return false;
  const own = (recurring ?? []).filter((summary) => summary.originOrderId === order.id);
  return own.length === 0 || !own.every((summary) => ENDED_RECURRING_STATES.includes(summary.state));
}

/** The amount this line bills on `today`: the stored schedule when it covers the date, else the line total (never the live catalog). */
export function currentMonthly(order: Order, line: OrderLine, today: string): Money {
  const schedule = order.schedules.find((candidate) => candidate.sku === line.sku && candidate.status === 'active');
  if (schedule) {
    const period = periodOn(schedule, today);
    if (period) return { centAmount: period.monthlyAmount.centAmount * line.quantity, currencyCode: period.monthlyAmount.currencyCode };
    if (schedule.afterTerm && today >= schedule.afterTerm.startsOn) {
      return { centAmount: schedule.afterTerm.monthlyAmount.centAmount * line.quantity, currencyCode: schedule.afterTerm.monthlyAmount.currencyCode };
    }
  }
  return line.total;
}

/** Every recurring line of every active order, newest start first, plans before add-ons, then by name. Paid-off device payments are not rows. */
export function deriveContractRows(orders: Order[], recurring: RecurringSummary[] | null, today: string): ContractRow[] {
  const rows: ContractRow[] = [];
  for (const order of orders) {
    if (!isActiveOrder(order, recurring)) continue;
    for (const line of order.lines) {
      if (!line.recurring) continue;
      const acquisitionEnd = line.acquisition?.endDate ?? null;
      if (acquisitionEnd !== null && acquisitionEnd < today) continue;
      const term = line.termMonths;
      const endsOn = acquisitionEnd ?? (term !== null && term > 0 ? addMonths(order.serviceStartDate, term) : null);
      rows.push({
        key: `${order.orderNumber}:${line.id}`,
        orderNumber: order.orderNumber,
        sku: line.sku,
        name: line.name,
        deviceVariant: line.deviceVariant,
        family: line.family,
        startedOn: order.serviceStartDate,
        termMonths: term,
        endsOn,
        monthly: currentMonthly(order, line, today),
      });
    }
  }
  const rank = (row: ContractRow): number => (row.family === 'cable' || row.family === 'wireless' || row.family === 'phone' ? 0 : 1);
  return rows.sort((a, b) => {
    if (a.startedOn !== b.startedOn) return a.startedOn < b.startedOn ? 1 : -1;
    return rank(a) - rank(b) || a.name.localeCompare(b.name, 'en');
  });
}

export function deriveMonthlyBill(rows: ContractRow[], currencyCode: string): Money {
  return { centAmount: rows.reduce((sum, row) => sum + row.monthly.centAmount, 0), currencyCode: rows[0]?.monthly.currencyCode ?? currencyCode };
}

/** Earliest `nextOrderAt` among the Active recurring orders (ISO text), or null. */
export function nextBillDate(recurring: RecurringSummary[]): string | null {
  const dates = recurring.flatMap((summary) => (summary.state === 'Active' && summary.nextOrderAt ? [summary.nextOrderAt] : []));
  return dates.length === 0 ? null : dates.reduce((earliest, date) => (date < earliest ? date : earliest));
}

/**
 * One entry per plan line of an active order with the label stored on that order (matched by sku). Add-ons, equipment and devices have
 * no label and never appear; a plan without a stored label has `label: null`.
 */
export function deriveActivePlans(orders: Order[], recurring: RecurringSummary[] | null, today: string): ActivePlan[] {
  return deriveContractRows(orders, recurring, today).flatMap((row) => {
    const order = orders.find((candidate) => candidate.orderNumber === row.orderNumber);
    const line = order?.lines.find((candidate) => `${row.orderNumber}:${candidate.id}` === row.key);
    if (!order || !line || !PLAN_KINDS.includes(line.kind)) return [];
    return [{ key: row.key, orderNumber: order.orderNumber, sku: line.sku, name: line.name, label: order.labels?.find((entry) => entry.sku === line.sku)?.label ?? null }];
  });
}
