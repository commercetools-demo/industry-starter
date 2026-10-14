/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// POST /api/company/addresses/default { addressId } (workstream U-09): makes an address of the unit the default (delivery and/or
// billing, whichever lists it is in); checkout prefills it. Admin only.
import { setDefaultAddress } from '@/lib/ct/company';
import { defaultAddressInput } from '@/lib/company/schemas';
import { companyBody, companyHandle } from '@/lib/portal/company-route';
import { json } from '@/lib/portal/route-kit';

export const POST = companyHandle(async (request: Request) => {
  const { session, body } = await companyBody(request, 'company.edit', defaultAddressInput);
  return json({ addresses: await setDefaultAddress(session, body.addressId) });
});
