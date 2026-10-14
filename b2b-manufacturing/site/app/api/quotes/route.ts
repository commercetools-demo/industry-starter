/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { handle, ok, requireBusinessUnit } from '@/lib/api';
import { listThreads } from '@/lib/ct/portal-quotes';

export const GET = handle(async () => {
  const session = await requireBusinessUnit();
  return ok({ threads: await listThreads(session) });
});
