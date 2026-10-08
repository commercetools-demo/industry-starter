import { describe, expect, it } from 'vitest';
import {
  checkAuthorization,
  checkCeiling,
  checkShelfLife,
  checkStock,
  daysBetween,
  firstRefusal,
  periodOf,
  shelfLifeMonths,
} from './rules';

const TODAY = '2026-10-08';

describe('prescription-bound-supply: Supply within the authorization', () => {
  it.each([
    { refillsLeft: 3, lineQty: 30, requestedQty: undefined, remaining: 90 },
    { refillsLeft: 1, lineQty: 21, requestedQty: 21, remaining: 21 },
    { refillsLeft: 3, lineQty: 30, requestedQty: 60, remaining: 90 },
  ])('in date with $refillsLeft refills: accepted', ({ refillsLeft, lineQty, requestedQty, remaining }) => {
    expect(checkAuthorization({ refillsLeft, lineQty, requestedQty, today: TODAY, expiresAt: '2027-01-01' })).toEqual({ reason: 'OK', remaining });
  });

  it('the last day of the window still counts', () => {
    expect(checkAuthorization({ refillsLeft: 1, lineQty: 30, today: '2027-09-15', expiresAt: '2027-09-15' }).reason).toBe('OK');
  });

  it('no expiry date means no window to close', () => {
    expect(checkAuthorization({ refillsLeft: 3, lineQty: 30, today: '2099-01-01' }).reason).toBe('OK');
  });
});

describe('prescription-bound-supply: Request exceeds what remains', () => {
  it('no refills left: refused with nothing available', () => {
    expect(checkAuthorization({ refillsLeft: 0, lineQty: 21, today: TODAY })).toEqual({ reason: 'NO_REFILLS', remaining: 0 });
  });

  it('asks for more than remains: refused whole (no partial supply) and the available amount is stated', () => {
    expect(checkAuthorization({ refillsLeft: 1, lineQty: 30, requestedQty: 60, today: TODAY })).toEqual({ reason: 'NO_REFILLS', remaining: 30 });
  });

  it('a negative refill count behaves as none', () => {
    expect(checkAuthorization({ refillsLeft: -2, lineQty: 30, today: TODAY })).toEqual({ reason: 'NO_REFILLS', remaining: 0 });
  });
});

describe('prescription-bound-supply: Authorization outside its window', () => {
  it('the day after the window: refused as EXPIRED', () => {
    expect(checkAuthorization({ refillsLeft: 1, lineQty: 30, today: '2026-03-02', expiresAt: '2026-03-01' })).toEqual({ reason: 'EXPIRED', remaining: 0 });
  });

  it('expiry is the reason even when the authorization is also exhausted', () => {
    expect(checkAuthorization({ refillsLeft: 0, lineQty: 30, today: '2026-03-02', expiresAt: '2026-03-01' }).reason).toBe('EXPIRED');
  });
});

describe('stock', () => {
  it.each([
    { available: 0, requested: 1, reason: 'OUT_OF_STOCK', remaining: 0 },
    { available: 1, requested: 2, reason: 'OUT_OF_STOCK', remaining: 1 },
    { available: -4, requested: 1, reason: 'OUT_OF_STOCK', remaining: 0 },
    { available: 600, requested: 1, reason: 'OK', remaining: 600 },
  ])('available $available, requested $requested: $reason', ({ available, requested, reason, remaining }) => {
    expect(checkStock({ available, requested })).toEqual({ reason, remaining });
  });
});

describe('dispensing-quantity-limit: Order within the ceiling', () => {
  it.each([
    { requested: 1, perOrderMax: 2, periodCeiling: 2, usedInPeriod: 0 },
    { requested: 2, perOrderMax: 2, periodCeiling: 2, usedInPeriod: 0 },
    { requested: 1, perOrderMax: null, periodCeiling: null, usedInPeriod: 40 },
    { requested: 1, perOrderMax: 3, periodCeiling: 3, usedInPeriod: 2 },
  ])('requested $requested, used $usedInPeriod: accepted', (input) => {
    expect(checkCeiling(input).reason).toBe('OK');
  });
});

describe('dispensing-quantity-limit: Single request exceeding the ceiling', () => {
  it('states the ceiling and what is still available', () => {
    expect(checkCeiling({ requested: 3, perOrderMax: 2, periodCeiling: 2, usedInPeriod: 0 })).toEqual({
      reason: 'CEILING',
      remaining: 2,
      ceiling: 2,
      scope: 'order',
    });
  });
});

