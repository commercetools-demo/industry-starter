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
const service = vi.hoisted(() => ({ listEmailCampaigns: vi.fn(async () => []), createEmailCampaign: vi.fn(async () => ({ id: 'c1' })) }));
vi.mock('@/lib/ct/seller/email-campaigns', () => service);

import * as route from './route';

const post = (json: Record<string, unknown>) => makeRequest('/api/seller/email/campaigns', { method: 'POST', json });
const body = (extra: Record<string, unknown> = {}) => ({ storeKey: 'store-a', name: 'TST-W Win back', templateKey: 'win-back', rule: { all: [{ type: 'registered' }] }, ...extra });

beforeEach(() => {
  asUser('adminA');
  service.listEmailCampaigns.mockClear();
  service.createEmailCampaign.mockClear();
});

describe('/api/seller/email/campaigns', () => {
  it('cross-store: another store is refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => route.POST(req), (other) => post(body({ storeKey: other })));
    await expectCrossStoreForbidden((req) => route.GET(req), (other) => makeRequest(`/api/seller/email/campaigns?storeKey=${other}`));
    expect(service.createEmailCampaign).not.toHaveBeenCalled();
    expect(service.listEmailCampaigns).not.toHaveBeenCalled();
  });
  it('Buyer gets 403 on both methods', async () => {
    asUser('buyerA');
    expect((await route.POST(post(body()))).status).toBe(403);
    expect((await route.GET(makeRequest('/api/seller/email/campaigns?storeKey=store-a'))).status).toBe(403);
    expect(service.createEmailCampaign).not.toHaveBeenCalled();
  });
  it('creates a Draft for the session store; status, count and recipients cannot be sent', async () => {
    expect((await route.POST(post(body()))).status).toBe(201);
    expect(service.createEmailCampaign).toHaveBeenCalledWith('store-a', { name: 'TST-W Win back', templateKey: 'win-back', rule: { all: [{ type: 'registered' }] } });
    for (const extra of [{ status: 'Ready' }, { recipientCount: 99 }, { recipients: ['a@example.com'] }, { send: true }]) expect((await route.POST(post(body(extra)))).status).toBe(400);
    expect(service.createEmailCampaign).toHaveBeenCalledTimes(1);
  });
  it('there is no send route: only GET and POST exist on this resource', () => {
    expect(Object.keys(route).filter((k) => /^(GET|POST|PUT|PATCH|DELETE)$/.test(k)).sort()).toEqual(['GET', 'POST']);
  });
});
