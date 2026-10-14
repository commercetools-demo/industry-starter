/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { handle, ok, requireCustomer } from '@/lib/api';
import { getBusinessUnitsForAssociate } from '@/lib/ct/business-units';

export const GET = handle(async () => {
  const session = await requireCustomer();
  return ok({ businessUnits: await getBusinessUnitsForAssociate(session.customerId), current: session.businessUnitKey ?? null });
});