describe('dispensing-quantity-limit: Second order inside the same period', () => {
  it('is refused on the cumulative count, not as a fresh basket', () => {
    expect(checkCeiling({ requested: 1, perOrderMax: 2, periodCeiling: 2, usedInPeriod: 2 })).toEqual({
      reason: 'CEILING',
      remaining: 0,
      ceiling: 2,
      scope: 'period',
    });
  });

  it('the cumulative remainder is what is offered', () => {
    expect(checkCeiling({ requested: 2, perOrderMax: 3, periodCeiling: 3, usedInPeriod: 2 })).toMatchObject({ reason: 'CEILING', remaining: 1, scope: 'period' });
  });
});

describe('dispensing-quantity-limit: Period rolls over', () => {
  it('the period is the calendar month, so the next month starts at zero used', () => {
    expect(periodOf('2026-10-31T23:59:59Z')).toBe('2026-10');
    expect(periodOf('2026-11-01T00:00:00Z')).toBe('2026-11');
    expect(checkCeiling({ requested: 2, perOrderMax: 2, periodCeiling: 2, usedInPeriod: 0 }).reason).toBe('OK');
  });
});

describe('dispensing-quantity-limit: Ceiling lowered while a cart is open', () => {
  it('a line that was legal under the old ceiling is refused under the lowered one', () => {
    const line = { requested: 3, usedInPeriod: 0 };
    expect(checkCeiling({ ...line, perOrderMax: 3, periodCeiling: 3 }).reason).toBe('OK');
    expect(checkCeiling({ ...line, perOrderMax: 2, periodCeiling: 2 })).toMatchObject({ reason: 'CEILING', remaining: 2, ceiling: 2 });
  });
});

describe('expiry-dated-supply: Remaining life shown before commitment', () => {
  it('turns the promise in days into whole months for display', () => {
    expect(shelfLifeMonths(90)).toBe(3);
    expect(shelfLifeMonths(30)).toBe(1);
    expect(shelfLifeMonths(10)).toBe(1);
    expect(shelfLifeMonths(null)).toBeNull();
    expect(shelfLifeMonths(0)).toBeNull();
  });
});

describe('expiry-dated-supply: Account minimum excludes unsuitable stock', () => {
  it('stock expiring inside the promise is refused with its expiry and days left', () => {
    expect(checkShelfLife({ minRemainingShelfLifeDays: 90, expiryDate: '2026-11-15', today: TODAY })).toEqual({
      reason: 'SHELF_LIFE',
      remaining: 0,
      expiryDate: '2026-11-15',
      daysLeft: 38,
    });
  });

  it('exactly the promised number of days is enough', () => {
    expect(checkShelfLife({ minRemainingShelfLifeDays: 38, expiryDate: '2026-11-15', today: TODAY }).reason).toBe('OK');
  });

  it('the promise is judged at delivery, not today', () => {
    expect(checkShelfLife({ minRemainingShelfLifeDays: 38, expiryDate: '2026-11-15', today: TODAY, deliveryLeadDays: 2 }).reason).toBe('SHELF_LIFE');
  });

  it('stock past its date is never within the promise', () => {
    expect(checkShelfLife({ minRemainingShelfLifeDays: 0, expiryDate: '2026-10-01', today: TODAY })).toMatchObject({ reason: 'SHELF_LIFE', daysLeft: 0 });
  });
});

describe('expiry-dated-supply: Undated goods unaffected', () => {
  it('no expiry date: nothing is shown and nothing refuses', () => {
    expect(checkShelfLife({ minRemainingShelfLifeDays: 90, today: TODAY }).reason).toBe('OK');
  });
});

describe('helpers', () => {
  it('daysBetween counts whole days across month ends', () => {
    expect(daysBetween('2026-10-08', '2026-11-15')).toBe(38);
    expect(daysBetween('2026-11-15', '2026-10-08')).toBe(-38);
  });

  it('firstRefusal returns the first refusing check in the order given', () => {
    const ok = checkStock({ available: 5, requested: 1 });
    const no = checkStock({ available: 0, requested: 1 });
    const exp = checkAuthorization({ refillsLeft: 1, lineQty: 1, today: '2030-01-01', expiresAt: '2029-01-01' });
    expect(firstRefusal([ok, ok])).toBeNull();
    expect(firstRefusal([ok, exp, no])?.reason).toBe('EXPIRED');
  });
});
