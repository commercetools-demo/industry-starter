/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// GET /api/seller/partnership?storeKey= : the guardrails that still exist (fitment claim: Enforced; price: Informational), the two KPIs
// and the pending fitment claims of the store (W-16, W-17). No price floor, no territories, no content review (owner scope).
import { getPartnership } from '@/lib/ct/seller/partnership';
import { json } from '@/lib/portal/route-kit';
import { authorizeSeller, sellerHandle, storeKeyParam } from '@/lib/portal/seller-route';

export const GET = sellerHandle(async (request: Request) => {
  const storeKey = storeKeyParam(request);
  await authorizeSeller(storeKey, 'partnership.view');
  return json(await getPartnership(storeKey));
});
