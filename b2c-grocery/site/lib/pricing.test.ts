import { describe, expect, it } from 'vitest';
import { unitPrice } from '@/lib/pricing';
import type { Increment } from '@/lib/types';

const inc = (value: number, unit: Increment['unit']): Increment => ({ value, unit, label: `${value} ${unit}` });

describe('unitPrice', () => {
  it('500 g pack: per-kg price', () => {
    expect(unitPrice({ centAmount: 240, currencyCode: 'EUR' }, inc(500, 'g'))).toEqual({ money: { centAmount: 480, currencyCode: 'EUR' }, per: 'kg' });
  });
  it('1 kg: per-kg price equals the price', () => {
    expect(unitPrice({ centAmount: 300, currencyCode: 'USD' }, inc(1, 'kg'))).toEqual({ money: { centAmount: 300, currencyCode: 'USD' }, per: 'kg' });
  });
  it('2 kg: divides', () => {
    expect(unitPrice({ centAmount: 500, currencyCode: 'USD' }, inc(2, 'kg'))?.money.centAmount).toBe(250);
  });
  it('250 ml: per-litre price', () => {
    expect(unitPrice({ centAmount: 100, currencyCode: 'USD' }, inc(250, 'ml'))).toEqual({ money: { centAmount: 400, currencyCode: 'USD' }, per: 'l' });
  });
  it('1 l and 2 l: per-litre price', () => {
    expect(unitPrice({ centAmount: 129, currencyCode: 'USD' }, inc(1, 'l'))).toEqual({ money: { centAmount: 129, currencyCode: 'USD' }, per: 'l' });
    expect(unitPrice({ centAmount: 300, currencyCode: 'USD' }, inc(2, 'l'))?.money.centAmount).toBe(150);
  });
  it('uses the discounted amount when present', () => {
    const price = { centAmount: 240, currencyCode: 'EUR', discounted: { centAmount: 200, currencyCode: 'EUR' } };
    expect(unitPrice(price, inc(500, 'g'))?.money.centAmount).toBe(400);
  });
  it('Each item: null', () => {
    expect(unitPrice({ centAmount: 240, currencyCode: 'EUR' }, inc(1, 'each'))).toBeNull();
  });
  it('undefined price: null', () => {
    expect(unitPrice(undefined, inc(500, 'g'))).toBeNull();
  });
  it('rounds half up on cents', () => {
    expect(unitPrice({ centAmount: 1, currencyCode: 'EUR' }, inc(400, 'g'))?.money.centAmount).toBe(3);
    expect(unitPrice({ centAmount: 250, currencyCode: 'EUR' }, inc(3, 'kg'))?.money.centAmount).toBe(83);
  });
  it('zero increment value: null (no division by zero)', () => {
    expect(unitPrice({ centAmount: 100, currencyCode: 'EUR' }, inc(0, 'g'))).toBeNull();
  });
});
