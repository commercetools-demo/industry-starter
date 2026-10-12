import { describe, expect, it } from 'vitest';
import { basePriceKey, countryOfCurrency, standalonePriceKey } from '@/lib/catalog/price-keys';

// Expected values are the keys the seed writes (seed/src/data/prices.ts `channelPriceKey`, `baseKey`).
describe('price key scheme', () => {
  it("standalonePriceKey equals the seed's channelPriceKey for EUR and USD (MLV-BP-41001__mau-dist-north, MLV-BP-41001__mau-dist-south__usd)", () => {
    expect(standalonePriceKey('MLV-BP-41001', 'mau-dist-north', 'EUR')).toBe('MLV-BP-41001__mau-dist-north');
    expect(standalonePriceKey('MLV-BP-41001', 'mau-dist-south', 'USD')).toBe('MLV-BP-41001__mau-dist-south__usd');
    expect(standalonePriceKey('MLV-BP-41001', 'mau-br-north-berlin', 'EUR')).toBe('MLV-BP-41001__mau-br-north-berlin');
    expect(basePriceKey('MLV-BP-41001', 'EUR')).toBe('MLV-BP-41001__base-eur-de');
    expect(basePriceKey('MLV-BP-41001', 'USD')).toBe('MLV-BP-41001__base-usd-us');
  });

  it('country follows the currency', () => {
    expect(countryOfCurrency('EUR')).toBe('DE');
    expect(countryOfCurrency('USD')).toBe('US');
  });

  it('characters outside A-Z a-z 0-9 _ - are replaced by a dash', () => {
    expect(standalonePriceKey('A B/1', 'ch.1', 'EUR')).toBe('A-B-1__ch-1');
  });
});
