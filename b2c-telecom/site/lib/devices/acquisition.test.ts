import {
  AcquisitionError,
  availableModeNames,
  computeEndDate,
  computeRecurringExpiry,
  endOfTermFor,
  getAvailableModes,
  modeOfPolicyKey,
  policyKeyFor,
  quoteAcquisition,
  readAcquisition,
} from './acquisition';
import { NOVA_5G_128, NOVA_5G_256_SILVER, NOVA_PRO_256, NOVA_PRO_512, usd } from './__fixtures__/devices';

const TODAY = new Date('2026-10-07T12:00:00Z');

describe('policy keys', () => {
  it('outright has no policy, installments and lease have one per term', () => {
    expect(policyKeyFor('outright', 0)).toBeNull();
    expect(policyKeyFor('installments', 24)).toBe('malva-device-installment-24');
    expect(policyKeyFor('installments', 12)).toBe('malva-device-installment-12');
    expect(policyKeyFor('lease', 24)).toBe('malva-device-lease-24');
  });
  it('modeOfPolicyKey is the inverse and refuses every other policy', () => {
    expect(modeOfPolicyKey('malva-device-installment-36')).toEqual({ mode: 'installments', termMonths: 36 });
    expect(modeOfPolicyKey('malva-device-lease-24')).toEqual({ mode: 'lease', termMonths: 24 });
    expect(modeOfPolicyKey('malva-monthly')).toBeNull();
    expect(modeOfPolicyKey('malva-device-installment-18')).toBeNull();
  });
});

describe('available modes', () => {
  it('Nova Pro offers every mode and term, Nova 5G has no lease', () => {
    expect(getAvailableModes(NOVA_PRO_256)).toEqual({ outright: true, installments: [12, 24, 36], lease: [24] });
    expect(getAvailableModes(NOVA_5G_128)).toEqual({ outright: true, installments: [12, 24, 36], lease: [] });
    expect(availableModeNames(NOVA_5G_128)).toEqual(['outright', 'installments']);
    expect(availableModeNames(NOVA_PRO_256)).toEqual(['outright', 'installments', 'lease']);
  });
  it('the Nova 5G 256 Silver hole: installments 12 and 24 only', () => {
    expect(getAvailableModes(NOVA_5G_256_SILVER).installments).toEqual([12, 24]);
  });
});

describe('quoteAcquisition', () => {
  it('Same device three modes: outright is due in full, installments and lease show the first payment due now and the monthly amount with its term', () => {
    const outright = quoteAcquisition(NOVA_PRO_256, 'outright', 0, TODAY);
    expect(outright).toMatchObject({ dueNow: usd(100800), totalPayable: usd(100800), endOfTerm: 'owned' });
    expect(outright.recurring).toBeUndefined();

    const installments = quoteAcquisition(NOVA_PRO_256, 'installments', 24, TODAY);
    expect(installments.dueNow).toEqual(usd(4200));
    expect(installments.recurring).toEqual({ amount: usd(4200), payments: 24, remaining: 23 });
    expect(installments.totalPayable).toEqual(usd(100800));
    expect(installments.endOfTerm).toBe('owned-after-final-payment');

    const lease = quoteAcquisition(NOVA_PRO_256, 'lease', 24, TODAY);
    expect(lease.dueNow).toEqual(usd(3300));
    expect(lease.recurring).toEqual({ amount: usd(3300), payments: 24, remaining: 23 });
    expect(lease.totalPayable).toEqual(usd(79200));
    expect(lease.endOfTerm).toBe('return');
  });

  it('every installment term multiplies back to the outright price (no rounding)', () => {
    for (const prices of [NOVA_PRO_256, NOVA_PRO_512, NOVA_5G_128]) {
      for (const term of [12, 24, 36] as const) {
        expect(quoteAcquisition(prices, 'installments', term, TODAY).totalPayable.centAmount).toBe(prices.outright?.centAmount);
      }
    }
  });

  it('36 months: 35 more payments; quantity multiplies due now and the total', () => {
    const quote = quoteAcquisition(NOVA_PRO_256, 'installments', 36, TODAY, 2);
    expect(quote.dueNow).toEqual(usd(5600));
    expect(quote.recurring?.remaining).toBe(35);
    expect(quote.totalPayable).toEqual(usd(5600 * 36));
  });

  it('refuses a mode the device does not have and names the code', () => {
    expect(() => quoteAcquisition(NOVA_5G_128, 'lease', 24, TODAY)).toThrow(AcquisitionError);
    try {
      quoteAcquisition(NOVA_5G_128, 'lease', 24, TODAY);
    } catch (error) {
      expect((error as AcquisitionError).code).toBe('MODE_UNAVAILABLE');
    }
  });

  it('refuses a term that has no price (the Nova 5G 256 Silver hole) with TERM_UNAVAILABLE', () => {
    try {
      quoteAcquisition(NOVA_5G_256_SILVER, 'installments', 36, TODAY);
      expect.unreachable();
    } catch (error) {
      expect((error as AcquisitionError).code).toBe('TERM_UNAVAILABLE');
    }
    expect(() => quoteAcquisition(NOVA_PRO_256, 'installments', 18, TODAY)).toThrow(AcquisitionError);
  });
});

