import { describe, expect, it } from 'vitest';
import { applyPlan, newCtx, planAll } from '../reconcile';
import { FakeCt } from '../test/fake-ct';
import type { AttributeDefinitionDraft, CategoryDraft, ProductTypeDraft, SeedManifest } from '../types';
import { validateManifest } from '../validate';
import { reconcilers } from './registry';

const label = (t: string) => ({ 'en-US': t, 'de-DE': t });
const speed: AttributeDefinitionDraft = { name: 'speed', label: label('Speed'), isRequired: false, type: { name: 'number' } };
const tier: AttributeDefinitionDraft = {
  name: 'tier',
  label: label('Tier'),
  isRequired: false,
  type: { name: 'lenum', values: [{ key: 'basic', label: label('Basic') }] },
};
const kind: AttributeDefinitionDraft = {
  name: 'kind',
  label: label('Kind'),
  isRequired: true,
  attributeConstraint: 'SameForAll',
  type: { name: 'enum', values: [{ key: 'a', label: 'A' }] },
};
const type = (attributes: AttributeDefinitionDraft[]): ProductTypeDraft => ({ key: 'malva-offer', name: 'Offer', description: 'd', attributes });

async function run(api: FakeCt, m: SeedManifest) {
  const ctx = newCtx();
  const plan = await planAll(api, m, reconcilers, ctx);
  return applyPlan(api, m, plan, reconcilers, ctx);
}

describe('product type reconciler', () => {
  it('adds an attribute with addAttributeDefinition', async () => {
    const api = new FakeCt();
    await run(api, { productType: [type([speed])] });
    await run(api, { productType: [type([speed, tier])] });
    expect(api.log.at(-1)).toBe('update product-types malva-offer addAttributeDefinition');
  });

  it('adds enum values with addPlainEnumValue and addLocalizedEnumValue', async () => {
    const api = new FakeCt();
    await run(api, { productType: [type([kind, tier])] });
    const kind2: AttributeDefinitionDraft = { ...kind, type: { name: 'enum', values: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }] } };
    const tier2: AttributeDefinitionDraft = { ...tier, type: { name: 'lenum', values: [{ key: 'basic', label: label('Basic') }, { key: 'plus', label: label('Plus') }] } };
    await run(api, { productType: [type([kind2, tier2])] });
    expect(api.log.at(-1)).toBe('update product-types malva-offer addPlainEnumValue,addLocalizedEnumValue');
  });

  it('an attribute type change is a conflict and nothing is deleted or recreated', async () => {
    const api = new FakeCt();
    await run(api, { productType: [type([speed])] });
    api.writes = 0;
    const results = await run(api, { productType: [type([{ ...speed, type: { name: 'text' } }])] });
    expect(results[0].outcome.status).toBe('skipped');
    expect(api.writes).toBe(0);
    expect(api.log.filter((l) => l.startsWith('delete'))).toEqual([]);
  });

  it('reports an extra attribute without removing it', async () => {
    const api = new FakeCt();
    await run(api, { productType: [type([speed, tier])] });
    api.writes = 0;
    const results = await run(api, { productType: [type([speed])] });
    expect(results[0].outcome.status).toBe('unchanged');
    expect(api.writes).toBe(0);
  });

  it('only changes constraint to None, anything else conflicts', async () => {
    const api = new FakeCt();
    await run(api, { productType: [type([kind])] });
    const results = await run(api, { productType: [type([{ ...kind, attributeConstraint: 'Unique' }])] });
    expect(results[0].outcome.status).toBe('skipped');
    await run(api, { productType: [type([{ ...kind, attributeConstraint: 'None' }])] });
    expect(api.log.at(-1)).toBe('update product-types malva-offer changeAttributeConstraint');
  });

  it('a second run changes nothing', async () => {
    const api = new FakeCt();
    await run(api, { productType: [type([speed, tier, kind])] });
    api.writes = 0;
    await run(api, { productType: [type([speed, tier, kind])] });
    expect(api.writes).toBe(0);
  });
});

describe('category reconciler', () => {
  const root: CategoryDraft = { key: 'malva-cat-root', name: label('Root'), slug: label('root'), orderHint: '0.1' };
  const child: CategoryDraft = { key: 'malva-cat-child', name: label('Child'), slug: label('child'), orderHint: '0.2', parent: 'malva-cat-root' };

  it('creates a category with a parent after the parent', async () => {
    const api = new FakeCt();
    await run(api, { category: [root, child] });
    expect(api.log).toEqual(['create categories malva-cat-root', 'create categories malva-cat-child']);
    expect((api.byKey('categories', 'malva-cat-child')?.ancestors as unknown[]).length).toBe(1);
  });

  it('rejects a child listed before its parent', async () => {
    const api = new FakeCt();
    const errors = await validateManifest(api, { category: [child, root] }, reconcilers);
    expect(errors.map((e) => e.message)).toContain('Category "malva-cat-child" is listed before its parent "malva-cat-root"');
  });

  it('changes the order hint with changeOrderHint on edit and is idempotent otherwise', async () => {
    const api = new FakeCt();
    await run(api, { category: [root, child] });
    api.writes = 0;
    await run(api, { category: [root, child] });
    expect(api.writes).toBe(0);
    await run(api, { category: [root, { ...child, orderHint: '0.9' }] });
    expect(api.log.at(-1)).toBe('update categories malva-cat-child changeOrderHint');
  });

  it('moves a category with changeParent', async () => {
    const api = new FakeCt();
    const other: CategoryDraft = { key: 'malva-cat-other', name: label('Other'), slug: label('other') };
    await run(api, { category: [root, other, child] });
    await run(api, { category: [root, other, { ...child, parent: 'malva-cat-other' }] });
    expect(api.log.at(-1)).toBe('update categories malva-cat-child changeParent');
  });
});
