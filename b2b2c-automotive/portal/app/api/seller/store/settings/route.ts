/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// GET and PUT /api/seller/store/settings (workstream U-05): the store's name, logo and favicon, location and the read-only
// storefront address. Admin only; the store key (query or body) must be the session's store, checked before anything else.
import { getStoreSettings, saveStoreSettings } from '@/lib/ct/seller/store-settings';
import { json } from '@/lib/portal/route-kit';
import { authorizeBody, authorizeQuery, storeHandle } from '@/lib/portal/store-route';
import { storeSettingsInput } from '@/lib/store/schemas';

export const GET = storeHandle(async (request: Request) => {
  const { storeKey } = await authorizeQuery(request, 'store.view');
  return json(await getStoreSettings(storeKey));
});

export const PUT = storeHandle(async (request: Request) => {
  const { storeKey, body } = await authorizeBody(request, 'store.edit', storeSettingsInput);
  return json(await saveStoreSettings(storeKey, { name: body.name, location: body.location }));
});
