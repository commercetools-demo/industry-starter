/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

export async function loadCart(id: string) {
  await fetch(`/api/cart/${id}`);
  return fetch('/api/cart');
}
