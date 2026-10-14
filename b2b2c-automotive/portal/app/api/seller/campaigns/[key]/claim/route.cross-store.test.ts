/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { asUser, params } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const service = vi.hoisted(() => ({ submitClaim: vi.fn(async () => ({ status: 'submitted' })) }));
vi.mock('@/lib/ct/seller/campaigns', () => service);

import { POST } from './route';

const ctx = params({ key: 'brake' });
const post = (json: Record<string, unknown>) => makeRequest('/api/seller/campaigns/brake/claim', { method: 'POST', json });
const body = (extra: Record<string, unknown> = {}) => ({ storeKey: 'store-a', amountCents: 12000, invoiceReference: 'INV-1', note: 'Flyers', ...extra });

beforeEach(() => {
  asUser('adminA');
  service.submitClaim.mockClear();
});

describe('POST /api/seller/campaigns/[key]/claim', () => {
  it('cross-store and Buyer are refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => POST(req, ctx), (other) => post(body({ storeKey: other })));
    asUser('buyerA');
    expect((await POST(post(body()), ctx)).status).toBe(403);
    expect(service.submitClaim).not.toHaveBeenCalled();
  });
  it('submits amount, reference and note for the session store; the status cannot be sent', async () => {
    expect((await POST(post(body()), ctx)).status).toBe(201);
    expect(service.submitClaim).toHaveBeenCalledWith('store-a', 'brake', { amountCents: 12000, invoiceReference: 'INV-1', note: 'Flyers' });
    expect((await POST(post(body({ status: 'approved' })), ctx)).status).toBe(400);
  });
  it('limits: reference at most 80 characters, note at most 500, amount a positive whole number', async () => {
    for (const bad of [{ invoiceReference: 'x'.repeat(81) }, { invoiceReference: '' }, { note: 'x'.repeat(501) }, { amountCents: 0 }, { amountCents: 1.5 }]) {
      expect((await POST(post(body(bad)), ctx)).status).toBe(400);
    }
    expect(service.submitClaim).not.toHaveBeenCalled();
  });
});
