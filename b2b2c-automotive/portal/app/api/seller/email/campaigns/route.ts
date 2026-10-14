/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// GET /api/seller/email/campaigns?storeKey= and POST { storeKey, name, templateKey, rule } (W-07). A campaign is a stored Draft; there
// is no send route, no recipient list and no mail queue (Q-P01). The rule is parsed strictly again on the server.
import { createEmailCampaign, listEmailCampaigns } from '@/lib/ct/seller/email-campaigns';
import { json } from '@/lib/portal/route-kit';
import { authorizedBody, authorizeSeller, sellerHandle, storeKeyParam } from '@/lib/portal/seller-route';
import { EmailCampaignBody } from '@/lib/portal/w-schemas';

export const GET = sellerHandle(async (request: Request) => {
  const storeKey = storeKeyParam(request);
  await authorizeSeller(storeKey, 'email.manage');
  return json({ campaigns: await listEmailCampaigns(storeKey) });
});

export const POST = sellerHandle(async (request: Request) => {
  const body = await authorizedBody(request, EmailCampaignBody, 'email.manage');
  return json(await createEmailCampaign(body.storeKey, { name: body.name, templateKey: body.templateKey, rule: body.rule }), { status: 201 });
});
