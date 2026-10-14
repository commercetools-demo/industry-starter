/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// GET /api/seller/dashboard/heads-up: the one derived banner, or null (S-05).
import { dashboardRoute } from '@/lib/ct/seller/dashboard/route-helper';
import type { HeadsUp } from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

export const GET = dashboardRoute<HeadsUp | null>({ widget: 'heads-up', empty: null, read: (storeKey, ports) => ports.headsUp(storeKey) });
