/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// GET /api/seller/campaigns?storeKey= : the Malva co-op campaigns with the store's discount and claim state (W-01, W-03).
// Read only: the caption, funding and dates belong to Malva. There is no PUT, PATCH or DELETE here (Next answers 405).
import { listCampaigns } from '@/lib/ct/seller/campaigns';
import { json } from '@/lib/portal/route-kit';
import { authorizeSeller, sellerHandle, storeKeyParam } from '@/lib/portal/seller-route';

export const GET = sellerHandle(async (request: Request) => {
  const storeKey = storeKeyParam(request);
  await authorizeSeller(storeKey, 'marketing.manage');
  return json({ campaigns: await listCampaigns(storeKey) });
});
