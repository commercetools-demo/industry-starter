/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// GET /api/seller/customers?storeKey=&tab=all|registered|guests&q=&offset=&limit= : the store's shoppers and guest checkouts with masked
// e-mail addresses, KPIs and pagination (V-03). Admin only; the store comes from the checked `storeKey`, never from anything else.
import { listCustomers } from '@/lib/ct/seller/customers';
import { json } from '@/lib/portal/route-kit';
import { authorizeSeller, intParam, sellerHandle, storeKeyParam, textParam } from '@/lib/portal/seller-route';
import type { CustomerTab } from '@/lib/v-types';

const TABS: readonly CustomerTab[] = ['all', 'registered', 'guests'];

export const GET = sellerHandle(async (request: Request) => {
  const storeKey = storeKeyParam(request);
  await authorizeSeller(storeKey, 'customers.view');
  const tab = new URL(request.url).searchParams.get('tab');
  return json(
    await listCustomers(storeKey, {
      tab: TABS.find((t) => t === tab) ?? 'all',
      q: textParam(request, 'q'),
      offset: intParam(request, 'offset', 0, 100_000),
      limit: intParam(request, 'limit', 50, 100),
    }),
  );
});
