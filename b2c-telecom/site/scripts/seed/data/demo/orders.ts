// Demo orders = what the customers already hold (D-021). Created from carts with an order number; immutable once created.
// The price schedule follows L's PriceSchedule format (`{"v":1,"schedules":[...]}`), computed here without importing app code.
import type { DemoOrderDraft } from '../../types';
import { ADDON_PRICES, PLAN_PRICES, TERM_MONTHS, type TermToken } from '../prices';

type Money = { centAmount: number; currencyCode: string };
const usd = (centAmount: number): Money => ({ centAmount, currencyCode: 'USD' });

function parts(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number);
  return [y, m, d];
}
function iso(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
}
/** `2026-03-07` + 24 months = `2028-03-07` (UTC, day kept). */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = parts(date);
  return iso(y, m + months, d);
}
export function addDays(date: string, days: number): string {
  const [y, m, d] = parts(date);
  return iso(y, m, d + days);
}

export interface ScheduleSpec {
  offerKey: string;
  sku: string;
  term: TermToken;
  monthlyCents: number;
  /** Month-to-month price the line falls back to after a committed term. */
  afterTermCents?: number;
  orderDate: string;
  priceMode: 'Fixed' | 'Dynamic';
}

export function scheduleFor(spec: ScheduleSpec): Record<string, unknown> {
  const months = TERM_MONTHS[spec.term];
  const openEnded = months === 0;
  const monthly = usd(spec.monthlyCents);
  const endsOn = openEnded ? addMonths(spec.orderDate, 1200) : addDays(addMonths(spec.orderDate, months), -1);
  return {
    v: 1,
    offerKey: spec.offerKey,
    sku: spec.sku,
    termMonths: months,
    quantity: 1,
    currencyCode: 'USD',
    priceMode: spec.priceMode,
    orderDate: spec.orderDate,
    periods: [{ index: 1, fromMonth: 1, toMonth: openEnded ? 0 : months, months: openEnded ? 0 : months, startsOn: spec.orderDate, endsOn, monthlyAmount: monthly, kind: 'standing' }],
    openEnded,
    totalContractValue: openEnded ? null : usd(spec.monthlyCents * months),
    dueAtOrder: monthly,
    afterTerm: openEnded || spec.afterTermCents === undefined ? null : { startsOn: addDays(endsOn, 1), monthlyAmount: usd(spec.afterTermCents), basis: 'month-to-month-price' },
    introEndsOn: null,
    status: 'active',
  };
}

function plan(offerKey: string, sku: string, term: TermToken): { sku: string; usd: number; m2m: number } {
  const variants = PLAN_PRICES[offerKey];
  const found = variants.find((v) => v.sku === sku && v.term === term);
  if (!found) throw new Error(`No variant ${sku} on ${offerKey}`);
  const m2m = variants.find((v) => v.term === 'M2M')?.usd ?? found.usd;
  return { sku, usd: found.usd, m2m };
}

const CABLE = plan('malva-offer-cable-500', 'MLV-CBL-500-24M', '24M');
const UNLIMITED = plan('malva-offer-phone-unlimited', 'MLV-PHN-UNL-M2M', 'M2M');
const WIRELESS = plan('malva-offer-wireless-5g', 'MLV-AIR-5G-12M', '12M');
const SPOTIFY = ADDON_PRICES['malva-offer-spotify'];

const schedules = (...list: ScheduleSpec[]): string => JSON.stringify({ v: 1, schedules: list.map(scheduleFor) });

export const demoOrders: DemoOrderDraft[] = [
  {
    key: 'malva-demo-order-0001',
    orderNumber: 'MLV-DEMO-0001',
    customer: 'malva-demo-alex-rivera',
    currency: 'USD',
    country: 'US',
    serviceStartDate: '2026-03-12',
    priceSchedule: schedules({ offerKey: 'malva-offer-cable-500', sku: CABLE.sku, term: '24M', monthlyCents: CABLE.usd, afterTermCents: CABLE.m2m, orderDate: '2026-03-07', priceMode: 'Fixed' }),
    lines: [{ sku: CABLE.sku, quantity: 1, offerKey: 'malva-offer-cable-500', recurrencePolicy: 'malva-monthly', priceSelectionMode: 'Fixed' }],
  },
  {
    key: 'malva-demo-order-0002',
    orderNumber: 'MLV-DEMO-0002',
    customer: 'malva-demo-alex-rivera',
    currency: 'USD',
    country: 'US',
    serviceStartDate: '2025-06-03',
    priceSchedule: schedules(
      { offerKey: 'malva-offer-phone-unlimited', sku: UNLIMITED.sku, term: 'M2M', monthlyCents: UNLIMITED.usd, orderDate: '2025-06-03', priceMode: 'Dynamic' },
      { offerKey: 'malva-offer-spotify', sku: SPOTIFY.sku, term: 'M2M', monthlyCents: SPOTIFY.usd, orderDate: '2025-06-03', priceMode: 'Dynamic' },
    ),
    lines: [
      { sku: UNLIMITED.sku, quantity: 1, offerKey: 'malva-offer-phone-unlimited', recurrencePolicy: 'malva-monthly', priceSelectionMode: 'Dynamic' },
      { sku: SPOTIFY.sku, quantity: 1, offerKey: 'malva-offer-spotify', recurrencePolicy: 'malva-monthly', priceSelectionMode: 'Dynamic', parentLine: 0 },
    ],
  },
  {
    key: 'malva-demo-order-0003',
    orderNumber: 'MLV-DEMO-0003',
    customer: 'malva-demo-jo-kim',
    currency: 'USD',
    country: 'US',
    serviceStartDate: '2026-05-20',
    priceSchedule: schedules({ offerKey: 'malva-offer-wireless-5g', sku: WIRELESS.sku, term: '12M', monthlyCents: WIRELESS.usd, afterTermCents: WIRELESS.m2m, orderDate: '2026-05-20', priceMode: 'Fixed' }),
    lines: [{ sku: WIRELESS.sku, quantity: 1, offerKey: 'malva-offer-wireless-5g', recurrencePolicy: 'malva-monthly', priceSelectionMode: 'Fixed' }],
  },
];
