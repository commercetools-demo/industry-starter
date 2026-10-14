/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { handle, requireCustomer } from '@/lib/api';
import { mapAddressErrors, saved } from '@/lib/address-route';
import { setDefault } from '@/lib/ct/addresses';

/** POST /api/account/addresses/:id/default: make this saved address the default shipping address. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const { customerId } = await requireCustomer();
    const { id } = await params;
    return saved(await mapAddressErrors(() => setDefault(customerId, id)));
  });
}
