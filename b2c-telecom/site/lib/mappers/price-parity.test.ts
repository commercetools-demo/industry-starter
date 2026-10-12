// @vitest-environment node
// The price on a card must be the price of the line the cart creates. The card is the storefront's own selection (`selectPrices`); the cart
// is the engine, modelled here from the platform's documented rule, independently of the storefront code: a price applies when its
// customer group is the cart's group (or it has none) and its channel is the line's distribution channel (or it has none) and its country
// is the cart's country (or it has none); among those, a price made for the group or channel wins, then the lowest amount.
// Run over every seeded offer variant, every audience and both channels.
import { MANIFEST } from '@/scripts/seed/data';
import type { ProductDraft } from '@/scripts/seed/types';
import { audienceCases } from '@/test/fixtures/audiences';
import type { Market } from '@/lib/types';
import { selectPrices, type RawPrice } from './price';

const US: Market = { locale: 'en-US', currency: 'USD', country: 'US' };
const NOW = new Date('2026-10-12T00:00:00Z');
const OFFERS = (MANIFEST.product as ProductDraft[]).filter((product) => product.productType === 'malva-offer');
const CHANNELS = [null, 'call-center'] as const;

const raw = (price: ProductDraft['masterVariant']['prices'][number]): RawPrice => ({
  value: price.value,
  ...(price.country ? { country: price.country } : {}),
  ...(price.recurrencePolicy ? { recurrencePolicy: { id: price.recurrencePolicy } } : {}),
  ...(price.customerGroup ? { customerGroup: { id: price.customerGroup } } : {}),
  ...(price.channel ? { channel: { id: price.channel } } : {}),
});

/** The engine's pick for one kind of price (recurring or one-time) on a line. */
function enginePrice(prices: RawPrice[], market: Market, cartGroup: string | null, channel: string | null, recurring: boolean): number | undefined {
  const fits = prices.filter(
    (price) =>
      price.value.currencyCode === market.currency &&
      Boolean(price.recurrencePolicy) === recurring &&
      (price.country === undefined || price.country === market.country) &&
      (!price.customerGroup || (price.customerGroup as { id: string }).id === cartGroup) &&
      (!price.channel || (price.channel as { id: string }).id === channel),
  );
  const scoped = fits.filter((price) => price.customerGroup || price.channel);
  const pool = scoped.length > 0 ? scoped : fits;
  return pool.length === 0 ? undefined : Math.min(...pool.map((price) => price.value.centAmount));
}

describe('card price equals cart line price', () => {
  it('for every seeded variant, audience and channel', () => {
    let compared = 0;
    for (const offer of OFFERS) {
      for (const variant of [offer.masterVariant, ...offer.variants]) {
        const prices = variant.prices.map(raw);
        for (const audience of audienceCases) {
          for (const channel of CHANNELS) {
            const card = selectPrices(prices, US, NOW, variant.sku, {
              scope: { groupKeys: audience.groupKeys, channelKey: channel },
              keys: { groupKeyById: Object.fromEntries(audience.allGroups.map((key) => [key, key])), channelKeyById: { 'call-center': 'call-center' } },
            });
            const cartGroup = audience.cartGroup;
            expect(card.recurring?.centAmount, `${variant.sku} recurring ${audience.name} ${channel}`).toBe(enginePrice(prices, US, cartGroup, channel, true));
            expect(card.oneTime?.centAmount, `${variant.sku} one-time ${audience.name} ${channel}`).toBe(enginePrice(prices, US, cartGroup, channel, false));
            compared += 1;
          }
        }
      }
    }
    expect(compared).toBeGreaterThan(100);
  });

  it('the scoped prices matter: the bundle is cheaper for small business, and the phone plan is cheaper in the call-center channel', () => {
    const bundle = OFFERS.find((offer) => offer.key === 'malva-offer-bundle-cable-phone')!;
    const phone = OFFERS.find((offer) => offer.key === 'malva-offer-phone-unlimited')!;
    const keys = { groupKeyById: { 'small-business': 'small-business' }, channelKeyById: { 'call-center': 'call-center' } };
    const price = (offer: ProductDraft, sku: string, groupKeys: string[], channelKey: string | null) =>
      selectPrices((offer.masterVariant.sku === sku ? offer.masterVariant : offer.variants.find((v) => v.sku === sku)!).prices.map(raw), US, NOW, sku, { scope: { groupKeys, channelKey }, keys }).recurring?.centAmount;
    expect(price(bundle, 'MLV-BDL-CBL-PHN-24M', [], null)).toBe(7500);
    expect(price(bundle, 'MLV-BDL-CBL-PHN-24M', ['small-business'], null)).toBe(5900);
    expect(price(phone, 'MLV-PHN-UNL-M2M', [], null)).toBe(5000);
    expect(price(phone, 'MLV-PHN-UNL-M2M', [], 'call-center')).toBe(4500);
  });
});
