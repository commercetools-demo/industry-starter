// Reconciliation of generated recurring orders with the price agreed at the first order. Promotions apply to the first order only, so every
// recurring order must charge, per line, the standing amount stored on the first order's schedule times the quantity. A line whose total
// differs is reported (a promotion that reached a recurring order, a Dynamic line that followed a catalog change, a price that moved).
// Pure: the job in scripts/jobs/recurring-reconcile.ts reads the orders and calls this.
import type { Money, PriceSchedule } from '@/lib/types';

export interface GeneratedLine {
  sku: string;
  quantity: number;
  total: Money;
}

export interface GeneratedOrder {
  orderNumber: string;
  createdAt: string;
  lines: GeneratedLine[];
}

export interface Mismatch {
  orderNumber: string;
  sku: string;
  expected: Money;
  actual: Money;
  /** actual minus expected: negative = charged less than agreed. */
  difference: number;
}

/** The monthly amount a schedule agreed for a sku at its standing price, per unit. */
export function standingAmountOf(schedules: readonly PriceSchedule[], sku: string): Money | null {
  const schedule = schedules.find((candidate) => candidate.sku === sku && candidate.status === 'active');
  return schedule?.periods.find((period) => period.kind === 'standing')?.monthlyAmount ?? null;
}

/**
 * Lines of generated orders that do not charge the standing amount of the first order's schedule. A line with no schedule entry
 * (add-ons, equipment: their price is the line's own) is not compared.
 */
export function findMismatches(schedules: readonly PriceSchedule[], generated: readonly GeneratedOrder[]): Mismatch[] {
  return generated.flatMap((order) =>
    order.lines.flatMap((line): Mismatch[] => {
      const standing = standingAmountOf(schedules, line.sku);
      if (!standing) return [];
      const expected: Money = { centAmount: standing.centAmount * line.quantity, currencyCode: standing.currencyCode };
      return line.total.centAmount === expected.centAmount ? [] : [{ orderNumber: order.orderNumber, sku: line.sku, expected, actual: line.total, difference: line.total.centAmount - expected.centAmount }];
    }),
  );
}
