/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// POST /api/seller/import/commit { storeKey, csv, overrides? } : imports the file through the Import API (W-14). The client sends the
// file again; the server validates it again and imports only the rows it accepts itself (never a list from the client).
import { commitImport } from '@/lib/ct/seller/product-import';
import { json } from '@/lib/portal/route-kit';
import { authorizedBody, sellerHandle } from '@/lib/portal/seller-route';
import { ImportBody } from '@/lib/portal/w-schemas';

export const maxDuration = 120;

export const POST = sellerHandle(async (request: Request) => {
  const body = await authorizedBody(request, ImportBody, 'import.run');
  return json(await commitImport(body.storeKey, body.csv, { overrides: body.overrides }));
});
