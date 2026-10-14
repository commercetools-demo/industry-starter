/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Test helpers for seller endpoints (T and U import them): synthetic sessions and the cross-store assertion.
import { expect } from 'vitest';
import type { Session } from '@/lib/types';

const SESSIONS = {
  adminA: { customerId: 'cust-admin-a', businessUnitKey: 'bu-a', storeKey: 'store-a', distributionChannelId: 'dist-a', supplyChannelId: 'sup-a', productSelectionId: 'sel-a', accountGroupIds: [] },
  buyerA: { customerId: 'cust-buyer-a', businessUnitKey: 'bu-a', storeKey: 'store-a', distributionChannelId: 'dist-a', supplyChannelId: 'sup-a', productSelectionId: 'sel-a', accountGroupIds: [] },
  adminB: { customerId: 'cust-admin-b', businessUnitKey: 'bu-b', storeKey: 'store-b', distributionChannelId: 'dist-b', supplyChannelId: 'sup-b', productSelectionId: 'sel-b', accountGroupIds: [] },
} as const satisfies Record<string, Session>;

export function sessionFor(who: keyof typeof SESSIONS): Session {
  return { ...SESSIONS[who], accountGroupIds: [] };
}

/** A request that names another store must be refused with 403 or 404 (the handler runs with a session of store A). */
export async function expectCrossStoreForbidden(handler: (req: Request) => Promise<Response>, build: (otherStoreKey: string) => Request): Promise<void> {
  const response = await handler(build(SESSIONS.adminB.storeKey));
  expect([403, 404]).toContain(response.status);
}
