/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// GET /api/seller/subscriptions/[id]/audit?storeKey= : the audit records of the management actions of one subscription (V-09 drawer).
import { listAudit } from '@/lib/ct/seller/subscriptions';
import { json } from '@/lib/portal/route-kit';
import { authorizeSeller, sellerHandle, storeKeyParam } from '@/lib/portal/seller-route';
import { pathParam, type Params } from '@/lib/portal/w-route';

export const GET = sellerHandle(async (request: Request, context: Params<'id'>) => {
  const storeKey = storeKeyParam(request);
  await authorizeSeller(storeKey, 'subscriptions.view');
  return json({ entries: await listAudit(storeKey, await pathParam(context, 'id')) });
});
