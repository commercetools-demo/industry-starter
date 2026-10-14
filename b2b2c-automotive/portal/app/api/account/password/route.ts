/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// PUT /api/account/password { currentPassword, newPassword } (workstream U-10, decision 19): changes the signed-in customer's own
// password through the password endpoint. 12 characters minimum (server side too); a wrong current password answers 400 "Current
// password is incorrect." Neither password is logged or echoed.
import { changePassword } from '@/lib/ct/account';
import { passwordInput } from '@/lib/company/schemas';
import { companyBody, companyHandle } from '@/lib/portal/company-route';
import { json } from '@/lib/portal/route-kit';

export const PUT = companyHandle(async (request: Request) => {
  const { session, body } = await companyBody(request, 'account.edit', passwordInput);
  await changePassword(session.customerId, body.currentPassword, body.newPassword);
  return json({ status: 'changed' });
});
