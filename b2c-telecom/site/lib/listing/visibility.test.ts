import { LISTED_CABLE_100, LISTED_CABLE_500, LISTED_CABLE_EXISTING, LISTED_PHONE_ONLINE_ONLY, LISTED_PHONE_UNLIMITED } from './__fixtures__/catalog';
import { dedupeByAnchors } from './visibility';

describe('dedupeByAnchors', () => {
  it('keeps the unrestricted offer when a restricted one wraps the same product', () => {
    const kept = dedupeByAnchors([LISTED_PHONE_ONLINE_ONLY, LISTED_PHONE_UNLIMITED]);
    expect(kept.map((offer) => offer.key)).toEqual([LISTED_PHONE_UNLIMITED.key]);
  });

  it('does not depend on the order of the input', () => {
    const kept = dedupeByAnchors([LISTED_PHONE_UNLIMITED, LISTED_PHONE_ONLINE_ONLY]);
    expect(kept.map((offer) => offer.key)).toEqual([LISTED_PHONE_UNLIMITED.key]);
  });

  it('the offer a link points to wins its group', () => {
    const kept = dedupeByAnchors([LISTED_CABLE_500, LISTED_CABLE_EXISTING, LISTED_CABLE_100], LISTED_CABLE_EXISTING.key);
    expect(kept.map((offer) => offer.key)).toEqual([LISTED_CABLE_EXISTING.key, LISTED_CABLE_100.key]);
  });

  it('keeps the first one when none is unrestricted', () => {
    const other = { ...LISTED_PHONE_ONLINE_ONLY, key: 'malva-offer-phone-other' };
    const kept = dedupeByAnchors([LISTED_PHONE_ONLINE_ONLY, other]);
    expect(kept.map((offer) => offer.key)).toEqual([LISTED_PHONE_ONLINE_ONLY.key]);
  });

  it('collapses duplicate keys and keeps offers without anchors', () => {
    const noAnchor = { ...LISTED_CABLE_100, key: 'malva-offer-x', anchors: [] };
    const noAnchor2 = { ...LISTED_CABLE_100, key: 'malva-offer-y', anchors: [] };
    expect(dedupeByAnchors([LISTED_CABLE_100, LISTED_CABLE_100, noAnchor, noAnchor2]).map((offer) => offer.key)).toEqual([
      LISTED_CABLE_100.key,
      'malva-offer-x',
      'malva-offer-y',
    ]);
  });
});
