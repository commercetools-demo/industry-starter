/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { handle } from '@/lib/api';
import { logout } from '@/lib/ct/identity';

/** POST /api/auth/logout. Drops `customerId` and `cartId` from the session cookie; locale fields stay. */
export async function POST(): Promise<Response> {
  return handle(async () => {
    await logout();
    return { ok: true };
  });
}
