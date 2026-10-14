/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import 'server-only';
import type { CartDraft } from '@commercetools/platform-sdk';
import type { Session } from '../session';

/** New carts never reserve stock (InventoryMode None, D-031) and use platform tax. */
export function newCartDraft(session: Session & { currency: string; country: string; locale: string }): CartDraft {
  return {
    currency: session.currency,
    country: session.country,
    locale: session.locale,
    inventoryMode: 'None',
    taxMode: 'Platform',
    ...(session.customerId ? { customerId: session.customerId } : session.anonymousId ? { anonymousId: session.anonymousId } : {}),
  };
}
