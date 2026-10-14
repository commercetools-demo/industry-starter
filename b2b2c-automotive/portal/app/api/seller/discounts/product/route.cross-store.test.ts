/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { asUser } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const service = vi.hoisted(() => ({ createDiscount: vi.fn(async () => ({ id: 'd1' })), createDiscountDraft: vi.fn(async () => ({ id: 'draft1' })) }));
vi.mock('@/lib/ct/seller/discounts', () => service);

import { POST } from './route';

const post = (json: Record<string, unknown>) => makeRequest('/api/seller/discounts/product', { method: 'POST', json });
const rule = { name: { 'en-US': 'Filters -5%' }, scope: { kind: 'category', categoryId: 'cat-filters', label: 'Filters' }, effect: { kind: 'relative', percent: 5 } };

beforeEach(() => {
  asUser('adminA');
  service.createDiscount.mockClear();
  service.createDiscountDraft.mockClear();
});

describe('POST /api/seller/discounts/product', () => {
  it('cross-store: another store is refused and commercetools is never called', async () => {
    await expectCrossStoreForbidden((req) => POST(req), (other) => post({ storeKey: other, rule }));
    expect(service.createDiscount).not.toHaveBeenCalled();
    expect(service.createDiscountDraft).not.toHaveBeenCalled();
  });

  it('an empty body creates the draft; a rule creates the discount; a malformed rule is 400', async () => {
    expect((await POST(post({ storeKey: 'store-a' }))).status).toBe(201);
    expect(service.createDiscountDraft).toHaveBeenCalledWith('store-a', 'product');
    expect((await POST(post({ storeKey: 'store-a', rule }))).status).toBe(201);
    expect(service.createDiscount).toHaveBeenCalledWith('store-a', 'product', rule);
    expect((await POST(post({ storeKey: 'store-a', rule: { ...rule, effect: { kind: 'freeShipping' } } }))).status).toBe(400);
    expect((await POST(post({ storeKey: 'store-a', rule: { ...rule, key: 'x' } }))).status).toBe(400);
  });

  it('a Buyer is refused', async () => {
    asUser('buyerA');
    expect((await POST(post({ storeKey: 'store-a' }))).status).toBe(403);
  });
});
