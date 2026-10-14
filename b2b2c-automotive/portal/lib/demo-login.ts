/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Demo login (R-17a, spec seller-portal/design-demo-login). Server only. Lists the seeded demo associates and signs one in
// through the same session write as the form login. The demo password lives in the port (env DEMO_LOGIN_PASSWORD, server
// side) and never reaches the browser; only `{ id, label, group }` is ever returned.
import 'server-only';
import { startSession } from '@/lib/portal/auth-session';
import { isDemoLoginEnabled } from '@/lib/portal/flags';
import { ApiError } from '@/lib/portal/route-kit';
import { getPorts } from '@/lib/portal/seam';
import type { DemoAccount } from '@/lib/portal/types';

export { isDemoLoginEnabled };

function requireEnabled(): void {
  if (!isDemoLoginEnabled()) throw new ApiError(404, 'Not found');
}

/** Seeded demo associates, reduced to the three public fields. */
export async function listDemoAccounts(): Promise<DemoAccount[]> {
  requireEnabled();
  const rows = await getPorts().listDemoAccounts();
  return rows.map(({ id, label, group }) => ({ id, label, group }));
}

/** Signs in a listed demo account; an id outside the list is a 403 and logs a denial. */
export async function demoSignIn(customerId: string, request: Request): Promise<Response> {
  requireEnabled();
  const list = await listDemoAccounts();
  if (!list.some((a) => a.id === customerId)) {
    console.warn('demo-login denied');
    throw new ApiError(403, 'Not allowed');
  }
  return startSession(await getPorts().loginDemo(customerId), request);
}
