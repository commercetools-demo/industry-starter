import {
  LISTED_CABLE_500,
  LISTED_PHONE_UNLIMITED,
  LISTED_ROUTER_AC1200,
  LISTED_SPOTIFY,
  LISTED_WIRELESS_5G,
  termVariants,
} from './__fixtures__/catalog';
import { addonPrice, termKey, toPlanCardData } from './cardData';

describe('toPlanCardData', () => {
  it('Air 5G is a 5G plan that is most popular', () => {
    const data = toPlanCardData(LISTED_WIRELESS_5G);
    expect(data.chipId).toBe('5g');
    expect(data.mostPopular).toBe(true);
  });

  it('the master variant is the initial term and terms are ordered by months', () => {
    const data = toPlanCardData(LISTED_CABLE_500);
    expect(data.masterSku).toBe('MLV-cable-500-24M');
    expect(data.terms.map((term) => term.termMonths)).toEqual([0, 12, 24]);
    expect(data.terms.find((term) => term.isMaster)?.termMonths).toBe(24);
  });

  it('a variant without a monthly price has price null (never 0)', () => {
    const data = toPlanCardData({ ...LISTED_CABLE_500, variants: [{ ...termVariants('X', [['24M', 1]])[0], recurringPrice: undefined }] });
    expect(data.terms[0].price).toBeNull();
  });

  it('only phone plans take more than one line (D-014), up to 5', () => {
    expect(toPlanCardData(LISTED_PHONE_UNLIMITED).maxLines).toBe(5);
    expect(toPlanCardData(LISTED_CABLE_500).maxLines).toBe(1);
  });

  it('shows at most four bullets', () => {
    const many = { ...LISTED_CABLE_500, facts: { ...LISTED_CABLE_500.facts, highlights: ['1', '2', '3', '4', '5', '6'] } } as typeof LISTED_CABLE_500;
    expect(toPlanCardData(many).bullets).toEqual(['1', '2', '3', '4']);
  });

  it('termKey maps months to message keys', () => {
    expect([0, 12, 24].map((months) => termKey(months as 0 | 12 | 24))).toEqual(['month-to-month', '12-months', '24-months']);
  });
});

describe('addonPrice', () => {
  it('monthly add-ons are recurring', () => {
    expect(addonPrice(LISTED_SPOTIFY)).toEqual({ amount: { centAmount: 1000, currencyCode: 'USD' }, recurring: true });
  });

  it('a router is rented monthly on its master variant', () => {
    expect(addonPrice(LISTED_ROUTER_AC1200)?.recurring).toBe(true);
  });

  it('an offer with no price has none', () => {
    expect(addonPrice({ ...LISTED_SPOTIFY, variants: [] })).toBeNull();
  });
});
