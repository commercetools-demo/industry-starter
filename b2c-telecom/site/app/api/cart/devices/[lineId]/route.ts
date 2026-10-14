/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { BundleRefusal } from '@/lib/cart/errors';
import { cartResponse, readBody } from '@/lib/cart-api';
import { changeDeviceMode } from '@/lib/ct/device-bundle';
import { parseMode } from '@/lib/devices/input';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ lineId: string }> };

/** Changes how a device line of the bundle is acquired: the line is removed and re-added in one update, so the price is resolved anew. */
export async function PATCH(request: Request, { params }: Context) {
  const { lineId } = await params;
  return cartResponse(async (session, market) => {
    const parsed = parseMode(await readBody(request));
    if (!parsed.ok) throw new BundleRefusal(400, 'INVALID_INPUT', parsed.message);
    return changeDeviceMode(session, market, lineId, { mode: parsed.mode, termMonths: parsed.termMonths });
  });
}
