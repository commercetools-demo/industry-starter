/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Fixture for eslint/rules.test.mjs. Not part of the app (excluded from lint and tsc).
export async function load(id: string) {
  const a = await fetch('/api/cart');
  const b = await fetch(`/api/orders/${id}`);
  return [a, b];
}
