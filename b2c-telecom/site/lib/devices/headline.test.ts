import { NOVA_5G, NOVA_PRO, usd } from './__fixtures__/devices';
import { deviceHeadline } from './headline';

describe('deviceHeadline', () => {
  it('Nova 5G: from $20.00 a month over 36 months, $720.00 outright', () => {
    expect(deviceHeadline(NOVA_5G)).toEqual({ fromMonthly: usd(2000), outright: usd(72000) });
  });
  it('Nova Pro: from $28.00 a month, $1,008.00 outright', () => {
    expect(deviceHeadline(NOVA_PRO)).toEqual({ fromMonthly: usd(2800), outright: usd(100800) });
  });
  it('falls back to the longest term any variant offers and omits what has no price', () => {
    const only24 = { ...NOVA_5G, variants: NOVA_5G.variants.map((variant) => ({ ...variant, prices: { ...variant.prices, outright: undefined, installments: { 24: usd(3000) } } })) };
    expect(deviceHeadline(only24)).toEqual({ fromMonthly: usd(3000) });
    expect(deviceHeadline({ ...NOVA_5G, variants: [] })).toEqual({});
  });
});
