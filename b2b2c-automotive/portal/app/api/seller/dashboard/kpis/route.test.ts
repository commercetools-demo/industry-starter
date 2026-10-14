import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/portal/seam', async () => (await import('@/lib/ct/seller/dashboard/route-harness')).seamMock);
vi.mock('@/lib/ct/associate', async () => (await import('@/lib/ct/seller/dashboard/route-harness')).associateMock);
vi.mock('@/lib/ct/seller/dashboard/ports', async () => (await import('@/lib/ct/seller/dashboard/route-harness')).portsMock);

import { describeDashboardRoute, harness } from '@/lib/ct/seller/dashboard/route-harness';
import { makeRequest } from '@/test/request';
import { GET } from './route';

describeDashboardRoute('kpis', GET, 'kpis', ['openReturns', 'activeSubscriptions', 'unansweredReviews']);

describe('GET /api/seller/dashboard/kpis values', () => {
  it('each value is null when only its own source failed', async () => {
    harness.reset('adminA');
    harness.ports.activeSubscriptions.mockRejectedValue(new Error('down'));
    const res = await GET(makeRequest('/api/seller/dashboard/kpis'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ openReturns: 2, activeSubscriptions: null, unansweredReviews: 4 });
  });
});
