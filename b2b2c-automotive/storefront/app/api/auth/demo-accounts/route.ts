// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `GET /api/auth/demo-accounts` -> `{ accounts: [{ id, label }] }`: the seeded demo shoppers of the session's store (workstream Q-13a).
// 404 unless demo login is enabled (`DEMO_LOGIN_ENABLED=true`, never in production). Never carries an email, a password or a custom field.
import { ApiError, handle } from '@/lib/api';
import { isDemoLoginEnabled, listDemoShoppers } from '@/lib/demo-login';
import { getSession } from '@/lib/session';

export const GET = handle(async () => {
  if (!isDemoLoginEnabled()) throw new ApiError(404, 'Not found');
  const { storeKey } = await getSession();
  if (!storeKey) throw new ApiError(404, 'Not found');
  return Response.json({ accounts: await listDemoShoppers(storeKey) }, { headers: { 'Cache-Control': 'no-store' } });
});
