/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// GET and PUT /api/account/profile { firstName, lastName, email } (workstream U-10): the signed-in customer's own name and email.
// The customer is always the session's; no id is accepted from the body. A duplicate email answers 409.
import { getAccountProfile, updateAccountProfile } from '@/lib/ct/account';
import { accountProfileInput } from '@/lib/company/schemas';
import { companyBody, companyContext, companyHandle } from '@/lib/portal/company-route';
import { json } from '@/lib/portal/route-kit';

export const GET = companyHandle(async () => {
  const session = await companyContext('account.view');
  return json({ profile: await getAccountProfile(session.customerId) });
});

export const PUT = companyHandle(async (request: Request) => {
  const { session, body } = await companyBody(request, 'account.edit', accountProfileInput);
  return json({ profile: await updateAccountProfile(session.customerId, body) });
});
