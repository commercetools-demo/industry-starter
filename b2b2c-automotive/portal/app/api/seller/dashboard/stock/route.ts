/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// GET /api/seller/dashboard/stock: low stock per branch of the session store (S-05).
import { dashboardRoute } from '@/lib/ct/seller/dashboard/route-helper';
import type { BranchStock } from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

export const GET = dashboardRoute<BranchStock[]>({ widget: 'stock', empty: [], read: (storeKey, ports) => ports.lowStock(storeKey) });
