import type { Money } from '@/lib/types';
import { buildSchedule, type ScheduleInput } from './schedule';

const usd = (centAmount: number): Money => ({ centAmount, currencyCode: 'USD' });
const input = (patch: Partial<ScheduleInput> = {}): ScheduleInput => ({
  offerKey: 'malva-offer-cable-100',
  sku: 'MLV-CBL-100-24M',
  termMonths: 24,
  quantity: 1,
  standing: usd(3999),
  introApplied: false,
  monthToMonth: usd(4999),
  oneTimeDueNow: usd(2500),
  orderDate: '2026-10-07',
  ...patch,
});
const ok = (patch: Partial<ScheduleInput>) => {
  const result = buildSchedule(input(patch));
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
};

describe('first-order promotion in the schedule', () => {
  it('first month free: month 1 is its own period at $0, then the standing price to the end of the term', () => {
    const schedule = ok({ firstOrderDiscount: usd(3999) });
    expect(schedule.periods.map((p) => [p.kind, p.fromMonth, p.toMonth, p.monthlyAmount.centAmount])).toEqual([
      ['intro', 1, 1, 0],
      ['standing', 2, 24, 3999],
    ]);
    // Due at order is what the cart charges now: the free month plus the activation fee
    expect(schedule.dueAtOrder.centAmount).toBe(2500);
    expect(schedule.totalContractValue?.centAmount).toBe(3999 * 23);
    expect(schedule.introEndsOn).toBe('2026-11-07');
  });

  it('a part-month discount (a code) shows as a reduced first period, never as a recurring discount', () => {
    const schedule = ok({ firstOrderDiscount: usd(500) });
    expect(schedule.periods[0]).toMatchObject({ kind: 'intro', months: 1, monthlyAmount: { centAmount: 3499 } });
    expect(schedule.periods[1]).toMatchObject({ kind: 'standing', months: 23, monthlyAmount: { centAmount: 3999 } });
  });

  it('scales with the quantity for Due at order and the total', () => {
    const schedule = ok({ firstOrderDiscount: usd(3999), quantity: 2, oneTimeDueNow: usd(5000) });
    expect(schedule.dueAtOrder.centAmount).toBe(5000);
    expect(schedule.totalContractValue?.centAmount).toBe(3999 * 23 * 2);
  });

  it('month-to-month: the first month, then open-ended standing', () => {
    const schedule = ok({ termMonths: 0, sku: 'MLV-CBL-100-M2M', standing: usd(4999), firstOrderDiscount: usd(4999), monthToMonth: null, oneTimeDueNow: usd(0) });
    expect(schedule.periods.map((p) => [p.kind, p.months, p.monthlyAmount.centAmount])).toEqual([
      ['intro', 1, 0],
      ['standing', 0, 4999],
    ]);
    expect(schedule.openEnded).toBe(true);
    expect(schedule.dueAtOrder.centAmount).toBe(0);
  });

  it('a discount larger than the price never goes below zero; none or zero leaves the schedule as it was', () => {
    expect(ok({ firstOrderDiscount: usd(99999) }).periods[0]?.monthlyAmount.centAmount).toBe(0);
    expect(ok({}).periods).toHaveLength(1);
    expect(ok({ firstOrderDiscount: usd(0) }).periods).toHaveLength(1);
  });

  it('the stored format stays version 1', () => {
    expect(ok({ firstOrderDiscount: usd(3999) }).v).toBe(1);
  });
});
