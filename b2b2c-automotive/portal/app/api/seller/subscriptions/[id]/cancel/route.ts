/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// POST /api/seller/subscriptions/[id]/cancel { storeKey, confirm: true } (V-09). Cancelling is final and needs the confirmation.
import { subscriptionActionRoute } from '@/lib/portal/v-route';

export const POST = subscriptionActionRoute('cancel');
