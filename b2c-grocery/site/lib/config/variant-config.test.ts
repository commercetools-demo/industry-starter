import { describe, it, expect } from 'vitest';
import { makeProduct, makeVariant } from '@/test/product';
import { buildSelectors, pickVariant, VARIANT_CONFIG } from './variant-config';

const weighed = (over: Record<string, { stock?: boolean }> = {}) =>
  makeProduct({
    variants: [
      { sku: 'B-2KG', value: 2000, label: '2 kg' },
      { sku: 'B-500G', value: 500, label: '500 g' },
      { sku: 'B-1KG', value: 1000, label: '1 kg' },
    ].map((v, i) =>
      makeVariant({
        id: i + 1,
        sku: v.sku,
        attributes: { packLabel: v.label, incrementValue: v.value, incrementUnit: 'g', approximateWeight: true, brand: 'Orchard Fresh' },
        increment: { value: v.value, unit: 'g', label: v.label },
        availability: { isOnStock: over[v.sku]?.stock ?? true, availableQuantity: 10 },
      }),
    ),
  });

describe('buildSelectors', () => {
  it('weighed product: one packLabel selector sorted 500 g, 1 kg, 2 kg', () => {
    const selectors = buildSelectors(weighed());
    expect(selectors).toHaveLength(1);
    expect(selectors[0].name).toBe('packLabel');
    expect(selectors[0].kind).toBe('segmented');
    expect(selectors[0].options.map((o) => o.label)).toEqual(['500 g', '1 kg', '2 kg']);
    expect(selectors[0].options.map((o) => o.sku)).toEqual(['B-500G', 'B-1KG', 'B-2KG']);
  });

  it('blocklisted attributes never appear, even when they vary', () => {
    const names = buildSelectors(weighed()).map((s) => s.name);
    expect(names).not.toContain('incrementValue');
    expect(names).not.toContain('approximateWeight');
    expect(names).not.toContain('incrementUnit');
    expect(names).not.toContain('brand');
  });

  it('single-variant product: no selectors', () => {
    expect(buildSelectors(makeProduct())).toEqual([]);
  });

  it('unavailable combination: the option is disabled', () => {
    const [selector] = buildSelectors(weighed({ 'B-2KG': { stock: false } }), 'B-500G');
    expect(selector.options.find((o) => o.label === '2 kg')).toMatchObject({ disabled: true, sku: 'B-2KG' });
    expect(selector.options.find((o) => o.label === '1 kg')?.disabled).toBe(false);
  });

  it('selected option follows the sku and is never disabled', () => {
    const [selector] = buildSelectors(weighed({ 'B-1KG': { stock: false } }), 'B-1KG');
    expect(selector.selected).toBe('1 kg');
    expect(selector.options.find((o) => o.label === '1 kg')?.disabled).toBe(false);
  });

  it('without a sku the selection is the first variant in stock', () => {
    expect(buildSelectors(weighed({ 'B-2KG': { stock: false } }))[0].selected).toBe('500 g');
  });

  it('second attribute: other selections decide the option sku; a missing combination is disabled', () => {
    const v = (sku: string, packLabel: string, finish: string, value: number) =>
      makeVariant({ sku, attributes: { packLabel, finish }, increment: { value, unit: 'g', label: packLabel } });
    const product = makeProduct({ variants: [v('A', '500 g', 'ripe', 500), v('B', '1 kg', 'ripe', 1000), v('C', '1 kg', 'green', 1000)] });
    const selectors = buildSelectors(product, 'A');
    expect(selectors.map((s) => s.name)).toEqual(['packLabel', 'finish']);
    expect(selectors[1].options.find((o) => o.value === 'green')).toMatchObject({ sku: null, disabled: true });
    expect(selectors[0].options.find((o) => o.value === '1 kg')?.sku).toBe('B');
  });

  it('config decides the kind: a swatch mapping gives swatches, a radio entry gives radios', () => {
    const v = (sku: string, finish: string) => makeVariant({ sku, attributes: { finish } });
    const product = makeProduct({ variants: [v('A', 'ripe'), v('B', 'green')] });
    VARIANT_CONFIG.swatch.finish = { ripe: '#f5d000', green: '#8bc34a' };
    try {
      expect(buildSelectors(product)[0].kind).toBe('swatch');
    } finally {
      delete VARIANT_CONFIG.swatch.finish;
    }
    VARIANT_CONFIG.radio.push('finish');
    try {
      expect(buildSelectors(product)[0].kind).toBe('radio');
    } finally {
      VARIANT_CONFIG.radio.pop();
    }
  });
});

describe('pickVariant', () => {
  it('sku selects that variant; unknown sku falls back to the first in stock, else the first', () => {
    const product = weighed({ 'B-2KG': { stock: false } });
    expect(pickVariant(product, 'B-1KG')?.sku).toBe('B-1KG');
    expect(pickVariant(product, 'nope')?.sku).toBe('B-500G');
    const none = makeProduct({ variants: [makeVariant({ sku: 'X', availability: { isOnStock: false, availableQuantity: 0 } })] });
    expect(pickVariant(none)?.sku).toBe('X');
  });
});
