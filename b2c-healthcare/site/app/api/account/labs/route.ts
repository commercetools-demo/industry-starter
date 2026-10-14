/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { handle, requireCustomer } from '@/lib/api';
import { listLabs } from '@/lib/ct/account-labs';

/** GET /api/account/labs: the signed-in patient's lab tests (no values: the list shows name, date, laboratory, status). */
export async function GET(): Promise<Response> {
  return handle(async () => {
    const { customerId } = await requireCustomer();
    return { labs: await listLabs(customerId) };
  });
}
