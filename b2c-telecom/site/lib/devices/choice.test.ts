import { NOVA_5G, NOVA_5G_128, NOVA_5G_256_SILVER, NOVA_PRO, NOVA_PRO_256 } from './__fixtures__/devices';
import { defaultTermFor, findVariant, initialChoice, normalizeChoice } from './choice';

describe('normalizeChoice', () => {
  it('leaves a valid choice unchanged', () => {
    expect(normalizeChoice(NOVA_PRO_256, { mode: 'lease', termMonths: 24 })).toEqual({ mode: 'lease', termMonths: 24 });
    expect(normalizeChoice(NOVA_PRO_256, { mode: 'installments', termMonths: 36 })).toEqual({ mode: 'installments', termMonths: 36 });
    expect(normalizeChoice(NOVA_PRO_256, { mode: 'outright', termMonths: 0 })).toEqual({ mode: 'outright', termMonths: 0 });
  });
  it('a lease on a device without lease becomes installments', () => {
    expect(normalizeChoice(NOVA_5G_128, { mode: 'lease', termMonths: 24 })).toEqual({ mode: 'installments', termMonths: 24 });
  });
  it('a term without a price becomes the preferred available term (the Nova 5G 256 Silver hole)', () => {
    expect(normalizeChoice(NOVA_5G_256_SILVER, { mode: 'installments', termMonths: 36 })).toEqual({ mode: 'installments', termMonths: 24 });
  });
  it('a device with outright only keeps pay in full', () => {
    expect(normalizeChoice({ outright: NOVA_5G_128.outright, installments: {}, lease: {} }, { mode: 'installments', termMonths: 24 })).toEqual({ mode: 'outright', termMonths: 0 });
  });
  it('switching to installments from outright gets the default term', () => {
    expect(defaultTermFor(NOVA_PRO_256, 'installments')).toBe(24);
    expect(defaultTermFor(NOVA_PRO_256, 'outright')).toBe(0);
    expect(defaultTermFor(NOVA_PRO_256, 'lease')).toBe(24);
    expect(defaultTermFor({ installments: { 36: NOVA_PRO_256.outright as never }, lease: {} }, 'installments')).toBe(36);
  });
});

describe('variants', () => {
  it('finds the variant of a color and memory', () => {
    expect(findVariant(NOVA_PRO, 'violet', 512)?.sku).toBe('MLV-DEV-NOVAPRO-VLT-512');
    expect(findVariant(NOVA_PRO, 'violet', 128)).toBeUndefined();
  });
  it('starts on the master variant with installments over 24 months', () => {
    expect(initialChoice(NOVA_5G)).toMatchObject({ variant: { sku: 'MLV-DEV-NOVA5G-BLK-128' }, choice: { mode: 'installments', termMonths: 24 } });
    expect(initialChoice({ ...NOVA_5G, variants: [] })).toBeNull();
  });
});
