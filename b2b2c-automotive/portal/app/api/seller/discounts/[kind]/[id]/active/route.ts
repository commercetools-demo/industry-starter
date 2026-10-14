/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// POST /api/seller/discounts/[kind]/[id]/active { storeKey, isActive } : the Active toggle (T-09). Switching off keeps the discount
// listed; activating re-validates the rule and refuses an unfinished draft. Foreign: 404. Malva-funded: 403 LOCKED_MALVA_FUNDED.
import { ActiveBody, DiscountKindParam } from '@/lib/catalog/route-schemas';
import { setDiscountActive } from '@/lib/ct/seller/discounts';
import { ApiError, json } from '@/lib/portal/route-kit';
import { authorizedBody, sellerHandle } from '@/lib/portal/seller-route';

export const POST = sellerHandle(async (request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) => {
  const body = await authorizedBody(request, ActiveBody, 'discount.edit');
  const { kind, id } = await params;
  const parsed = DiscountKindParam.safeParse(kind);
  if (!parsed.success) throw new ApiError(404, 'Not found');
  return json(await setDiscountActive(body.storeKey, parsed.data, id, body.isActive));
});
