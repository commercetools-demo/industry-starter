/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { useCheckout } from '@/hooks/useCheckout';

/** What the wizard hands to every step: the checkout state and its writes. Steps never call `fetch` themselves. */
export type CheckoutApi = ReturnType<typeof useCheckout>;
