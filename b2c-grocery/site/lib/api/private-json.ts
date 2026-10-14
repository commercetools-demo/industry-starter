/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { NextResponse } from 'next/server';

/** Every `/api/account/*` response is per customer: never storable by shared caches or the browser (account-design "Account data is never shared"). */
export function privateJson(body: unknown, init: ResponseInit = {}): NextResponse {
  const res = NextResponse.json(body, init);
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
}

/** 401 for account routes called without a signed-in session (the `(protected)` layout guards pages only). */
export const unauthenticated = (): NextResponse => privateJson({ error: 'Unauthorized' }, { status: 401 });
