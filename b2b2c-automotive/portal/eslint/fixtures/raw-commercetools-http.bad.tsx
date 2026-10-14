/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

export async function rawCalls(token: string) {
  await fetch('https://api.europe-west1.gcp.commercetools.com/proj/carts', { headers: { Authorization: `Bearer ${token}` } });
  await fetch(`${process.env.CTP_API_URL}/proj/orders`);
  const CTP_AUTH_URL = 'x';
  return fetch(CTP_AUTH_URL);
}
