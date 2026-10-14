/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Clears the in-memory rate limiter between tests (it is per process).
export function resetRateLimitForTests(): void {
  (globalThis as { __malvaRateLimit?: Map<string, unknown> }).__malvaRateLimit?.clear();
}
