/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// POST /api/seller/subscriptions/[id]/pause { storeKey } (V-09). The target state is the action word, never a client value.
import { subscriptionActionRoute } from '@/lib/portal/v-route';

export const POST = subscriptionActionRoute('pause');
