/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

/** Runs once at server start: fail fast, naming the missing variable (storefront-bff-and-session). */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV !== 'test') {
    const { validateCtEnv } = await import('@/lib/env');
    validateCtEnv();
  }
}
