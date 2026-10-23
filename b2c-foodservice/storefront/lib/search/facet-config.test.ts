import { describe, expect, it } from 'vitest';
import type { ProductType } from '@commercetools/platform-sdk';
import { TAG, TTL } from '@/lib/cache-keys';
import { mapAttributeLabels } from '@/lib/mappers/attribute-labels';
import { FACETS, facetApplies } from '@/lib/search/facet-config';
import { priceBands } from '@/lib/search/price-bands';

describe('facet config', () => {
  it('enum fields point at .key and use enum', () => {
    for (const name of ['system', 'roast', 'colour']) {
      const f = FACETS.find((x) => x.name === name)!;
      expect(f.field.endsWith('.key')).toBe(true);
      expect(f.fieldType).toBe('enum');
    }
  });
  it('set enum keeps set_ prefix', () => {
    expect(FACETS.find((f) => f.name === 'brew')).toMatchObject({ fieldType: 'set_enum', field: 'variants.attributes.brewMethods.key' });
  });
  it('every facet has a param name and label key', () => {
    expect(new Set(FACETS.map((f) => f.name)).size).toBe(13);
    for (const f of FACETS) {
      expect(f.name).toMatch(/^[a-z]+$/);
      expect(f.labelKey.length).toBeGreaterThan(0);
    }
  });
  it('applies to category roots, everything on shop', () => {
    const roast = FACETS.find((f) => f.name === 'roast')!;
    expect(facetApplies(roast, 'coffee')).toBe(true);
    expect(facetApplies(roast, 'machines')).toBe(false);
    expect(facetApplies(roast, null)).toBe(true);
  });
});

describe('price bands', () => {
  it('price bands are contiguous and per currency', () => {
    for (const cur of ['USD', 'CAD']) {
      const b = priceBands(cur);
      expect(b).toHaveLength(5);
      for (let i = 1; i < b.length; i += 1) expect(b[i]!.from).toBe(b[i - 1]!.to);
      expect(b[0]!.from).toBeUndefined();
      expect(b[4]!.to).toBeUndefined();
    }
  });
});

describe('attribute labels', () => {
  const types = [
    { attributes: [{ name: 'roast', type: { name: 'enum', values: [{ key: 'dark', label: 'Dark' }] } },
      { name: 'brewMethods', type: { name: 'set', elementType: { name: 'enum', values: [{ key: 'moka', label: 'Moka' }] } } }] },
    { attributes: [{ name: 'colour', type: { name: 'lenum', values: [{ key: 'red', label: { 'en-US': 'Red', 'en-CA': 'Red' } }] } }] },
  ] as unknown as ProductType[];
  it('labels map enum keys per locale', () => {
    const l = mapAttributeLabels(types, 'en-CA');
    expect(l.roast!.dark).toBe('Dark');
    expect(l.brewMethods!.moka).toBe('Moka');
    expect(l.colour!.red).toBe('Red');
  });
  it('labels cached for an hour', () => {
    expect(TTL.attributeLabels).toBe(3600);
    expect(TAG.attributeLabels).toBe('attribute-labels');
  });
});
