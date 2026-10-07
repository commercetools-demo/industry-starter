import type { IntroDef } from '@/lib/config/pricing';
import type { Money } from '@/lib/types';
import { amountOn, computeIntro, discountKeyFor, introDefFor, isIntroActive, resolveEarlyCancellation, shiftForDelay } from './introPeriod';

const usd = (centAmount: number): Money => ({ centAmount, currencyCode: 'USD' });
const wireless: IntroDef = { offerKey: 'malva-offer-wireless-5g', term: 12, months: 3, amountCents: { USD: 3500, EUR: 3200 } };

function intro(orderDate = '2026-10-07', def = wireless, standing = usd(5500)) {
  const result = computeIntro({ def, standing, orderDate });
  if (!result.ok) throw new Error('intro expected');
  return result.value;
}

describe('introductory period', () => {
  it('Both prices shown before commitment: exposes promotional amount, standing amount and the date the standing amount begins', () => {
    const value = intro('2026-10-07');
    expect(value.amount).toEqual(usd(3500));
    expect(value.standing).toEqual(usd(5500));
    expect(value.endsOn).toBe('2027-01-07');
    expect(value.months).toBe(3);
  });

  it("Period runs from start of service: each customer's end date is computed from their own order date", () => {
    expect(intro('2026-10-07').endsOn).toBe('2027-01-07');
    expect(intro('2026-10-20').endsOn).toBe('2027-01-20');
    expect(intro('2026-11-30').endsOn).toBe('2027-02-28');
  });

  it('Reverts without customer action: amountOn returns the standing price from the end date', () => {
    const value = intro('2026-10-07');
    expect(amountOn(value, '2026-10-07')).toEqual(usd(3500));
    expect(amountOn(value, '2027-01-06')).toEqual(usd(3500));
    expect(amountOn(value, '2027-01-07')).toEqual(usd(5500));
    expect(isIntroActive(value, '2027-01-06')).toBe(true);
    expect(isIntroActive(value, '2027-01-07')).toBe(false);
  });

  it('Service start delayed: end date moves by the days of delay, never earlier', () => {
    const value = intro('2026-10-07');
    expect(shiftForDelay(value, '2026-10-12', '2026-10-19').endsOn).toBe('2027-01-14');
    expect(shiftForDelay(value, '2026-10-12', '2026-10-09').endsOn).toBe(value.endsOn);
  });

  it('shiftForDelay with 0 delay changes nothing', () => {
    const value = intro('2026-10-07');
    expect(shiftForDelay(value, '2026-10-12', '2026-10-12')).toEqual(value);
  });

  it('Canceled within the opening period: nothing owed for the promotion, rule is named', () => {
    const value = intro('2026-10-07');
    const before = resolveEarlyCancellation({ cancelledOn: '2026-10-08', serviceStartDate: '2026-10-12', intro: value });
    expect(before).toEqual({ windowOpen: true, owedForPromo: usd(0), rule: 'cancel-before-service-start' });
    const after = resolveEarlyCancellation({ cancelledOn: '2026-11-15', serviceStartDate: '2026-10-12', intro: value });
    expect(after).toEqual({ windowOpen: false, owedForPromo: usd(0), rule: 'no-clawback' });
  });

  it('an amount not below the standing price returns INTRO_NOT_BELOW_STANDING', () => {
    const result = computeIntro({ def: wireless, standing: usd(3500), orderDate: '2026-10-07' });
    expect(result).toEqual({ ok: false, error: { code: 'INTRO_NOT_BELOW_STANDING', detail: '3500' } });
  });

  it('a missing currency returns an error', () => {
    const result = computeIntro({ def: wireless, standing: { centAmount: 5500, currencyCode: 'GBP' }, orderDate: '2026-10-07' });
    expect(result).toEqual({ ok: false, error: { code: 'NO_STANDING_PRICE', detail: 'currency' } });
  });

  it('discountKeyFor gives malva-cd-intro-wireless-5g-12', () => {
    expect(discountKeyFor(wireless)).toBe('malva-cd-intro-wireless-5g-12');
  });

  it('introDefFor finds the configured offer+term only', () => {
    expect(introDefFor('malva-offer-wireless-5g', 12)?.months).toBe(3);
    expect(introDefFor('malva-offer-wireless-5g', 24)).toBeNull();
    expect(introDefFor('malva-offer-cable-100', 24)?.months).toBe(6);
  });
});
