import type { Market } from '@/lib/types';
import { selectPrices, selectRecurringPrices, type RawPrice } from './price';

const US: Market = { locale: 'en-US', currency: 'USD', country: 'US' };
const DE: Market = { locale: 'de-DE', currency: 'EUR', country: 'DE' };
const NOW = new Date('2026-10-07T12:00:00Z');
const policy = { typeId: 'recurrence-policy', id: 'p1' };

const price = (centAmount: number, currencyCode: string, rest: Partial<RawPrice> = {}): RawPrice => ({ value: { centAmount, currencyCode }, ...rest });

describe('selectPrices', () => {
  it('returns the recurring and the one-time price of the market', () => {
    const prices = [
      price(5999, 'USD', { country: 'US', recurrencePolicy: policy }),
      price(6000, 'EUR', { country: 'DE', recurrencePolicy: policy }),
      price(2500, 'USD', { country: 'US' }),
    ];
    expect(selectPrices(prices, US, NOW)).toEqual({
      recurring: { centAmount: 5999, currencyCode: 'USD' },
      oneTime: { centAmount: 2500, currencyCode: 'USD' },
    });
    expect(selectPrices(prices, DE, NOW)).toEqual({ recurring: { centAmount: 6000, currencyCode: 'EUR' } });
  });

  it('a country-specific price wins over a country-less one of the same kind', () => {
    const prices = [price(1000, 'USD', { recurrencePolicy: policy }), price(1500, 'USD', { country: 'US', recurrencePolicy: policy })];
    expect(selectPrices(prices, US, NOW).recurring?.centAmount).toBe(1500);
  });

  it('a price of another country is ignored and a country-less price applies', () => {
    expect(selectPrices([price(900, 'USD', { country: 'CA' })], US, NOW)).toEqual({});
    expect(selectPrices([price(900, 'USD')], US, NOW).oneTime?.centAmount).toBe(900);
  });

  it('another currency is ignored', () => {
    expect(selectPrices([price(5999, 'GBP', { recurrencePolicy: policy })], US, NOW)).toEqual({});
  });

  it('a channel or customer group price is ignored with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const prices = [price(100, 'USD', { channel: { id: 'c' }, recurrencePolicy: policy }), price(200, 'USD', { customerGroup: { id: 'g' } })];
    expect(selectPrices(prices, US, NOW, 'MLV-X')).toEqual({});
    expect(warn).toHaveBeenCalledWith('[catalog] ignoring scoped price', 'MLV-X');
    warn.mockRestore();
  });

  it('a price whose validFrom is in the future or validUntil has passed is ignored', () => {
    const prices = [
      price(100, 'USD', { validFrom: '2026-11-01T00:00:00Z', recurrencePolicy: policy }),
      price(200, 'USD', { validUntil: '2026-10-07T12:00:00Z', recurrencePolicy: policy }),
      price(300, 'USD', { validFrom: '2026-10-01T00:00:00Z', validUntil: '2026-12-01T00:00:00Z', recurrencePolicy: policy }),
    ];
    expect(selectPrices(prices, US, NOW).recurring?.centAmount).toBe(300);
  });

  it('the lowest of duplicates wins', () => {
    const prices = [price(700, 'USD', { country: 'US', recurrencePolicy: policy }), price(600, 'USD', { country: 'US', recurrencePolicy: policy })];
    expect(selectPrices(prices, US, NOW).recurring?.centAmount).toBe(600);
  });

  it('no prices returns an empty object', () => {
    expect(selectPrices([], US, NOW)).toEqual({});
  });
});

describe('selectRecurringPrices', () => {
  it('lists every recurring price of the market, lowest first', () => {
    const prices = [
      price(2079, 'USD', { country: 'US', recurrencePolicy: policy }),
      price(1386, 'USD', { country: 'US', recurrencePolicy: policy }),
      price(49900, 'USD', { country: 'US' }),
      price(4200, 'EUR', { country: 'DE', recurrencePolicy: policy }),
    ];
    expect(selectRecurringPrices(prices, US, NOW).map((money) => money.centAmount)).toEqual([1386, 2079]);
  });
});
