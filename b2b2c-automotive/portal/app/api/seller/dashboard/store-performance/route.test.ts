/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/portal/seam', async () => (await import('@/lib/ct/seller/dashboard/route-harness')).seamMock);
vi.mock('@/lib/ct/associate', async () => (await import('@/lib/ct/seller/dashboard/route-harness')).associateMock);
vi.mock('@/lib/ct/seller/dashboard/ports', async () => (await import('@/lib/ct/seller/dashboard/route-harness')).portsMock);

import { describeDashboardRoute, harness } from '@/lib/ct/seller/dashboard/route-harness';
import { makeRequest } from '@/test/request';
import { GET } from './route';

describeDashboardRoute('store-performance', GET, 'store-performance', ['storePerformance'], { buyer: 403 });

describe('GET /api/seller/dashboard/store-performance switch', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('PORTAL_STORE_PERFORMANCE=off answers 404 without reading', async () => {
    harness.reset('adminA');
    vi.stubEnv('PORTAL_STORE_PERFORMANCE', 'off');
    const res = await GET(makeRequest('/api/seller/dashboard/store-performance'));
    expect(res.status).toBe(404);
    expect(harness.ports.storePerformance).not.toHaveBeenCalled();
  });

  it('buyer 403 and admin 200', async () => {
    harness.reset('buyerA');
    expect((await GET(makeRequest('/api/seller/dashboard/store-performance'))).status).toBe(403);
    harness.reset('adminA');
    expect((await GET(makeRequest('/api/seller/dashboard/store-performance'))).status).toBe(200);
  });
});
