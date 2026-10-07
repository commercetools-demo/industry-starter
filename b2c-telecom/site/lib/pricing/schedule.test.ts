import { INTRO_DEFS } from '@/lib/config/pricing';
import type { Money, PriceSchedule } from '@/lib/types';
import { addMonths } from './dates';
import {
  amendFrom,
  amountDueOn,
  buildSchedule,
  cancelSchedule,
  dueTransitions,
  markAmended,
  monthsRemaining,
  parseSchedules,
  periodOn,
  serializeSchedules,
  totalContractValue,
  type ScheduleInput,
} from './schedule';

// Fixture prices are written here on purpose: the tests never read the catalog.
const usd = (centAmount: number): Money => ({ centAmount, currencyCode: 'USD' });
const ORDER = '2026-10-07';

const unlimited24: ScheduleInput = {
  offerKey: 'malva-offer-phone-unlimited',
  sku: 'MLV-PHN-UNL-24M',
  termMonths: 24,
  quantity: 1,
  standing: usd(4500),
  introApplied: false,
  monthToMonth: usd(5000),
  oneTimeDueNow: usd(0),
  orderDate: ORDER,
};
const cable100: ScheduleInput = {
  offerKey: 'malva-offer-cable-100',
  sku: 'MLV-CBL-100-24M',
  termMonths: 24,
  quantity: 1,
  standing: usd(3999),
  introApplied: true,
  monthToMonth: usd(4999),
  oneTimeDueNow: usd(2500),
  orderDate: ORDER,
};

function built(input: ScheduleInput): PriceSchedule {
  const result = buildSchedule(input);
  if (!result.ok) throw new Error(`schedule expected, got ${result.error.code}`);
  return result.value;
}

describe('buildSchedule', () => {
  it('Every period priced: Unlimited 24-month has a year-1 and a year-2 period', () => {
    const s = built(unlimited24);
    expect(s.periods).toHaveLength(2);
    expect(s.periods[0]).toMatchObject({ index: 1, fromMonth: 1, toMonth: 12, months: 12, monthlyAmount: usd(4500), startsOn: '2026-10-07', endsOn: '2027-10-06', kind: 'standing' });
    expect(s.periods[1]).toMatchObject({ index: 2, fromMonth: 13, toMonth: 24, months: 12, monthlyAmount: usd(5000), startsOn: '2027-10-07', endsOn: '2028-10-06', kind: 'step' });
    expect(s.priceMode).toBe('Fixed');
    expect(s.openEnded).toBe(false);
  });

  it('Total contract value stated: sum of period months times amount times quantity', () => {
    expect(built(unlimited24).totalContractValue).toEqual(usd(12 * 4500 + 12 * 5000));
    expect(built(unlimited24).totalContractValue).toEqual(usd(114000));
    expect(totalContractValue(built({ ...unlimited24, quantity: 2 }))).toEqual(usd(228000));
  });

  it('End of term price disclosed: afterTerm has the month-to-month amount and its start date', () => {
    const s = built(unlimited24);
    expect(s.afterTerm).toEqual({ startsOn: addMonths(ORDER, 24), monthlyAmount: usd(5000), basis: 'month-to-month-price' });
    expect(s.afterTerm?.startsOn).toBe('2028-10-07');
    const missing = buildSchedule({ ...unlimited24, monthToMonth: null });
    expect(missing).toEqual({ ok: false, error: { code: 'NO_STANDING_PRICE', detail: 'afterTerm' } });
  });

  it('Cable 100 24-month: 6 months at the intro amount, then 18 months at the standing amount', () => {
    const s = built(cable100);
    expect(s.periods.map((p) => [p.kind, p.months, p.monthlyAmount.centAmount])).toEqual([
      ['intro', 6, 2999],
      ['standing', 18, 3999],
    ]);
    expect(s.introEndsOn).toBe(addMonths(ORDER, 6));
    expect(s.totalContractValue).toEqual(usd(6 * 2999 + 18 * 3999));
    expect(s.dueAtOrder).toEqual(usd(2999 + 2500));
  });

  it('month-to-month has one open-ended period and no total', () => {
    const s = built({ ...unlimited24, offerKey: 'malva-offer-cable-500', termMonths: 0, standing: usd(6999), monthToMonth: null });
    expect(s.openEnded).toBe(true);
    expect(s.priceMode).toBe('Dynamic');
    expect(s.periods).toHaveLength(1);
    expect(s.periods[0]).toMatchObject({ fromMonth: 1, toMonth: 0, months: 0, endsOn: '9999-12-31' });
    expect(s.totalContractValue).toBeNull();
    expect(s.afterTerm).toBeNull();
    expect(monthsRemaining(s, '2027-01-01')).toBe(0);
  });

  it('Period with no price: a term beyond the schedule is PERIOD_NOT_PRICED, not priced from the last period', () => {
    expect(buildSchedule({ ...unlimited24, termMonths: 36 })).toEqual({ ok: false, error: { code: 'PERIOD_NOT_PRICED', detail: '25' } });
    expect(buildSchedule({ ...unlimited24, offerKey: 'malva-offer-cable-500', termMonths: 36 })).toEqual({ ok: false, error: { code: 'PERIOD_NOT_PRICED', detail: 'term' } });
  });

  it('introApplied=false shows no intro period', () => {
    const s = built({ ...cable100, introApplied: false });
    expect(s.periods).toHaveLength(1);
    expect(s.periods[0]).toMatchObject({ kind: 'standing', months: 24, monthlyAmount: usd(3999) });
    expect(s.introEndsOn).toBeNull();
  });

  it('quantity 3 multiplies totals and dueAtOrder includes oneTimeDueNow', () => {
    const s = built({ ...cable100, quantity: 3, oneTimeDueNow: usd(7500) });
    expect(s.totalContractValue).toEqual(usd(3 * (6 * 2999 + 18 * 3999)));
    expect(s.dueAtOrder).toEqual(usd(3 * 2999 + 7500));
    expect(s.periods[0]?.monthlyAmount).toEqual(usd(2999));
  });

  it('rejects a non-positive standing price and an impossible order date', () => {
    expect(buildSchedule({ ...unlimited24, standing: usd(0) })).toEqual({ ok: false, error: { code: 'NO_STANDING_PRICE' } });
    expect(buildSchedule({ ...unlimited24, orderDate: '2026-02-30' })).toEqual({ ok: false, error: { code: 'BAD_DATE', detail: '2026-02-30' } });
    expect(buildSchedule(unlimited24, '2026-10-01')).toMatchObject({ ok: false, error: { code: 'BAD_DATE' } });
  });

  it('an intro amount not below the standing price is refused', () => {
    expect(buildSchedule({ ...cable100, standing: usd(2999) })).toMatchObject({ ok: false, error: { code: 'INTRO_NOT_BELOW_STANDING' } });
  });
});

