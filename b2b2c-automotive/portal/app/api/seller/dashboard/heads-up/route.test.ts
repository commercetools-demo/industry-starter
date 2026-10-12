import { vi } from 'vitest';

vi.mock('@/lib/portal/seam', async () => (await import('@/lib/ct/seller/dashboard/route-harness')).seamMock);
vi.mock('@/lib/ct/associate', async () => (await import('@/lib/ct/seller/dashboard/route-harness')).associateMock);
vi.mock('@/lib/ct/seller/dashboard/ports', async () => (await import('@/lib/ct/seller/dashboard/route-harness')).portsMock);

import { describeDashboardRoute } from '@/lib/ct/seller/dashboard/route-harness';
import { GET } from './route';

describeDashboardRoute('heads-up', GET, 'heads-up', ['headsUp']);
