import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import { describe, expect, it } from 'vitest';
import { catalogComponents } from '@/components/page-builder/component-map';

/**
 * The catalog is this storefront's half of the contract with the service. The service validates it again on push; these checks
 * fail earlier, on the change request, and add the one rule only this repo can check: catalog types and component map agree.
 */
const read = (path: string) => JSON.parse(readFileSync(join(process.cwd(), path), 'utf8')) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const catalog = read('page-builder.catalog.json');
const schema = read('node_modules/@commercetools-labs/page-builder/catalog.schema.json');

const components: Array<Record<string, any>> = catalog.components.components; // eslint-disable-line @typescript-eslint/no-explicit-any
const sources: Array<Record<string, any>> = catalog['data-sources'].sources; // eslint-disable-line @typescript-eslint/no-explicit-any

const PAGE_TYPES = ['all', 'static', 'category', 'pdp', 'dynamic'];
const RESOLVERS = ['product', 'product-list', 'products-by-category', 'product-picks', 'product-pins', 'category', 'category-list', 'category-picks', 'category-pins', 'category-tree', 'related-products'];

describe('catalog structure', () => {
  it('validates against the schema shipped with the shim', () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);
    const ok = validate(catalog);
    expect(ok ? [] : validate.errors).toEqual([]);
  });

  it('type keys and section ids are unique', () => {
    const types = [...components.map((c) => c.type), ...sources.map((s) => s.type)];
    expect(types.filter((t, i) => types.indexOf(t) !== i)).toEqual([]);
    const ids = catalog.sections.sections.map((s: { id: string }) => s.id);
    expect(ids.filter((t: string, i: number) => ids.indexOf(t) !== i)).toEqual([]);
  });

  it('every group key, page type, data source type, resolver and inline field refers to something that exists', () => {
    const groups = new Set(catalog.components.groups.map((g: { key: string }) => g.key));
    const sourceGroups = new Set(catalog['data-sources'].groups.map((g: { key: string }) => g.key));
    const sourceTypes = new Set(sources.map((s) => s.type));
    const problems: string[] = [];
    for (const c of components) {
      if (!groups.has(c.groupKey)) problems.push(`${c.type}: unknown group ${c.groupKey}`);
      for (const p of c.pageTypes ?? []) if (!PAGE_TYPES.includes(p)) problems.push(`${c.type}: unknown page type ${p}`);
      const keys = new Set((c.schema as Array<{ key: string }>).map((f) => f.key));
      for (const k of c.inlineTextFields ?? []) if (!keys.has(k)) problems.push(`${c.type}: inline field ${k} is not in the schema`);
      for (const field of c.schema as Array<{ key: string; kind: string; dataSourceType?: string }>) {
        if (field.kind === 'dataSource' && field.dataSourceType && !sourceTypes.has(field.dataSourceType)) {
          problems.push(`${c.type}.${field.key}: unknown data source type ${field.dataSourceType}`);
        }
      }
    }
    for (const s of sources) {
      if (!sourceGroups.has(s.groupKey)) problems.push(`${s.type}: unknown group ${s.groupKey}`);
      if (!RESOLVERS.includes(s.resolver?.kind)) problems.push(`${s.type}: unknown resolver ${s.resolver?.kind}`);
    }
    expect(problems).toEqual([]);
  });
});

describe('placeable and configurable components', () => {
  const placeable = components.filter((c) => (c.schema as unknown[]).length === 0);
  const listing = placeable.filter((c) => (c.type as string).startsWith('listing/'));
  it('placeable components have no settings and belong to exactly one page type', () => {
    expect(placeable.map((c) => c.type)).toEqual(
      expect.arrayContaining(['listing/facets', 'listing/sort', 'listing/pagination', 'listing/result-header', 'listing/breadcrumbs', 'listing/active-filters', 'product/gallery', 'product/options', 'product/add-to-bag']),
    );
    for (const c of placeable) expect(c.pageTypes).toHaveLength(1);
  });
  it('placeable and listing components do not ask the service for data: the storefront renders its own listing and product', () => {
    expect(placeable.length).toBeGreaterThan(0);
    for (const c of [...placeable, components.find((x) => x.type === 'listing/product-grid')!]) expect(c.fill).toBeUndefined();
  });
  it('the product grid is configurable: tiles per row, price and swatches', () => {
    const grid = components.find((c) => c.type === 'listing/product-grid');
    expect((grid?.schema as Array<{ key: string }>).map((f) => f.key)).toEqual(['itemsPerRow', 'showPrice', 'showSwatches']);
    expect(grid?.pageTypes).toEqual(['category']);
  });
  it('listing components are offered on category pages only; product components on product pages or everywhere', () => {
    for (const c of listing) expect(c.pageTypes).toEqual(['category']);
  });
});

describe('catalog and component map agree', () => {
  const types = new Set(components.map((c) => c.type as string));
  it('every mapped component is in the catalog', () => {
    expect(Object.keys(catalogComponents).filter((k) => !types.has(k))).toEqual([]);
  });
  it('every catalog type has a component', () => {
    // The push would hold back a type without a component (scripts/catalog.mjs), but the catalog in the repository should not carry one.
    expect([...types].filter((t) => !(t in catalogComponents))).toEqual([]);
  });
});
