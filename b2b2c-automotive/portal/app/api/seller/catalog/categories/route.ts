/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// GET /api/seller/catalog/categories?storeKey= : the category tree for the assortment filter and the discount editor.
import { listCategories } from '@/lib/ct/seller/catalog-data';
import { json } from '@/lib/portal/route-kit';
import { authorizeSeller, sellerHandle, storeKeyParam } from '@/lib/portal/seller-route';

export const GET = sellerHandle(async (request: Request) => {
  const storeKey = storeKeyParam(request);
  await authorizeSeller(storeKey, 'catalog.view');
  return json({ categories: await listCategories() });
});
