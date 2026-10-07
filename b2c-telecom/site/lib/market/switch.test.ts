import { marketFor } from '@/lib/utils';
import { planMarketSwitch, type SwitchCart } from './switch';

const de = marketFor('de-DE');
const us = marketFor('en-US');
const usdCart: SwitchCart = {
  currency: 'USD',
  country: 'US',
  lines: [
    { offerKey: 'malva-offer-cable-500', name: 'Cable 500' },
    { offerKey: 'malva-offer-spotify', name: 'Spotify' },
  ],
};

describe('planMarketSwitch', () => {
  it('no cart: action none', () => {
    expect(planMarketSwitch(de, null)).toEqual({ market: de, cart: { action: 'none', droppedLines: [] } });
  });

  it('empty cart: action none', () => {
    expect(planMarketSwitch(de, { currency: 'USD', country: 'US', lines: [] }).cart).toEqual({ action: 'none', droppedLines: [] });
  });

  it('Region switched with a cart: a USD cart is discarded when switching to the EUR market', () => {
    const plan = planMarketSwitch(de, usdCart);
    expect(plan.market).toEqual(de);
    expect(plan.cart.action).toBe('discarded');
  });

  it('Product not sellable in the new region: every dropped line is named in droppedLines, in order', () => {
    expect(planMarketSwitch(de, usdCart).cart.droppedLines).toEqual([
      { offerKey: 'malva-offer-cable-500', name: 'Cable 500' },
      { offerKey: 'malva-offer-spotify', name: 'Spotify' },
    ]);
  });

  it('same-market cart: action none', () => {
    expect(planMarketSwitch(us, usdCart).cart).toEqual({ action: 'none', droppedLines: [] });
  });
});
