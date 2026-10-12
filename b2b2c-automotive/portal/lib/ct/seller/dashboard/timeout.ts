import 'server-only';
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
export const DASHBOARD_TIMEOUT_MS = 8000;

export class UpstreamTimeout extends Error {
  constructor() {
    super('UpstreamTimeout');
    this.name = 'UpstreamTimeout';
  }
}

/** Rejects with `UpstreamTimeout` when the promise does not settle in time (a slow source must not hold the widget). */
export function withTimeout<T>(promise: Promise<T>, ms: number = DASHBOARD_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new UpstreamTimeout()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
