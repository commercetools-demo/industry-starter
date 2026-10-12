// GET /api/seller/dashboard/renewals: subscriptions whose next order is within 7 days (S-05).
import { dashboardRoute } from '@/lib/ct/seller/dashboard/route-helper';
import type { RenewalRow } from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

export const GET = dashboardRoute<RenewalRow[]>({ widget: 'renewals', empty: [], read: (storeKey, ports) => ports.renewals(storeKey) });
