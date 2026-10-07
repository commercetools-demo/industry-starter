// What U writes onto an order right after it exists (spec term-phased-price-schedule and broadband-facts-label): the price schedule of every
// plan line and the label snapshot. Built from the ORDER's creation date and the order's own prices, never from the cart view or today's
// catalog, so the stored promise cannot drift. Pure: no I/O.
import { INSTALL_LEAD_DAYS_CABLE } from '@/lib/config/pricing';
import type { CartLine, LabelSnapshot, Locale, Offer, PriceSchedule, ScheduleError, TermMonths } from '@/lib/types';
import { addDays } from './dates';
import { discountKeyFor, introDefFor } from './introPeriod';
import { buildLabel, buildLabelSnapshot, formatLabelMoney } from './label';
import { LABEL_STRINGS } from './labelStrings';
import { buildSchedule, serializeSchedules } from './schedule';

/** An order line read exactly like a cart line (the same mapper), so the figures are the engine's. */
export type StampLine = Pick<
  CartLine,
  'id' | 'offerKey' | 'sku' | 'kind' | 'name' | 'quantity' | 'termMonths' | 'chargeType' | 'unitListPrice' | 'unitPrice' | 'total' | 'appliedDiscountKeys' | 'parentLineId'
>;

export type StampError = { offerKey: string; sku: string | null } & ({ code: ScheduleError['code']; detail?: string } | { code: 'LABEL_DATA_MISSING'; missing: string[] });

export interface OrderStampInput {
  lines: StampLine[];
  /** YYYY-MM-DD: the order's creation date (UTC). */
  orderDate: string;
  locale: Locale;
  currencyCode: string;
  offers: Record<string, Offer>;
}

export interface OrderStamp {
  /** JSON text for `malva-order.priceSchedule` (`{ v: 1, schedules: [...] }`, read back with `parseSchedules`). */
  priceSchedule: string;
  /** JSON text for `malva-order.labelSnapshot` (plans only, read back with `parseLabelSnapshot`). */
  labelSnapshot: string;
  /** YYYY-MM-DD for `malva-order.serviceStartDate`: the order date plus the longest install lead of its plans (D-023). */
  serviceStartDate: string;
  errors: StampError[];
}

const zero = (currencyCode: string) => ({ centAmount: 0, currencyCode });

export function buildOrderPricingStamp(input: OrderStampInput): OrderStamp {
  const { lines, orderDate, locale, currencyCode, offers } = input;
  const schedules: PriceSchedule[] = [];
  const labels: LabelSnapshot['labels'] = [];
  const errors: StampError[] = [];
  let lead = 0;

  for (const line of lines) {
    if (line.kind !== 'plan' || line.chargeType !== 'recurring' || !line.sku) continue;
    const offer = offers[line.offerKey];
    if (!offer) continue;
    if (offer.facts?.kind === 'plan' && offer.facts.technology === 'cable') lead = Math.max(lead, INSTALL_LEAD_DAYS_CABLE);

    const fee = lines.find((candidate) => candidate.kind === 'fee' && candidate.offerKey === line.offerKey);
    const introDef = introDefFor(line.offerKey, line.termMonths as TermMonths);
    const schedule = buildSchedule({
      offerKey: line.offerKey,
      sku: line.sku,
      termMonths: line.termMonths,
      quantity: line.quantity,
      standing: line.unitListPrice,
      introApplied: introDef !== null && line.appliedDiscountKeys.includes(discountKeyFor(introDef)),
      monthToMonth: offer.variants.find((variant) => variant.termMonths === 0 && variant.recurringPrice)?.recurringPrice ?? null,
      oneTimeDueNow: fee ? fee.total : zero(currencyCode),
      orderDate,
    });
    if (schedule.ok) schedules.push(schedule.value);
    else errors.push({ offerKey: line.offerKey, sku: line.sku, code: schedule.error.code, ...(schedule.error.detail ? { detail: schedule.error.detail } : {}) });

    const variant = offer.variants.find((candidate) => candidate.sku === line.sku);
    const label = buildLabel({
      offer,
      line: { sku: line.sku, quantity: line.quantity, termMonths: line.termMonths as TermMonths, unitListPrice: line.unitListPrice, unitPrice: line.unitPrice },
      activationFee: fee ? { centAmount: Math.round(fee.total.centAmount / Math.max(1, line.quantity)), currencyCode } : (variant?.oneTimePrice ?? zero(currencyCode)),
      children: lines
        .filter((child) => child.parentLineId === line.id && child.kind !== 'fee')
        .map((child) => ({ name: child.name, chargeType: child.chargeType, kind: child.kind, total: child.total, quantity: child.quantity })),
      schedule: schedule.ok ? schedule.value : null,
      strings: LABEL_STRINGS,
      fmt: formatLabelMoney,
    });
    if (label.ok) labels.push({ sku: line.sku, offerKey: line.offerKey, label: label.label });
    else errors.push({ offerKey: line.offerKey, sku: line.sku, code: 'LABEL_DATA_MISSING', missing: label.missing });
  }

  return {
    priceSchedule: serializeSchedules(schedules),
    labelSnapshot: buildLabelSnapshot(labels, `${orderDate}T00:00:00.000Z`, locale, currencyCode),
    serviceStartDate: addDays(orderDate, lead),
    errors,
  };
}
