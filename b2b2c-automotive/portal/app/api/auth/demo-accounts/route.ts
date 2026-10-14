/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// GET /api/auth/demo-accounts: the seeded demo associates for the sign-in picker (R-17a). 404 unless DEMO_LOGIN_ENABLED=true outside production.
import { listDemoAccounts } from '@/lib/demo-login';
import { handle, json } from '@/lib/portal/route-kit';

export const GET = handle(async () => json({ accounts: await listDemoAccounts() }));
