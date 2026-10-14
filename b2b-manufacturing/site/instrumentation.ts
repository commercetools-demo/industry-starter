/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

/** Fail at startup, naming the variable, instead of with an authentication error on the first request. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NEXT_PHASE === 'phase-production-build') return;
  const { validateEnv } = await import('./lib/env');
  const { assertSessionSecret } = await import('./lib/session');
  validateEnv(process.env);
  assertSessionSecret();
}
