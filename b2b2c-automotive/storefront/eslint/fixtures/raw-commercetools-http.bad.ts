/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Fixture for eslint/rules.test.mjs. Not part of the app (excluded from lint and tsc).
export async function listProducts(projectKey: string) {
  const a = await fetch('https://api.europe-west1.gcp.commercetools.com/' + projectKey + '/products');
  const b = await fetch(`${process.env.CTP_API_URL}/${projectKey}/products`);
  const c = await fetch(process.env.CTP_AUTH_URL as string, { method: 'POST' });
  return [a, b, c];
}
