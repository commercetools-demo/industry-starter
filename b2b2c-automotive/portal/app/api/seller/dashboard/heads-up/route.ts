// GET /api/seller/dashboard/heads-up: the one derived banner, or null (S-05).
import { dashboardRoute } from '@/lib/ct/seller/dashboard/route-helper';
import type { HeadsUp } from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

export const GET = dashboardRoute<HeadsUp | null>({ widget: 'heads-up', empty: null, read: (storeKey, ports) => ports.headsUp(storeKey) });
