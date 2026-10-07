import { cable500, phoneEssential, withFacts } from '@/lib/offers/__fixtures__/offers';
import type { Money, Offer, PriceSchedule } from '@/lib/types';
import { buildLabel, buildLabelSnapshot, formatLabelMoney, parseLabelSnapshot, type LabelBuildInput } from './label';
import { LABEL_STRINGS } from './labelStrings';

const usd = (centAmount: number): Money => ({ centAmount, currencyCode: 'USD' });

const cable: Offer = withFacts(cable500, {
  typicalDownloadMbps: 525,
  typicalUploadMbps: 48,
  typicalLatencyMs: 13,
  dataGb: -1,
  priceLockMonths: 24,
  earlyTerminationFee: '$10 x months remaining',
});

function input(patch: Partial<LabelBuildInput> = {}, offer: Offer = cable, price = 5999): LabelBuildInput {
  return {
    offer,
    line: { sku: 'MLV-CBL-500-24M', quantity: 1, termMonths: 24, unitListPrice: usd(price), unitPrice: usd(price) },
    activationFee: usd(2500),
    children: [{ name: 'Malva WiFi 6 Router AX3000', chargeType: 'one-time', kind: 'equipment', total: usd(12999), quantity: 1 }],
    schedule: null,
    strings: LABEL_STRINGS,
    fmt: formatLabelMoney,
    ...patch,
  };
}

function ok(i: LabelBuildInput) {
  const result = buildLabel(i);
  if (!result.ok) throw new Error(`label missing ${result.missing.join(',')}`);
  return result.label;
}

describe('buildLabel', () => {
  it('maps the Cable 500 24-month fixture: price, lock note, one-time rows, ETF text, speeds and data', () => {
    const label = ok(input());
    expect(label.id).toBe('MLV-CBL-500-24M');
    expect(label.planName).toBe('Cable 500');
    expect(label.kind).toBe('Cable internet');
    expect(label.price).toBe('$59.99');
    expect(label.priceNote).toBe('Price locked for 24 months.');
    expect(label.oneTime).toEqual([
      { k: 'Activation fee', v: '$25.00' },
      { k: 'Malva WiFi 6 Router AX3000', v: '$129.99' },
    ]);
    expect(label.etf).toBe('$10 x months remaining');
    expect(label.speeds).toEqual([
      { k: 'Typical Download Speed', v: '525 Mbps' },
      { k: 'Typical Upload Speed', v: '48 Mbps' },
      { k: 'Typical Latency', v: '13 ms' },
    ]);
    expect(label.data).toBe('Unlimited');
    expect(label.discounts).toContain('$5.00 off');
  });

  it('rented equipment is a provider monthly fee per line', () => {
    const label = ok(input({ children: [{ name: 'Router', chargeType: 'recurring', kind: 'equipment', total: usd(1600), quantity: 2 }] }));
    expect(label.monthlyFees).toEqual([{ k: 'Router', v: '$8.00/mo' }]);
  });

  it('a phone plan has $0.00 activation, the ETF text from the attribute and a data cap in GB', () => {
    const phone = withFacts(phoneEssential, {
      typicalDownloadMbps: 100,
      typicalUploadMbps: 20,
      typicalLatencyMs: 30,
      dataGb: 5,
      priceLockMonths: 0,
      earlyTerminationFee: 'None',
    });
    const label = ok(input({ activationFee: usd(0), children: [] }, phone, 2500));
    expect(label.oneTime).toEqual([{ k: 'Activation fee', v: '$0.00' }]);
    expect(label.etf).toBe('None');
    expect(label.data).toBe('5 GB');
    expect(label.priceNote).toBe('Price can change with notice.');
    expect(label.kind).toBe('Phone plan');
    expect(label.discounts).toContain('Second line $10.00 off');
  });

  it('Required data missing: builder reports the missing fields', () => {
    const broken = withFacts(cable, { typicalLatencyMs: undefined });
    expect(buildLabel(input({}, broken))).toEqual({ ok: false, missing: ['typical-latency-ms'] });
    expect(buildLabel(input({ activationFee: null }))).toEqual({ ok: false, missing: ['activation-fee'] });
    const blank = withFacts(cable, { earlyTerminationFee: ' ' });
    expect(buildLabel(input({}, blank))).toEqual({ ok: false, missing: ['early-termination-fee'] });
  });

  it('appends the intro and the step sentences from the schedule', () => {
    const schedule = {
      periods: [
        { index: 1, fromMonth: 1, toMonth: 6, months: 6, kind: 'intro', monthlyAmount: usd(2999) },
        { index: 2, fromMonth: 7, toMonth: 24, months: 18, kind: 'standing', monthlyAmount: usd(3999) },
        { index: 3, fromMonth: 13, toMonth: 24, months: 12, kind: 'step', monthlyAmount: usd(4499) },
      ],
    } as unknown as PriceSchedule;
    const label = ok(input({ schedule }, cable, 3999));
    expect(label.priceNote).toBe('Price locked for 24 months. Introductory price $29.99/mo for the first 6 months, then $39.99/mo. Price changes to $44.99/mo from month 13.');
  });

  it('Label matches the charged price: a changed catalog price changes the label, no figure is stored as copy', () => {
    expect(ok(input({}, cable, 5999)).price).toBe('$59.99');
    expect(ok(input({}, cable, 6499)).price).toBe('$64.99');
    expect(ok(input({ activationFee: usd(3000) })).oneTime[0]).toEqual({ k: 'Activation fee', v: '$30.00' });
  });

  it('Fee with a formula: the early-termination fee is the stated formula text, identical from the snapshot', () => {
    const label = ok(input());
    const json = buildLabelSnapshot([{ sku: label.id, offerKey: 'malva-offer-cable-500', label }], '2026-10-07T10:00:00Z', 'en-US', 'USD');
    const parsed = parseLabelSnapshot(json);
    expect(parsed.ok && parsed.value.labels[0]?.label.etf).toBe('$10 x months remaining');
  });

  it('formats euro amounts with en-US rules', () => {
    expect(formatLabelMoney({ centAmount: 5999, currencyCode: 'EUR' })).toBe('€59.99');
  });
});

describe('label snapshot', () => {
  it('round-trips and rejects broken input', () => {
    const label = ok(input());
    const json = buildLabelSnapshot([{ sku: label.id, offerKey: 'o', label }], 'now', 'de-DE', 'EUR');
    const parsed = parseLabelSnapshot(json);
    expect(parsed).toEqual({ ok: true, value: { v: 1, takenAt: 'now', locale: 'de-DE', currencyCode: 'EUR', labels: [{ sku: label.id, offerKey: 'o', label }] } });
    expect(parseLabelSnapshot('{')).toEqual({ ok: false });
    expect(parseLabelSnapshot('{"v":2}')).toEqual({ ok: false });
    expect(parseLabelSnapshot('{"v":1,"takenAt":"x","locale":"x","currencyCode":"USD","labels":[{"sku":"a"}]}')).toEqual({ ok: false });
  });
});
