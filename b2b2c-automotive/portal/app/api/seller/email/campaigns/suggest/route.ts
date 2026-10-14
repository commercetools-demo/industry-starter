/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// POST /api/seller/email/campaigns/suggest { storeKey, description } : the rule, its words and the consented customer count for a
// plain-language description (deterministic parser, no LLM). Persists nothing: the rule is stored only after "Use rule" (POST campaigns).
import { suggestAudience } from '@/lib/ct/seller/email-campaigns';
import { json } from '@/lib/portal/route-kit';
import { authorizedBody, sellerHandle } from '@/lib/portal/seller-route';
import { SuggestBody } from '@/lib/portal/w-schemas';

export const POST = sellerHandle(async (request: Request) => {
  const body = await authorizedBody(request, SuggestBody, 'email.manage');
  return json(await suggestAudience(body.storeKey, body.description));
});
