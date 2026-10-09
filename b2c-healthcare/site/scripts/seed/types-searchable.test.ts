import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRODUCT_TYPES, SEARCHED_ATTRIBUTES } from './data/types';

/**
 * D-039: every product attribute the storefront filters, facets or full-text matches on must be `isSearchable` in the seed
 * product types. The test reads the query builders and lists the attribute names they use.
 */
const SOURCES = ['lib/ct/search-query.ts', 'lib/ct/doctors.ts', 'lib/ct/search-all.ts'];
const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

const used = (): Set<string> => {
  const names = new Set<string>();
  for (const file of SOURCES) for (const m of read(file).matchAll(/variants\.attributes\.([A-Za-z]+)/g)) names.add(m[1]);
  // filters and facets are built from a list (`variants.attributes.${name}`)
  const lists = /ENUM_FILTERS = \[([^\]]+)\]/.exec(read('lib/ct/search-query.ts'))?.[1] ?? '';
  for (const m of lists.matchAll(/'([A-Za-z]+)'/g)) names.add(m[1]);
  return names;
};

describe('searched attributes are searchable in the seed product types', () => {
  it('every attribute named in the search code is isSearchable in a product type', () => {
    const searchable = new Set(PRODUCT_TYPES.flatMap((t) => t.attributes.filter((a) => a.isSearchable).map((a) => a.name)));
    const names = used();
    expect([...names]).toEqual(expect.arrayContaining(['specialty', 'city', 'modes', 'rxOnly', 'clinicName']));
    for (const name of names) expect(searchable.has(name), `${name} is searched by the storefront but not searchable in types.ts`).toBe(true);
  });

  it('SEARCHED_ATTRIBUTES lists the clinic and matches the types', () => {
    expect(SEARCHED_ATTRIBUTES['mlv-doctor']).toContain('clinicName');
    for (const [typeKey, names] of Object.entries(SEARCHED_ATTRIBUTES)) {
      const type = PRODUCT_TYPES.find((t) => t.key === typeKey);
      for (const n of names) expect(type?.attributes.find((a) => a.name === n)?.isSearchable, `${typeKey}.${n}`).toBe(true);
    }
  });

  it('the same attribute name has the same isSearchable in every product type', () => {
    const seen = new Map<string, boolean>();
    for (const t of PRODUCT_TYPES) {
      for (const a of t.attributes) {
        if (seen.has(a.name)) expect(seen.get(a.name)).toBe(a.isSearchable);
        seen.set(a.name, a.isSearchable);
      }
    }
  });
});

describe('product type attributes the platform accepts', () => {
  it("no attribute of type 'set' is required (commercetools: \"isRequired=true is not supported for attribute type 'set'\")", () => {
    const bad = PRODUCT_TYPES.flatMap((t) => (t.attributes as { name: string; isRequired: boolean; type: { name: string } }[]).filter((a) => a.isRequired && a.type.name === 'set').map((a) => `${t.key}.${a.name}`));
    expect(bad).toEqual([]);
  });
});
