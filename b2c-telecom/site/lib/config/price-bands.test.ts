import { getPriceBands, inBand } from './price-bands';

describe('price bands', () => {
  it('USD and EUR share the same four bands in minor units', () => {
    expect(getPriceBands('USD')).toEqual(getPriceBands('EUR'));
    expect(getPriceBands('USD').map((band) => band.id)).toEqual(['lt-25', '25-50', '50-75', 'gt-75']);
  });

  it('min is inclusive and max exclusive', () => {
    const bands = getPriceBands('USD');
    const bandOf = (centAmount: number) => bands.find((band) => inBand(band, centAmount))?.id;
    expect(bandOf(2499)).toBe('lt-25');
    expect(bandOf(2500)).toBe('25-50');
    expect(bandOf(4999)).toBe('25-50');
    expect(bandOf(5000)).toBe('50-75');
    expect(bandOf(7500)).toBe('gt-75');
    expect(bandOf(0)).toBe('lt-25');
  });

  it('throws for another currency', () => {
    expect(() => getPriceBands('GBP')).toThrow('No price bands for currency GBP');
  });
});
