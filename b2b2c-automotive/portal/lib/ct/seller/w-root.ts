/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// The commercetools client of workstream W: the seller-admin client, or in development with PORTAL_DEV_FIXTURES=on (never in
// production) the in-memory fixture client with the extra calls W needs (products, custom object lists, orders, customers).
// It shares its state with T's fixture (`catalogRoot`), so an assignment made through T is seen here and the other way round.
import 'server-only';
import type { ByProjectKeyRequestBuilder } from '@commercetools/platform-sdk';
import { devFixturesEnabled } from '@/lib/portal/seam';

export async function wRoot(): Promise<ByProjectKeyRequestBuilder> {
  if (devFixturesEnabled()) return (await import('@/lib/portal/w-fixture-root')).wFixtureRoot as unknown as ByProjectKeyRequestBuilder;
  return (await import('@/lib/ct/admin-client')).adminRoot;
}
