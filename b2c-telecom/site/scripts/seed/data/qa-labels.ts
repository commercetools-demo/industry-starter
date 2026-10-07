// Fixtures of the QA orders (workstream S): the Broadband Facts labels stored on the order and the price schedules. Shaped like the
// app's own records (`LabelSnapshot` v1, `PriceSchedule` v1) but written without importing app code, so the stored text stays what
// an order of that day would have held. Placeholders `malva.example` / `1-800-MALVA-00` are deliberate.
import type { BroadbandLabelData, LabelSnapshot } from '../../../lib/types';

type Money = { centAmount: number; currencyCode: string };
const usd = (centAmount: number): Money => ({ centAmount, currencyCode: 'USD' });
export const dollars = (centAmount: number): string => `$${(centAmount / 100).toFixed(2)}`;

interface LabelFacts {
  id: string;
  planName: string;
  kind: string;
  down: number;
  up: number;
  latencyMs: number;
  data: string;
}

/** Plan facts by offer key; a plan not listed gets a generic label (the page only needs a well-formed one). */
const FACTS: Record<string, LabelFacts> = {
  'malva-offer-cable-500': { id: 'MLV-CA-101', planName: 'Cable 500', kind: 'Cable internet', down: 500, up: 20, latencyMs: 14, data: 'Unlimited' },
  'malva-offer-cable-100': { id: 'MLV-CA-100', planName: 'Cable 100', kind: 'Cable internet', down: 100, up: 10, latencyMs: 16, data: 'Unlimited' },
  'malva-offer-phone-unlimited': { id: 'MLV-PH-301', planName: 'Unlimited', kind: 'Phone plan', down: 150, up: 20, latencyMs: 30, data: 'Unlimited' },
  'malva-offer-phone-essential': { id: 'MLV-PH-101', planName: 'Essential', kind: 'Phone plan', down: 50, up: 10, latencyMs: 35, data: '5 GB' },
  'malva-offer-wireless-5g': { id: 'MLV-AIR-201', planName: 'Air 5G', kind: 'Home wireless internet', down: 300, up: 30, latencyMs: 25, data: 'Unlimited' },
};

export interface QaLabelInput {
  offerKey: string;
  sku: string;
  monthlyCents: number;
  termMonths: number;
  activationCents?: number;
}

export function qaLabel(input: QaLabelInput): BroadbandLabelData {
  const facts = FACTS[input.offerKey] ?? { id: `MLV-QA-${input.offerKey.slice(-6).toUpperCase()}`, planName: input.offerKey, kind: 'Plan', down: 100, up: 10, latencyMs: 20, data: 'Unlimited' };
  const term = input.termMonths === 0 ? 'month-to-month' : `${input.termMonths}-month agreement`;
  return {
    id: facts.id,
    planName: facts.planName,
    kind: facts.kind,
    price: dollars(input.monthlyCents),
    priceNote: `per month, ${term}`,
    monthlyFees: [{ k: 'Equipment rental', v: '$0.00' }],
    oneTime: input.activationCents ? [{ k: 'Activation fee', v: dollars(input.activationCents) }] : [{ k: 'Activation fee', v: '$0.00' }],
    etf: input.termMonths === 0 ? 'None' : `${dollars(1000)} for each month remaining`,
    discounts: 'None',
    speeds: [
      { k: 'Typical download', v: `${facts.down} Mbps` },
      { k: 'Typical upload', v: `${facts.up} Mbps` },
      { k: 'Typical latency', v: `${facts.latencyMs} ms` },
    ],
    data: facts.data,
  };
}

export function qaLabelSnapshot(entries: (QaLabelInput & { takenAt: string })[]): string {
  const value: LabelSnapshot = {
    v: 1,
    takenAt: entries[0]?.takenAt ?? new Date().toISOString(),
    locale: 'en-US',
    currencyCode: 'USD',
    labels: entries.map((entry) => ({ sku: entry.sku, offerKey: entry.offerKey, label: qaLabel(entry) })),
  };
  return JSON.stringify(value);
}

