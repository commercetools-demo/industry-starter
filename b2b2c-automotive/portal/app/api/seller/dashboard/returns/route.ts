/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// GET /api/seller/dashboard/returns: return items waiting for the reseller (S-05).
import { dashboardRoute } from '@/lib/ct/seller/dashboard/route-helper';
import type { ReturnRow } from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

export const GET = dashboardRoute<ReturnRow[]>({ widget: 'returns', empty: [], read: (storeKey, ports) => ports.returnsToHandle(storeKey) });
