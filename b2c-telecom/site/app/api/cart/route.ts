/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { cartResponse } from '@/lib/cart-api';
import { readBundle } from '@/lib/ct/bundle';

export const dynamic = 'force-dynamic';

/** The session's cart, normalized, revalidated (J, K) and mapped; `{ cart: null }` when there is none. */
export async function GET() {
  return cartResponse((session, market) => readBundle(session, market));
}