describe('period lookups', () => {
  const s = built(cable100);
  it('periodOn and amountDueOn pick the period by date and revert to the after-term price', () => {
    expect(periodOn(s, '2026-10-07')?.kind).toBe('intro');
    expect(periodOn(s, '2027-04-06')?.kind).toBe('intro');
    expect(periodOn(s, '2027-04-07')?.kind).toBe('standing');
    expect(periodOn(s, '2026-10-06')).toBeNull();
    expect(amountDueOn(s, '2027-04-07')).toEqual(usd(3999));
    expect(amountDueOn(s, '2028-10-07')).toEqual(usd(4999));
    expect(amountDueOn(s, '2026-01-01')).toEqual(usd(0));
  });
  it('monthsRemaining counts whole billing months left', () => {
    expect(monthsRemaining(s, '2026-10-07')).toBe(24);
    expect(monthsRemaining(s, '2026-11-06')).toBe(24);
    expect(monthsRemaining(s, '2026-11-07')).toBe(23);
    expect(monthsRemaining(s, '2028-10-07')).toBe(0);
    expect(monthsRemaining(s, '2026-01-01')).toBe(24);
  });
});

describe('cancel, amend, serialise', () => {
  it('cancelSchedule keeps the periods and sets the status', () => {
    const s = built(unlimited24);
    const c = cancelSchedule(s, '2027-02-01');
    expect(c.status).toBe('cancelled');
    expect(c.cancelledOn).toBe('2027-02-01');
    expect(c.periods).toEqual(s.periods);
  });

  it('Mid term change reprices the remainder: months before the amendment unchanged, remaining months repriced', () => {
    const s = built(unlimited24);
    const amendedOn = addMonths(ORDER, 13); // month 14
    const result = amendFrom(s, amendedOn, usd(4000));
    if (!result.ok) throw new Error('amend expected');
    const v = result.value;
    expect(v.periods.map((p) => [p.fromMonth, p.toMonth, p.monthlyAmount.centAmount])).toEqual([
      [1, 12, 4500],
      [13, 13, 5000],
      [14, 24, 4500],
    ]);
    expect(v.periods.map((p) => p.index)).toEqual([1, 2, 3]);
    expect(v.periods[2]).toMatchObject({ startsOn: '2027-11-07', endsOn: '2028-10-06' });
    expect(v.totalContractValue).toEqual(usd(12 * 4500 + 5000 + 11 * 4500));
    expect(v.supersedes).toBe(ORDER);
    expect(v.amendedOn).toBe(amendedOn);
    expect(v.status).toBe('active');
    expect(markAmended(s, amendedOn).status).toBe('amended');
  });

  it('amend keeps an intro period whole and never creates a new one', () => {
    const s = built(cable100);
    const result = amendFrom(s, addMonths(ORDER, 8), usd(3500));
    if (!result.ok) throw new Error('amend expected');
    expect(result.value.periods.map((p) => [p.kind, p.fromMonth, p.toMonth, p.monthlyAmount.centAmount])).toEqual([
      ['intro', 1, 6, 2999],
      ['standing', 7, 8, 3999],
      ['standing', 9, 24, 3500],
    ]);
  });

  it('amend refuses a date outside the schedule or a cancelled schedule', () => {
    const s = built(unlimited24);
    expect(amendFrom(s, '2026-09-01', usd(4000))).toMatchObject({ ok: false, error: { code: 'BAD_DATE' } });
    expect(amendFrom(s, '2028-11-01', usd(4000))).toMatchObject({ ok: false, error: { code: 'BAD_DATE', detail: 'after-term' } });
    expect(amendFrom(cancelSchedule(s, '2027-01-01'), '2027-02-01', usd(4000))).toMatchObject({ ok: false });
    expect(amendFrom(s, '2027-02-01', usd(0))).toMatchObject({ ok: false, error: { code: 'NO_STANDING_PRICE' } });
  });

  it('amend of a month-to-month schedule reprices the open-ended period from the amendment', () => {
    const m2m = built({ ...unlimited24, offerKey: 'malva-offer-cable-500', termMonths: 0, standing: usd(6999), monthToMonth: null });
    const result = amendFrom(m2m, addMonths(ORDER, 3), usd(7499));
    if (!result.ok) throw new Error('amend expected');
    expect(result.value.periods.map((p) => [p.fromMonth, p.toMonth, p.monthlyAmount.centAmount])).toEqual([
      [1, 3, 6999],
      [4, 0, 7499],
    ]);
  });

  it('Schedule fixed at commitment: serialise then parse returns identical periods regardless of catalog price', () => {
    const s = built(unlimited24);
    const json = serializeSchedules([s]);
    // the catalog price later changes: a new commitment is priced differently, the stored one is not touched
    const later = built({ ...unlimited24, standing: usd(9900) });
    expect(later.periods[0]?.monthlyAmount).toEqual(usd(9900));
    const parsed = parseSchedules(json);
    expect(parsed).toEqual({ ok: true, value: [s] });
    expect(json.startsWith('{"v":1,"schedules":[')).toBe(true);
  });

  it('Campaign withdrawn after purchase: a stored schedule parsed after the config is emptied is unchanged', () => {
    const s = built(cable100);
    expect(s.periods[0]?.kind).toBe('intro');
    const json = serializeSchedules([s]);
    const saved = INTRO_DEFS.splice(0, INTRO_DEFS.length);
    try {
      const parsed = parseSchedules(json);
      expect(parsed).toEqual({ ok: true, value: [s] });
      expect(built({ ...cable100, introApplied: true }).periods[0]?.kind).toBe('standing'); // only new purchases are affected
    } finally {
      INTRO_DEFS.push(...saved);
    }
  });

  it("parseSchedules('{\"v\":2}') returns BAD_VERSION and other malformed input is named", () => {
    expect(parseSchedules('{"v":2}')).toEqual({ ok: false, error: 'BAD_VERSION' });
    expect(parseSchedules('not json')).toEqual({ ok: false, error: 'BAD_JSON' });
    expect(parseSchedules('{"v":1,"schedules":[{"v":1}]}')).toEqual({ ok: false, error: 'BAD_SHAPE' });
    expect(parseSchedules('{"v":1}')).toEqual({ ok: false, error: 'BAD_SHAPE' });
    expect(parseSchedules('[]')).toEqual({ ok: false, error: 'BAD_SHAPE' });
  });
});

