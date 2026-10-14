// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.

/** A customer may sign in under a store only when that store is in their `stores` (workstream Q answers the generic failure message). */
export function customerBelongsToStore(customerStores: { key: string }[] | undefined, storeKey: string): boolean {
  return !!customerStores?.some((s) => s.key === storeKey);
}
