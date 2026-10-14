// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import 'server-only';
import { createApiRoot } from '@/lib/ct/client';
import { validatePortalEnv } from '@/lib/env';

/**
 * Seller-admin client (`CTP_ADMIN_*`): assortment, prices, discounts, tailoring, store settings, the Contentools JWT object.
 * Import it only from `app/api/seller/**`, `lib/ct/seller/**` and `lib/contentools/jwt.ts` (lint fence), and only after
 * `authorizeStore(session, storeKey, action)`. Server only; its credentials differ from the frontend client.
 */
export const adminRoot = createApiRoot(validatePortalEnv(process.env).admin);
