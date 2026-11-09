import { describe, expect, it } from 'vitest';
import { thinkingRequestFields } from '../common/config';
import { remember } from '../common/types';
import { SHOPPING_CONFIG } from '../deployment';
import { absentTools, defineShoppingConfig } from './config';

describe('shopping config', () => {
  it('Unknown model id sends no thinking field', () => {
    expect(thinkingRequestFields({ model: 'some-other-model', thinkingEffort: 'low' })).toEqual({});
    expect(thinkingRequestFields({ model: 'claude-sonnet-5-5', thinkingEffort: 'low' })).toEqual({
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
    });
    expect(thinkingRequestFields({ model: 'claude-sonnet-5-5', thinkingEffort: null })).toEqual({ thinking: { type: 'disabled' } });
    expect(thinkingRequestFields({ model: 'claude-sonnet-50', thinkingEffort: 'low' })).toEqual({});
  });

  it('Switched-off systems remove their tools', () => {
    const off = absentTools(SHOPPING_CONFIG);
    expect(off.has('search_policies')).toBe(true);
    expect(off.has('get_fulfillment_options')).toBe(true);
    expect(off.has('add_to_cart')).toBe(false);
    expect(off.has('get_order_status')).toBe(false);
    const noCart = absentTools({ ...SHOPPING_CONFIG, enableCart: false, enableOrders: false });
    expect(['get_cart', 'add_to_cart', 'update_cart_item', 'remove_from_cart', 'checkout', 'get_orders', 'get_order_status', 'present_order_status'].every((n) => noCart.has(n))).toBe(true);
  });

  it('The deployment fits the host ceiling and keeps the safety caps', () => {
    expect(SHOPPING_CONFIG.requestTimeoutS).toBeLessThanOrEqual(40);
    expect(SHOPPING_CONFIG.turnDeadlineS).toBeLessThan(60);
    expect(SHOPPING_CONFIG.maxToolIterations).toBeLessThanOrEqual(4);
    expect(SHOPPING_CONFIG.maxQuantityPerItem).toBe(24);
    expect(SHOPPING_CONFIG.maxCartLines).toBe(100);
    expect(SHOPPING_CONFIG.enableMemory).toBe(false);
  });

  it('defineShoppingConfig applies overrides over defaults', () => {
    const c = defineShoppingConfig('claude-sonnet-5-5', { maxQuantityPerItem: 3 });
    expect(c.maxQuantityPerItem).toBe(3);
    expect(c.maxCartLines).toBe(100);
    expect(c.model).toBe('claude-sonnet-5-5');
  });
});

describe('remember', () => {
  it('Provenance with numeric keys keeps insertion order and evicts the oldest', () => {
    const m = new Map<string, number>();
    for (const k of ['10', '2', 'a', '1']) remember(m, k, 1, 3);
    expect([...m.keys()]).toEqual(['2', 'a', '1']);
    remember(m, '2', 2, 3);
    expect([...m.keys()]).toEqual(['a', '1', '2']);
  });
});
