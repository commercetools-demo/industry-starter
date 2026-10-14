/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { handle, ok } from '@/lib/api';
import { clearCustomer, getSession, saveSession } from '@/lib/session';

export const POST = handle(async () => {
  await saveSession(clearCustomer(await getSession()));
  return ok({ ok: true });
});
