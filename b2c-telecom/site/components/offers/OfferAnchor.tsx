/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useEffect } from 'react';
import { offerAnchorId } from '@/lib/listing/links';

/**
 * Scrolls the card of the `?offer=` link to the middle of the viewport once, after the page is shown. The browser's own `#offer-<key>`
 * scrolling covers the case without JavaScript; this one also centres the card under the sticky header.
 */
export function OfferAnchor({ offerKey }: { offerKey: string }): null {
  useEffect(() => {
    document.getElementById(offerAnchorId(offerKey))?.scrollIntoView({ block: 'center' });
  }, [offerKey]);
  return null;
}