// ---------------------------------------------------------------------------------------------------------------------------
// Dates (UTC, date-only)

const pad = (n: number): string => String(n).padStart(2, '0');
function iso(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = total - year * 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return iso(new Date(Date.UTC(year, month, Math.min(d, last))));
}
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return iso(new Date(Date.UTC(y, m - 1, d + days)));
}

// ---------------------------------------------------------------------------------------------------------------------------
// Price schedules

interface Segment {
  months: number; // 0 = until cancelled
  cents: number;
  kind: 'intro' | 'standing' | 'step';
}

export interface QaScheduleInput {
  offerKey: string;
  sku: string;
  termMonths: number;
  quantity: number;
  orderDate: string;
  segments: Segment[];
  afterTermCents?: number;
  priceMode: 'Fixed' | 'Dynamic';
}

export function qaSchedule(input: QaScheduleInput): Record<string, unknown> {
  let from = 1;
  const periods = input.segments.map((segment, index) => {
    const openEnded = segment.months === 0;
    const toMonth = openEnded ? 0 : from + segment.months - 1;
    const period = {
      index: index + 1,
      fromMonth: from,
      toMonth,
      months: segment.months,
      startsOn: addMonths(input.orderDate, from - 1),
      endsOn: openEnded ? '9999-12-31' : addDays(addMonths(input.orderDate, toMonth), -1),
      monthlyAmount: usd(segment.cents),
      kind: segment.kind,
    };
    from = toMonth + 1;
    return period;
  });
  const openEnded = input.termMonths === 0;
  return {
    v: 1,
    offerKey: input.offerKey,
    sku: input.sku,
    termMonths: input.termMonths,
    quantity: input.quantity,
    currencyCode: 'USD',
    priceMode: input.priceMode,
    orderDate: input.orderDate,
    periods,
    openEnded,
    totalContractValue: openEnded ? null : usd(input.segments.reduce((sum, segment) => sum + segment.months * segment.cents, 0) * input.quantity),
    dueAtOrder: usd((periods[0]?.monthlyAmount.centAmount ?? 0) * input.quantity),
    afterTerm: openEnded || input.afterTermCents === undefined ? null : { startsOn: addMonths(input.orderDate, input.termMonths), monthlyAmount: usd(input.afterTermCents), basis: 'month-to-month-price' },
    introEndsOn: input.segments[0]?.kind === 'intro' ? addMonths(input.orderDate, input.segments[0].months) : null,
    status: 'active',
  };
}

/**
 * The schedule of a plan line. Cable 500 on 24 months has the three-period fixture (intro month, standing price, a step in the last
 * year: the agreed prices of the design); every other plan has one standing period.
 */
export function qaScheduleFor(line: { offerKey: string; sku: string; termMonths: number; monthlyCents: number; afterTermCents?: number }, orderDate: string): Record<string, unknown> {
  const base = { offerKey: line.offerKey, sku: line.sku, termMonths: line.termMonths, quantity: 1, orderDate, priceMode: line.termMonths === 0 ? ('Dynamic' as const) : ('Fixed' as const), ...(line.afterTermCents !== undefined ? { afterTermCents: line.afterTermCents } : {}) };
  if (line.offerKey === 'malva-offer-cable-500' && line.termMonths === 24) {
    return qaSchedule({
      ...base,
      segments: [
        { months: 1, cents: 2999, kind: 'intro' },
        { months: 12, cents: line.monthlyCents, kind: 'standing' },
        { months: 11, cents: line.monthlyCents + 500, kind: 'step' },
      ],
    });
  }
  return qaSchedule({ ...base, segments: [{ months: line.termMonths === 0 ? 0 : line.termMonths, cents: line.monthlyCents, kind: 'standing' }] });
}

export const qaSchedules = (schedules: Record<string, unknown>[]): string => JSON.stringify({ v: 1, schedules });
