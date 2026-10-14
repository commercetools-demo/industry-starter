// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Pure stock split of a cart line (workstream N-05); the reads live in `lib/ct/inventory.ts`.

export interface LineStock {
  branchQty: number;
  masterQty: number;
}

/** Splits a requested quantity into units from the branch and units that ship later; `capped` when neither covers all of it. */
export function splitStock(quantity: number, stock: LineStock): { fromStore: number; shipsLater: number; capped: boolean } {
  const fromStore = Math.min(quantity, stock.branchQty);
  const shipsLater = Math.min(quantity - fromStore, stock.masterQty);
  return { fromStore, shipsLater, capped: fromStore + shipsLater < quantity };
}
