import { describe, expect, it } from 'vitest';
import type { AttributeType } from '../../types';
import { productTypes } from '../product-types';
import { SHARED_NAMES, own, shared } from './attributes';
import { sharedDefinitionErrors } from '../catalog-validate';

function enumsIn(type: AttributeType): { keys: string[]; labels: unknown[]; localized: boolean }[] {
  if (type.name === 'enum') return [{ keys: type.values.map((v) => v.key), labels: type.values.map((v) => v.label), localized: false }];
  if (type.name === 'lenum') return [{ keys: type.values.map((v) => v.key), labels: type.values.map((v) => v.label), localized: true }];
  if (type.name === 'set') return enumsIn(type.elementType);
  return [];
}

describe('shared attribute definitions', () => {
  it('Same attribute name has one definition: shared names have identical definitions across all product types', () => {
    expect(sharedDefinitionErrors(productTypes)).toEqual([]);
    const byName = new Map<string, string[]>();
    for (const type of productTypes) for (const a of type.attributes) byName.set(a.name, [...(byName.get(a.name) ?? []), type.key]);
    for (const name of SHARED_NAMES) {
      const used = byName.get(name) ?? [];
      expect(used.length, `${name} is used`).toBeGreaterThan(0);
    }
    // the platform rejects conflicting definitions of one name: the helper catches a deliberate conflict
    const conflicting = [
      { ...productTypes[0], attributes: [shared('data-gb')] },
      { ...productTypes[1], attributes: [{ ...shared('data-gb'), attributeConstraint: 'None' as const }] },
    ];
    expect(sharedDefinitionErrors(conflicting)).toHaveLength(1);
  });

  it('enum keys are unique within every enum', () => {
    for (const type of productTypes) {
      for (const a of type.attributes) {
        for (const e of enumsIn(a.type)) expect(new Set(e.keys).size, `${type.key}.${a.name}`).toBe(e.keys.length);
      }
    }
  });

  it('every lenum label has both locales', () => {
    for (const type of productTypes) {
      for (const a of type.attributes) {
        expect(a.label['en-US'], `${a.name} label`).toBeTruthy();
        expect(a.label['de-DE'], `${a.name} label`).toBeTruthy();
        for (const e of enumsIn(a.type).filter((x) => x.localized)) {
          for (const label of e.labels as Record<string, string>[]) {
            expect(label['en-US']).toBeTruthy();
            expect(label['de-DE']).toBeTruthy();
          }
        }
      }
    }
  });

  it('the add-on tag vocabulary is Music, Video, Extras', () => {
    const tag = shared('addon-tag');
    expect(tag.type).toMatchObject({ name: 'lenum' });
    expect((tag.type as { values: { key: string }[] }).values.map((v) => v.key)).toEqual(['music', 'video', 'extras']);
  });

  it('shared() refuses an unknown name and own() refuses a shared name', () => {
    expect(() => shared('nope')).toThrow(/No shared attribute/);
    expect(() => own('data-gb', 'a', 'b', { name: 'number' })).toThrow(/shared/);
  });

  it('a type may change only requiredness and label of a shared definition', () => {
    const base = shared('data-gb');
    const required = shared('data-gb', { isRequired: true });
    expect({ ...required, isRequired: base.isRequired }).toEqual(base);
  });
});
