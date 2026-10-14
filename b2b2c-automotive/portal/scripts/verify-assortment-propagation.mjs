/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// node scripts/verify-assortment-propagation.mjs <storeKey> <sku> present|absent
// Reads the store projection of one SKU and checks it is (or is not) visible in the store, up to 12 tries 5 s apart, because a
// selection change reaches the in-store projection after a short delay. Read only. Exit 0 when the expectation holds.
import { connect, fail, readArgs } from './catalog-live.mjs';

const { storeKey, rest } = readArgs(process.argv.slice(2), { usage: 'usage: verify-assortment-propagation.mjs <storeKey> <sku> present|absent' });
const [sku, expectation] = rest;
if (!sku || !['present', 'absent'].includes(expectation)) fail('usage: verify-assortment-propagation.mjs <storeKey> <sku> present|absent');

const ctp = await connect();
for (let attempt = 1; attempt <= 12; attempt += 1) {
  const page = await ctp.api('GET', `/in-store/key=${encodeURIComponent(storeKey)}/product-projections?where=${encodeURIComponent('masterVariant(sku=:sku)')}&var.sku=${encodeURIComponent(sku)}&limit=1`);
  const visible = page.results.length > 0;
  console.log(`try ${attempt}: ${sku} is ${visible ? 'visible' : 'not visible'} in ${storeKey}`);
  if (visible === (expectation === 'present')) {
    console.log('OK');
    process.exit(0);
  }
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
fail(`Expected ${sku} to be ${expectation} in ${storeKey}, it was not after 12 tries.`);
