/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// GET and POST /api/seller/store/branches (workstream U-05): the store's branches (channels with both roles and branch-info) and
// "Add branch". Admin only, store key checked first.
import { createBranch, listBranches } from '@/lib/ct/seller/branches';
import { json } from '@/lib/portal/route-kit';
import { authorizeBody, authorizeQuery, storeHandle } from '@/lib/portal/store-route';
import { createBranchInput } from '@/lib/store/schemas';

export const GET = storeHandle(async (request: Request) => {
  const { storeKey } = await authorizeQuery(request, 'store.view');
  return json({ branches: await listBranches(storeKey) });
});

export const POST = storeHandle(async (request: Request) => {
  const { storeKey, body } = await authorizeBody(request, 'store.edit', createBranchInput);
  return json({ branch: await createBranch(storeKey, body) }, { status: 201 });
});
