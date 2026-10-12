// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Cart reads and writes of the storefront. Workstream I added `getCartSummary` and the `rescopeCartToBranch` seam;
// workstreams L and N extend THIS file (do not create a second cart module).
import 'server-only';
import { inStore } from '@/lib/ct/in-store';
import type { BranchScope } from '@/lib/store/branch-scope';

const statusOf = (error: unknown): number | undefined =>
  typeof error === 'object' && error !== null ? (error as { statusCode?: number }).statusCode : undefined;

/** The header badge: units in the cart (2 units plus 1 unit is 3, not 2 lines). A missing or deleted cart is 0. */
export async function getCartSummary(storeKey: string, cartId: string | undefined): Promise<{ count: number }> {
  if (!cartId) return { count: 0 };
  try {
    const { body } = await inStore(storeKey).carts().withId({ ID: cartId }).get().execute();
    return { count: (body.lineItems ?? []).reduce((sum, line) => sum + line.quantity, 0) };
  } catch (error) {
    if (statusOf(error) === 404) return { count: 0 };
    throw error;
  }
}

/**
 * Seam for workstream N (N-04): after a branch change set the supply channel of every line to the branch and its
 * distribution channel to the channel of the winning price (`selectPrice`), then recalculate. Returns whether the cart was
 * re-priced. Until N implements it the cart keeps its lines and the branch applies to the next add to cart.
 */
export async function rescopeCartToBranch(...args: [storeKey: string, cartId: string, scope: BranchScope]): Promise<boolean> {
  void args;
  return false;
}
