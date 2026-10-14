/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { ApiError, handle, ok, parseBody, requireCustomer } from '@/lib/api';
import { selectBusinessUnitSchema } from '@/lib/schemas';
import { selectBusinessUnit } from '@/lib/ct/business-units';
import { saveSession } from '@/lib/session';

export const POST = handle(async (request: Request) => {
  const session = await requireCustomer();
  const { businessUnitKey } = await parseBody(request, selectBusinessUnitSchema);
  const next = await selectBusinessUnit(session, businessUnitKey);
  if (!next) throw new ApiError(403, 'You are not a member of that company.');
  await saveSession(next);
  return ok({ businessUnitKey: next.businessUnitKey });
});
