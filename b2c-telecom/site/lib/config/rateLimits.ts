/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

export const RATE_LIMITS = {
  login: { limit: 10, windowMs: 60_000 },
  register: { limit: 5, windowMs: 60_000 },
  forgotPassword: { limit: 5, windowMs: 60_000 },
  resetPassword: { limit: 5, windowMs: 60_000 },
  /** Each preview creates and deletes a cart on the platform: bounded per client. */
  pricingPreview: { limit: 30, windowMs: 60_000 },
} as const;