describe('dates', () => {
  it('End of term obligation disclosed: lease return date is final payment plus 30 days', () => {
    // order 2026-10-07: final payment 23 months later = 2028-09-07, return by 2028-10-07
    expect(computeEndDate('lease', 24, TODAY)).toBe('2028-10-07');
    expect(computeEndDate('installments', 24, TODAY)).toBe('2028-09-07');
    expect(computeEndDate('installments', 36, TODAY)).toBe('2029-09-07');
    expect(computeEndDate('outright', 0, TODAY)).toBeUndefined();
    expect(quoteAcquisition(NOVA_PRO_256, 'lease', 24, TODAY).endDate).toBe('2028-10-07');
  });
  it('month-end clamping: Jan 31 plus months', () => {
    expect(computeEndDate('installments', 2, new Date('2027-01-31T00:00:00Z'))).toBe('2027-02-28');
    expect(computeEndDate('installments', 2, new Date('2028-01-31T00:00:00Z'))).toBe('2028-02-29');
  });
  it('the date uses UTC, not the local time zone', () => {
    expect(computeEndDate('installments', 1, new Date('2026-10-07T23:30:00Z'))).toBe('2026-10-07');
  });
  it('endOfTermFor maps each mode', () => {
    expect(endOfTermFor('outright')).toBe('owned');
    expect(endOfTermFor('installments')).toBe('owned-after-final-payment');
    expect(endOfTermFor('lease')).toBe('return');
  });
  it('computeRecurringExpiry: after the last scheduled payment and before the next, time of day kept', () => {
    // payments 2..24 start at startsAt; the last is startsAt + 22 months; the buffer is 7 days
    const startsAt = new Date('2026-10-07T09:30:00Z');
    expect(computeRecurringExpiry(startsAt, 24).toISOString()).toBe('2028-08-14T09:30:00.000Z');
    // 12 months
    expect(computeRecurringExpiry(startsAt, 12).toISOString()).toBe('2027-08-14T09:30:00.000Z');
    // month-end start is clamped, then the buffer is added
    expect(computeRecurringExpiry(new Date('2026-12-31T00:00:00Z'), 4).toISOString()).toBe('2027-03-07T00:00:00.000Z');
  });
});

describe('readAcquisition', () => {
  it('Mode persisted to the order: readAcquisition returns mode and term from custom fields and never infers them from the price', () => {
    expect(readAcquisition({ offerKey: 'x', acquisitionMode: 'installments', acquisitionTermMonths: 24, acquisitionEndOfTerm: 'owned-after-final-payment' })).toEqual({
      mode: 'installments',
      termMonths: 24,
      endOfTerm: 'owned-after-final-payment',
    });
    // the line carries no price here at all: the mode is read from the fields only
    expect(readAcquisition({ acquisitionMode: 'outright', acquisitionTermMonths: 0 })).toEqual({ mode: 'outright', termMonths: 0, endOfTerm: 'owned' });
    expect(readAcquisition({ acquisitionMode: 'lease', acquisitionTermMonths: 24, acquisitionEndDate: '2028-10-07', financingDecisionId: 'stub-0000abcd' })).toEqual({
      mode: 'lease',
      termMonths: 24,
      endOfTerm: 'return',
      endDate: '2028-10-07',
      financingDecisionId: 'stub-0000abcd',
    });
  });
  it('returns null for a line that has no acquisition fields or an unknown mode', () => {
    expect(readAcquisition(undefined)).toBeNull();
    expect(readAcquisition({ offerKey: 'x' })).toBeNull();
    expect(readAcquisition({ acquisitionMode: 'rent' })).toBeNull();
  });
  it('a date-time end date is cut to the day', () => {
    expect(readAcquisition({ acquisitionMode: 'lease', acquisitionTermMonths: 24, acquisitionEndDate: '2028-10-07T00:00:00.000Z' })?.endDate).toBe('2028-10-07');
  });
});
