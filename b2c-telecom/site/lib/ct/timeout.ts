/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import 'server-only';
import { CT_READ_TIMEOUT_MS } from '@/lib/config/cache';

export class UpstreamTimeoutError extends Error {
  constructor(
    readonly label: string,
    readonly ms: number,
  ) {
    super(`Upstream timeout: ${label} after ${ms} ms`);
    this.name = 'UpstreamTimeoutError';
  }
}

/** Rejects with `UpstreamTimeoutError` after `ms`; the timer is always cleared. */
export function withTimeout<T>(promise: Promise<T>, label: string, ms: number = CT_READ_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new UpstreamTimeoutError(label, ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
