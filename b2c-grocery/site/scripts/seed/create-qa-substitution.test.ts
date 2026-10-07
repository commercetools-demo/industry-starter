import { describe, expect, it, vi } from 'vitest';
import { DEFS, skuOf } from './data/catalog';
import { DEFAULT_LINE_SKU, DEFAULT_SUBSTITUTE_SKU, createQaSubstitution, parseArgs, proposalDraft } from './create-qa-substitution';

const order = { id: 'o-1', lineItems: [{ id: 'l-a', quantity: 2, variant: { sku: 'BANANAS-500G' } }, { id: 'l-m', quantity: 3, variant: { sku: 'WHOLE-MILK-1EACH' } }] };

describe('create-qa-substitution', () => {
  it('default SKUs exist in the seeded catalog and the substitute is the seeded substitute of the line', () => {
    const skus = DEFS.flatMap((d) => d.variants.map((v) => skuOf(d.key, v)));
    expect(skus).toContain(DEFAULT_LINE_SKU);
    expect(skus).toContain(DEFAULT_SUBSTITUTE_SKU);
    expect(DEFS.find((d) => d.key === 'whole-milk')?.sub).toBe('oat-drink');
  });

  it('parseArgs: defaults, options and missing values', () => {
    expect(parseArgs([])).toEqual({ lineSku: DEFAULT_LINE_SKU, substituteSku: DEFAULT_SUBSTITUTE_SKU, note: expect.any(String) });
    expect(parseArgs(['--order', 'o-9', '--line-sku', 'A', '--substitute-sku', 'B', '--note', 'hi'])).toEqual({ orderId: 'o-9', lineSku: 'A', substituteSku: 'B', note: 'hi' });
    expect(() => parseArgs(['--order'])).toThrow('needs a value');
    expect(() => parseArgs(['--order', '--note', 'x'])).toThrow('needs a value');
  });

  it('proposalDraft: removes the line, adds the substitute with the same quantity, pending proposal fields', () => {
    const draft = proposalDraft(order, { lineSku: 'WHOLE-MILK-1EACH', substituteSku: 'OAT-DRINK-1EACH', note: 'n' });
    expect(draft.resource).toEqual({ typeId: 'order', id: 'o-1' });
    expect(draft.stagedActions).toEqual([
      { action: 'removeLineItem', lineItemId: 'l-m' },
      { action: 'addLineItem', sku: 'OAT-DRINK-1EACH', quantity: 3, custom: { type: { typeId: 'type', key: 'line-substitution' }, fields: { substitutionPreference: 'none' } } },
    ]);
    expect(draft.custom).toEqual({
      type: { typeId: 'type', key: 'substitution-proposal' },
      fields: { originalLineItemId: 'l-m', substituteSku: 'OAT-DRINK-1EACH', status: 'pending', note: 'n' },
    });
    expect(draft).not.toHaveProperty('dryRun');
  });

  it('proposalDraft: unknown line or same SKU throws', () => {
    expect(() => proposalDraft(order, { lineSku: 'NOPE', substituteSku: 'B', note: '' })).toThrow('no line with SKU NOPE');
    expect(() => proposalDraft(order, { lineSku: 'BANANAS-500G', substituteSku: 'BANANAS-500G', note: '' })).toThrow('different SKU');
  });

  it('createQaSubstitution on an existing order: reads it and posts exactly one edit (never applies it)', async () => {
    const post = vi.fn(() => ({ execute: async () => ({ body: { id: 'edit-1' } }) }));
    const apply = vi.fn();
    const root = {
      orders: () => ({
        withId: () => ({ get: () => ({ execute: async () => ({ body: order }) }) }),
        edits: () => ({ post, withId: () => ({ apply: () => ({ post: apply }) }) }),
      }),
    };
    const r = await createQaSubstitution(root as never, { orderId: 'o-1', lineSku: 'WHOLE-MILK-1EACH', substituteSku: 'OAT-DRINK-1EACH', note: 'n' });
    expect(r).toEqual({ orderId: 'o-1', editId: 'edit-1' });
    expect(post).toHaveBeenCalledTimes(1);
    expect(apply).not.toHaveBeenCalled();
  });
});
