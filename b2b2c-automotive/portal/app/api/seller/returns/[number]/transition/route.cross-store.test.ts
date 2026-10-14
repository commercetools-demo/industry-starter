/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogError } from '@/lib/catalog/errors';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { asUser, params } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const service = vi.hoisted(() => ({ transitionReturn: vi.fn(async () => ({ status: 'received' })) }));
vi.mock('@/lib/ct/seller/returns', () => service);

import { POST } from './route';

const ctx = params({ number: 'RET-MLV-1-1' });
const post = (json: Record<string, unknown>) => makeRequest('/api/seller/returns/RET-MLV-1-1/transition', { method: 'POST', json });

beforeEach(() => {
  asUser('adminA');
  service.transitionReturn.mockClear();
});

describe('POST /api/seller/returns/[number]/transition', () => {
  it('cross-store and Buyer are refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => POST(req, ctx), (other) => post({ storeKey: other, to: 'received' }));
    asUser('buyerA');
    expect((await POST(post({ storeKey: 'store-a', to: 'received' }), ctx)).status).toBe(403);
    expect(service.transitionReturn).not.toHaveBeenCalled();
  });
  it('passes the status word, the refund amount and the reason; accepts no shipment or payment state', async () => {
    expect((await POST(post({ storeKey: 'store-a', to: 'refunded', refundCents: 1500 }), ctx)).status).toBe(200);
    expect(service.transitionReturn).toHaveBeenCalledWith('store-a', 'RET-MLV-1-1', 'refunded', { refundCents: 1500, reason: undefined });
    for (const bad of [{ to: 'shipped' }, { to: 'received', shipmentState: 'Returned' }, { to: 'received', paymentState: 'Refunded' }, { to: 'refunded', refundCents: -5 }, { to: 'refunded', refundCents: 10.5 }]) {
      expect((await POST(post({ storeKey: 'store-a', ...bad }), ctx)).status).toBe(400);
    }
  });
  it('maps domain refusals: wrong move 409, over-refund 400, other store 404', async () => {
    service.transitionReturn.mockRejectedValueOnce(new CatalogError(409, 'INVALID_TRANSITION', 'A requested return cannot move to inspected'));
    expect((await POST(post({ storeKey: 'store-a', to: 'inspected' }), ctx)).status).toBe(409);
    service.transitionReturn.mockRejectedValueOnce(new CatalogError(400, 'REFUND_EXCEEDS_PAID', 'too much', { maxRefundCents: 1000 }));
    const over = await POST(post({ storeKey: 'store-a', to: 'refunded', refundCents: 99999 }), ctx);
    expect(over.status).toBe(400);
    expect(await over.json()).toMatchObject({ code: 'REFUND_EXCEEDS_PAID', maxRefundCents: 1000 });
    service.transitionReturn.mockRejectedValueOnce(new CatalogError(404, 'RETURN_NOT_FOUND', 'Return not found'));
    expect((await POST(post({ storeKey: 'store-a', to: 'received' }), params({ number: 'RET-B-1' }))).status).toBe(404);
  });
});
