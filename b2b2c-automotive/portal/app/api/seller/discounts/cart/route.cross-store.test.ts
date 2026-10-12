import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogError } from '@/lib/catalog/errors';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { asUser } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const service = vi.hoisted(() => ({ createDiscount: vi.fn(async () => ({ id: 'd1' })), createDiscountDraft: vi.fn(async () => ({ id: 'draft1' })) }));
vi.mock('@/lib/ct/seller/discounts', () => service);

import { POST } from './route';

const post = (json: Record<string, unknown>) => makeRequest('/api/seller/discounts/cart', { method: 'POST', json });
const rule = { name: { 'en-US': 'Cart -3%' }, condition: { kind: 'cartTotalAtLeast', centAmount: 200000 }, effect: { kind: 'relative', percent: 3 }, stacking: 'Stacking', code: 'BRAKE5' };

beforeEach(() => {
  asUser('adminA');
  service.createDiscount.mockClear();
  service.createDiscountDraft.mockClear();
});

describe('POST /api/seller/discounts/cart', () => {
  it('cross-store: another store is refused and commercetools is never called', async () => {
    await expectCrossStoreForbidden((req) => POST(req), (other) => post({ storeKey: other, rule }));
    expect(service.createDiscount).not.toHaveBeenCalled();
    expect(service.createDiscountDraft).not.toHaveBeenCalled();
  });

  it('an empty body creates the "New cart rule (draft)"; a rule with a code reaches the service', async () => {
    expect((await POST(post({ storeKey: 'store-a' }))).status).toBe(201);
    expect(service.createDiscountDraft).toHaveBeenCalledWith('store-a', 'cart');
    await POST(post({ storeKey: 'store-a', rule }));
    expect(service.createDiscount).toHaveBeenCalledWith('store-a', 'cart', rule);
  });

  it('duplicate discount code is 409 CODE_TAKEN; an invalid rule is 400 with the field', async () => {
    service.createDiscount.mockRejectedValueOnce(new CatalogError(409, 'CODE_TAKEN', 'This code is already in use'));
    const taken = await POST(post({ storeKey: 'store-a', rule }));
    expect(taken.status).toBe(409);
    expect(await taken.json()).toEqual({ error: 'This code is already in use', code: 'CODE_TAKEN' });
    service.createDiscount.mockRejectedValueOnce(new CatalogError(400, 'INVALID_RULE', 'The percentage must be between 0.01 and 100', { issues: [{ field: 'effect', message: 'x' }] }));
    const invalid = await POST(post({ storeKey: 'store-a', rule: { ...rule, effect: { kind: 'relative', percent: 0 } } }));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ code: 'INVALID_RULE', issues: [{ field: 'effect' }] });
  });
});
