import { getMinimumOrder, shortfall } from './minimum';

describe('minimum order', () => {
  it('Below minimum order value: shortfall is an amount', () => {
    expect(shortfall({ centAmount: 2500, currencyCode: 'USD' }, 'USD')).toEqual({ centAmount: 500, currencyCode: 'USD' });
    expect(shortfall({ centAmount: 1000, currencyCode: 'EUR' }, 'EUR')).toEqual({ centAmount: 1800, currencyCode: 'EUR' });
  });
  it('no shortfall at or above the minimum', () => {
    expect(shortfall({ centAmount: 3000, currencyCode: 'USD' }, 'USD')).toBeNull();
    expect(shortfall({ centAmount: 9000, currencyCode: 'USD' }, 'USD')).toBeNull();
  });
  it('an unknown currency has no minimum', () => {
    expect(getMinimumOrder('GBP')).toBeNull();
    expect(shortfall({ centAmount: 1, currencyCode: 'GBP' }, 'GBP')).toBeNull();
  });
  it('returns the configured minimum', () => {
    expect(getMinimumOrder('USD')).toEqual({ centAmount: 3000, currencyCode: 'USD' });
  });
});
