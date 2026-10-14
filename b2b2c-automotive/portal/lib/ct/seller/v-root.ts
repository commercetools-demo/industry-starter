/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// The commercetools client of workstream V: the seller-admin client, or in development with PORTAL_DEV_FIXTURES=on (never in
// production) the in-memory fixture client of `lib/portal/v-fixture-root.ts`. Tests inject their own fake with `setVRootForTest`.
import 'server-only';
import type { ByProjectKeyRequestBuilder } from '@commercetools/platform-sdk';
import { devFixturesEnabled } from '@/lib/portal/seam';

let override: ByProjectKeyRequestBuilder | undefined;

/** Unit tests only: route every V service call to a fake. Pass `undefined` to reset. */
export function setVRootForTest(root: unknown): void {
  override = root as ByProjectKeyRequestBuilder | undefined;
}

export async function vRoot(): Promise<ByProjectKeyRequestBuilder> {
  if (override) return override;
  if (devFixturesEnabled()) return (await import('@/lib/portal/v-fixture-root')).vFixtureRoot as unknown as ByProjectKeyRequestBuilder;
  return (await import('@/lib/ct/admin-client')).adminRoot;
}
