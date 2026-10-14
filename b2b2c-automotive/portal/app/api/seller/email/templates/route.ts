/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// GET /api/seller/email/templates?storeKey= : the three templates and the state of the order events (W-04, W-06).
// Templates are stored only; nothing is ever sent (Q-P01). Event states are "stored-not-sent" or "not-set-up".
import { listEvents, listTemplates } from '@/lib/ct/seller/email-templates';
import { json } from '@/lib/portal/route-kit';
import { authorizeSeller, sellerHandle, storeKeyParam } from '@/lib/portal/seller-route';
import { getBrand } from '@/lib/theme/brand';

export const GET = sellerHandle(async (request: Request) => {
  const storeKey = storeKeyParam(request);
  await authorizeSeller(storeKey, 'email.manage');
  const [templates, events, brand] = await Promise.all([listTemplates(storeKey), listEvents(storeKey), getBrand(storeKey)]);
  return json({ templates, events, brand });
});
