// @vitest-environment node
import { ReleaseError, assertReleased, filterReleased, isOfferReleased } from './release';

const START = '2026-11-15T09:00:00Z';
const END = '2026-12-15T09:00:00Z';
const at = (iso: string): Date => new Date(iso);

describe('offer release window', () => {
  it('Nothing visible before the release: isOfferReleased is false before startTime', () => {
    expect(isOfferReleased({ startTime: START }, at('2026-11-15T08:59:59Z'))).toBe(false);
    expect(isOfferReleased({ startTime: START }, at('2026-11-01T00:00:00Z'))).toBe(false);
    expect(filterReleased([{ key: 'a', startTime: START }, { key: 'b' }], at('2026-11-15T08:59:59Z')).map((o) => o.key)).toEqual(['b']);
    expect(() => assertReleased({ key: 'a', startTime: START }, at('2026-11-15T08:59:59Z'))).toThrow(ReleaseError);
  });

  it('Everything visible after it: released at and after startTime', () => {
    expect(isOfferReleased({ startTime: START }, at(START))).toBe(true);
    expect(isOfferReleased({ startTime: START }, at('2026-11-15T09:00:01Z'))).toBe(true);
    expect(filterReleased([{ key: 'a', startTime: START }, { key: 'b', startTime: START, endTime: END }], at(START)).map((o) => o.key)).toEqual(['a', 'b']);
    expect(() => assertReleased({ key: 'a', startTime: START }, at(START))).not.toThrow();
  });

  it('startTime boundary is inclusive and endTime boundary is exclusive', () => {
    expect(isOfferReleased({ startTime: START, endTime: END }, at(START))).toBe(true);
    expect(isOfferReleased({ startTime: START, endTime: END }, at('2026-12-15T08:59:59Z'))).toBe(true);
    expect(isOfferReleased({ startTime: START, endTime: END }, at(END))).toBe(false);
    expect(isOfferReleased({ endTime: END }, at('2027-01-01T00:00:00Z'))).toBe(false);
  });

  it('an offer without times is always released (null and undefined alike)', () => {
    expect(isOfferReleased({}, at(START))).toBe(true);
    expect(isOfferReleased({ startTime: null, endTime: null }, at(START))).toBe(true);
  });

  it('a malformed date fails closed', () => {
    expect(isOfferReleased({ startTime: 'tomorrow' }, at(START))).toBe(false);
    expect(isOfferReleased({ endTime: 'never' }, at(START))).toBe(false);
    expect(isOfferReleased({ startTime: '' }, at(START))).toBe(false);
    expect(isOfferReleased({}, new Date('invalid'))).toBe(false);
  });

  it('ReleaseError carries the stable code and the offer key', () => {
    try {
      assertReleased({ key: 'malva-offer-x', startTime: START }, at('2026-01-01T00:00:00Z'));
    } catch (err) {
      expect(err).toBeInstanceOf(ReleaseError);
      expect((err as ReleaseError).code).toBe('OFFER_NOT_RELEASED');
      expect((err as ReleaseError).offerKey).toBe('malva-offer-x');
    }
  });

  it('uses the current time when none is given', () => {
    expect(isOfferReleased({ startTime: '2000-01-01T00:00:00Z' })).toBe(true);
    expect(isOfferReleased({ startTime: '2999-01-01T00:00:00Z' })).toBe(false);
  });
});
