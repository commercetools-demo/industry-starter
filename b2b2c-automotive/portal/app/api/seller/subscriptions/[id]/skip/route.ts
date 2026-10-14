/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// POST /api/seller/subscriptions/[id]/skip { storeKey } : skips the next renewal of an Active subscription (V-09).
import { subscriptionActionRoute } from '@/lib/portal/v-route';

export const POST = subscriptionActionRoute('skip');