describe('dueTransitions', () => {
  const intro = built(cable100);
  const stepped = built(unlimited24);
  const list = [
    { orderNumber: 'A-1', schedule: intro },
    { orderNumber: 'A-2', schedule: stepped },
  ];

  it('Reverts without customer action: dueTransitions reports intro-ends', () => {
    expect(dueTransitions(list, '2027-04-07')).toEqual([{ orderNumber: 'A-1', sku: 'MLV-CBL-100-24M', kind: 'intro-ends', on: '2027-04-07', newAmount: usd(3999) }]);
  });
  it('reports step and term-ends on the right dates', () => {
    expect(dueTransitions(list, '2027-10-07')).toEqual([{ orderNumber: 'A-2', sku: 'MLV-PHN-UNL-24M', kind: 'step', on: '2027-10-07', newAmount: usd(5000) }]);
    expect(dueTransitions(list, '2028-10-07').map((t) => [t.orderNumber, t.kind])).toEqual([
      ['A-1', 'term-ends'],
      ['A-2', 'term-ends'],
    ]);
    expect(dueTransitions(list, '2027-01-01')).toEqual([]);
  });
  it('ignores cancelled and amended schedules', () => {
    const ignored = [
      { orderNumber: 'A-1', schedule: cancelSchedule(intro, '2027-01-01') },
      { orderNumber: 'A-2', schedule: markAmended(stepped, '2027-01-01') },
    ];
    expect(dueTransitions(ignored, '2027-04-07')).toEqual([]);
    expect(dueTransitions(ignored, '2027-10-07')).toEqual([]);
  });
});
