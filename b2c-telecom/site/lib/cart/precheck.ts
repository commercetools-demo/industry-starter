// Checks a plan BEFORE it is written to the cart (no commercetools write): can its price schedule be built and can its Broadband Facts label
// be built from catalog data? A plan that fails either is never added (specs term-phased-price-schedule and broadband-facts-label).
import { buildLabel, formatLabelMoney } from '@/lib/pricing/label';
import { LABEL_STRINGS } from '@/lib/pricing/labelStrings';
import { buildSchedule } from '@/lib/pricing/schedule';
import type { Money, Offer, OfferVariant, TermMonths } from '@/lib/types';

export type PrecheckResult =
  | { ok: true }
  | { ok: false; reason: 'RECURRING_PRICE_MISSING' | 'SCHEDULE_NOT_PRICEABLE' | 'LABEL_DATA_MISSING'; missing?: string[]; detail?: string };

export function precheckPlan(args: { offer: Offer; variant: OfferVariant; quantity: number; today: string }): PrecheckResult {
  const { offer, variant, quantity, today } = args;
  const standing = variant.recurringPrice;
  if (!standing) return { ok: false, reason: 'RECURRING_PRICE_MISSING' };
  const termMonths = (variant.termMonths ?? 0) as TermMonths;
  const fee: Money = variant.oneTimePrice ?? { centAmount: 0, currencyCode: standing.currencyCode };
  const monthToMonth = offer.variants.find((candidate) => candidate.termMonths === 0 && candidate.recurringPrice)?.recurringPrice ?? null;
  const schedule = buildSchedule({
    offerKey: offer.key,
    sku: variant.sku,
    termMonths,
    quantity,
    standing,
    introApplied: false,
    monthToMonth,
    oneTimeDueNow: { centAmount: fee.centAmount * quantity, currencyCode: fee.currencyCode },
    orderDate: today,
  });
  if (!schedule.ok) return { ok: false, reason: 'SCHEDULE_NOT_PRICEABLE', detail: schedule.error.code };
  const label = buildLabel({
    offer,
    line: { sku: variant.sku, quantity, termMonths, unitListPrice: standing, unitPrice: standing },
    activationFee: fee,
    children: [],
    schedule: schedule.value,
    strings: LABEL_STRINGS,
    fmt: formatLabelMoney,
  });
  if (!label.ok) return { ok: false, reason: 'LABEL_DATA_MISSING', missing: label.missing };
  return { ok: true };
}
