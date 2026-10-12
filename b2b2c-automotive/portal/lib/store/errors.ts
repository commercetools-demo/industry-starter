// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Domain error of the Store & channels screens. Pure (no server imports). `storeHandle` (lib/portal/store-route.ts) answers it
// with its own status, because `lib/api.ts` would turn a 422 into a 500.

/** A well formed request that names something the store cannot do (a SKU outside the assortment). Answered 422. */
export class UnprocessableError extends Error {
  status = 422 as const;
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = 'UnprocessableError';
  }
}
