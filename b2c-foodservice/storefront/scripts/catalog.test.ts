import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { catalogComponents } from '@/components/page-builder/component-map';
import { mappedTypes, pushable, unmappedTypes } from './catalog.mjs';

const root = process.cwd();
const mapSource = readFileSync(join(root, 'components/page-builder/component-map.ts'), 'utf8');
const catalog = JSON.parse(readFileSync(join(root, 'page-builder.catalog.json'), 'utf8'));

describe('catalog script guards', () => {
  it('reads the same keys from the component map source as the real map has', () => {
    expect(mappedTypes(mapSource).sort()).toEqual(Object.keys(catalogComponents).sort());
  });

  const withExtra = {
    ...catalog,
    components: { ...catalog.components, components: [...catalog.components.components, { type: 'promo/countdown', name: {}, icon: 'x', groupKey: 'content', schema: [] }] },
  };

  it('names the catalog types that have no component yet', () => {
    expect(unmappedTypes(catalog, mapSource)).toEqual([]);
    expect(unmappedTypes(withExtra, mapSource)).toEqual(['promo/countdown']);
  });

  it('finds nothing missing when every type is mapped', () => {
    const all = `export const catalogComponents = {\n${catalog.components.components.map((c: { type: string }) => `  '${c.type}': X,`).join('\n')}\n};`;
    expect(unmappedTypes(catalog, all)).toEqual([]);
  });

  it('ignores keys outside the map object', () => {
    const src = `const other = { 'a/b': 1 };\nexport const catalogComponents = {\n  'content/hero': Hero,\n};\nconst after = { 'c/d': 1 };`;
    expect(mappedTypes(src)).toEqual(['content/hero']);
  });

  it('pushes only the types that have a component, and leaves everything else as it was', () => {
    const out = pushable(withExtra, mapSource);
    const types = out.components.components.map((c: { type: string }) => c.type);
    expect(types).toContain('content/hero');
    expect(types).not.toContain('promo/countdown');
    expect(types.every((t: string) => t in catalogComponents)).toBe(true);
    expect(out['data-sources']).toBe(catalog['data-sources']);
    expect(out.sections).toBe(catalog.sections);
    expect(withExtra.components.components.length).toBe(types.length + 1);
  });
});
