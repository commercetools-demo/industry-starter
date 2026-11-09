import { describe, expect, it } from 'vitest';
import { firstForcedTool, matchesAny, matchesTermsAndCues } from '../common/grounding';
import { SHOPPING_CONFIG } from '../deployment';
import { defineShoppingConfig } from './config';
import { GROUNDING_RULES } from './grounding';
import { type Product, newSessionState, rememberProducts } from './types';

const state = () => newSessionState();
const forced = (text: string, st = state(), config = SHOPPING_CONFIG) => firstForcedTool(GROUNDING_RULES, config, text, st);
const product = (id: string): Product => ({ productId: id, title: id, price: 1, currency: 'USD', labels: [], attributes: {}, inStock: true, options: {}, optionValues: {} });

describe('grounding', () => {
  it('Order question forces the order read', () => {
    expect(forced('where is my order MC-ABC1234567')).toBe('get_orders');
    expect(forced("Where's my parcel?")).toBe('get_orders');
    expect(forced('has my shipment arrived')).toBe('get_orders');
  });

  it('Ordinary shopping talk does not force anything', () => {
    expect(forced('I want something strong for my espresso machine')).toBeNull();
    expect(forced('it was delivered yesterday and was great')).toBeNull();
  });

  it('A terms question is not grounded here because there is no policy corpus', () => {
    expect(forced('what is your return policy?')).toBeNull();
    expect(forced('what is your return policy?', state(), defineShoppingConfig('m', { enablePolicies: true }))).toBe('search_policies');
  });

  it('Real SKU shapes match and order numbers do not', () => {
    for (const sku of ['MCF-POD-EMBER-50', 'MCF-COF-CASA-250-WB', 'MCF-MAC-LEVER15-RED-M', 'MCF-ACC-MILK-BLK', 'MCF-GFT-BOX-A', 'mcf-pod-ember-50', 'MCF-COFFEE-CASA-250G']) {
      expect(forced(`tell me about ${sku}`), sku).toBe('get_product_details');
    }
    expect(forced('status of my order MC-ABC1234567')).toBe('get_orders');
    expect(forced('MC-ABC1234567')).toBeNull();
  });

  it('An id the session already resolved is not forced again, compared case-insensitively', () => {
    const st = state();
    rememberProducts(st, [product('MCF-POD-EMBER-50')], 60);
    expect(forced('add mcf-pod-ember-50', st)).toBeNull();
    expect(forced('add MCF-POD-EMBER-100', st)).toBe('get_product_details');
  });

  it('Precedence: orders come before the catalogue', () => {
    expect(forced('where is my order with MCF-POD-EMBER-50?')).toBe('get_orders');
  });

  it('A rule whose system is off never fires', () => {
    expect(forced('where is my order?', state(), defineShoppingConfig('m', { ...SHOPPING_CONFIG, enableOrders: false }))).toBeNull();
    expect(forced('MCF-POD-EMBER-50', state(), defineShoppingConfig('m', { ...SHOPPING_CONFIG, catalogGroundingGate: false }))).toBeNull();
  });

  it('Matching is whole word, case-insensitive, with a literal question mark', () => {
    expect(matchesAny('Ordering pizza', ['order'])).toBe(false);
    expect(matchesAny('ORDER now', ['order'])).toBe(true);
    expect(matchesAny('really?', ['?'])).toBe(true);
    expect(matchesTermsAndCues('', ['a'], ['?'])).toBe(false);
    expect(matchesTermsAndCues('x', [], ['x'])).toBe(false);
  });
});
