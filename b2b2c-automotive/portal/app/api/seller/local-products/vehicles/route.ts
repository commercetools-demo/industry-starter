/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// GET /api/seller/local-products/vehicles?storeKey= : the vehicle table (fitment keys) for the optional "Fits these vehicles" claim (W-15).
import { listVehicleOptions } from '@/lib/ct/seller/local-products';
import { json } from '@/lib/portal/route-kit';
import { authorizeSeller, sellerHandle, storeKeyParam } from '@/lib/portal/seller-route';

export const GET = sellerHandle(async (request: Request) => {
  const storeKey = storeKeyParam(request);
  await authorizeSeller(storeKey, 'import.run');
  return json({ vehicles: await listVehicleOptions() });
});
