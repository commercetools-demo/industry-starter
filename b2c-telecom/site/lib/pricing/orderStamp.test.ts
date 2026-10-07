import { cartOffersByKey } from '@/lib/cart/__fixtures__/offers';
import type { Offer } from '@/lib/types';
import { parseLabelSnapshot } from './label';
import { buildOrderPricingStamp, type StampLine } from './orderStamp';
import { parseSchedules } from './schedule';

const usd = (centAmount: number) => ({ centAmount, currencyCode: 'USD' });
const offers = cartOffersByKey();

const plan = (patch: Partial<StampLine> = {}): StampLine => ({
  id: 'L1',
  offerKey: 'malva-offer-cable-500',
  sku: 'MLV-CBL-500-24M',
  kind: 'plan',
  name: 'Cable 500',
  quantity: 1,
  termMonths: 24,
  chargeType: 'recurring',
  unitListPrice: usd(5999),
  unitPrice: usd(5999),
  total: usd(5999),
  appliedDiscountKeys: [],
  parentLineId: null,
  ...patch,
});
const fee: StampLine = { id: 'F1', offerKey: 'malva-offer-cable-500', sku: null, kind: 'fee', name: 'Activation fee', quantity: 1, termMonths: 0, chargeType: 'one-time', unitListPrice: usd(2500), unitPrice: usd(2500), total: usd(2500), appliedDiscountKeys: [], parentLineId: 'L1' };
const addon: StampLine = { id: 'A1', offerKey: 'malva-offer-appletv', sku: 'MLV-ADD-APPLETV-MTH', kind: 'addon', name: 'Apple TV+', quantity: 1, termMonths: 0, chargeType: 'recurring', unitListPrice: usd(999), unitPrice: usd(999), total: usd(999), appliedDiscountKeys: [], parentLineId: 'L1' };
const phone = plan({ id: 'P1', offerKey: 'malva-offer-phone-unlimited', sku: 'MLV-PHN-UNL-M2M', name: 'Unlimited', termMonths: 0, unitListPrice: usd(5500), unitPrice: usd(5500), total: usd(5500) });

const build = (lines: StampLine[], orderDate = '2026-10-07', offerMap: Record<string, Offer> = offers) => buildOrderPricingStamp({ lines, orderDate, locale: 'en-US', currencyCode: 'USD', offers: offerMap });

describe('buildOrderPricingStamp', () => {
  it('uses the order creation date, not today: the schedule starts on the order date', () => {
    const stamp = build([plan(), fee], '2026-03-31');
    const parsed = parseSchedules(stamp.priceSchedule);
    expect(parsed.ok && parsed.value[0]).toMatchObject({ orderDate: '2026-03-31', dueAtOrder: { centAmount: 5999 + 2500 } });
    expect(parsed.ok && parsed.value[0]?.periods[0]?.startsOn).toBe('2026-03-31');
    expect(parsed.ok && parsed.value[0]?.afterTerm?.startsOn).toBe('2028-03-31');
  });

  it('writes one schedule and one label per plan line; add-ons produce none', () => {
    const stamp = build([plan(), fee, addon, phone]);
    const schedules = parseSchedules(stamp.priceSchedule);
    expect(schedules.ok && schedules.value.map((s) => s.sku)).toEqual(['MLV-CBL-500-24M', 'MLV-PHN-UNL-M2M']);
    const snapshot = parseLabelSnapshot(stamp.labelSnapshot);
    expect(snapshot.ok && snapshot.value.labels.map((l) => l.sku)).toEqual(['MLV-CBL-500-24M', 'MLV-PHN-UNL-M2M']);
    expect(snapshot.ok && snapshot.value).toMatchObject({ v: 1, locale: 'en-US', currencyCode: 'USD' });
    expect(stamp.errors).toEqual([]);
  });

  it('the label carries the order prices, the fee and the stored ETF text', () => {
    const stamp = build([plan(), fee]);
    const snapshot = parseLabelSnapshot(stamp.labelSnapshot);
    const label = snapshot.ok ? snapshot.value.labels[0]?.label : undefined;
    expect(label).toMatchObject({ id: 'MLV-CBL-500-24M', price: '$59.99', etf: '$10 x months remaining' });
    expect(label?.oneTime[0]).toEqual({ k: 'Activation fee', v: '$25.00' });
  });

  it('a plan whose label data is missing yields an error entry and no label', () => {
    const broken = { ...offers['malva-offer-cable-500'], facts: { ...(offers['malva-offer-cable-500'].facts as object), typicalLatencyMs: undefined } } as Offer;
    const stamp = build([plan(), fee], '2026-10-07', { ...offers, 'malva-offer-cable-500': broken });
    expect(stamp.errors).toEqual([{ offerKey: 'malva-offer-cable-500', sku: 'MLV-CBL-500-24M', code: 'LABEL_DATA_MISSING', missing: ['typical-latency-ms'] }]);
    const snapshot = parseLabelSnapshot(stamp.labelSnapshot);
    expect(snapshot.ok && snapshot.value.labels).toEqual([]);
    const schedules = parseSchedules(stamp.priceSchedule);
    expect(schedules.ok && schedules.value).toHaveLength(1);
  });

  it('a plan the schedule cannot price is reported and left out', () => {
    const stamp = build([plan({ id: 'G1', offerKey: 'malva-offer-cable-gig', sku: 'MLV-CBL-GIG-24M', unitListPrice: usd(7999), total: usd(7999) })]);
    expect(stamp.errors[0]).toMatchObject({ offerKey: 'malva-offer-cable-gig', code: 'NO_STANDING_PRICE' });
    const schedules = parseSchedules(stamp.priceSchedule);
    expect(schedules.ok && schedules.value).toEqual([]);
  });

  it('serviceStartDate is the order date plus the cable install lead (5 days), 0 for everything else', () => {
    expect(build([plan(), fee], '2026-10-07').serviceStartDate).toBe('2026-10-12');
    expect(build([phone], '2026-10-07').serviceStartDate).toBe('2026-10-07');
    expect(build([plan(), fee, phone], '2026-10-29').serviceStartDate).toBe('2026-11-03');
  });

  it('the intro schedule is stored when the order line carries the intro discount', () => {
    const intro = plan({ offerKey: 'malva-offer-cable-100', sku: 'MLV-CBL-100-24M', unitListPrice: usd(3999), total: usd(2999), appliedDiscountKeys: ['malva-cd-intro-cable-100-24'] });
    const stamp = build([intro, { ...fee, offerKey: 'malva-offer-cable-100' }]);
    const schedules = parseSchedules(stamp.priceSchedule);
    expect(schedules.ok && schedules.value[0]?.periods[0]).toMatchObject({ kind: 'intro', months: 6, monthlyAmount: { centAmount: 2999 } });
  });
});
