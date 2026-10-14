/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// node scripts/check-sortorder-bands.mjs
// Read only: every product and cart discount has a sortOrder unique per kind; Malva-funded ones sit in 0.90 to 0.99 (mau-pd-malva-*
// product discounts, cart discounts funded by Malva), reseller ones in 0.05 to 0.89. Lists every outside value and every duplicate.
import { connect, readArgs } from './catalog-live.mjs';

readArgs(process.argv.slice(2), { usage: '', needsStore: false });
const ctp = await connect();
const num = (s) => Number.parseFloat(s);
let problems = 0;

const report = (kind, id, key, funded, sortOrder) => {
  const v = num(sortOrder);
  const ok = funded ? v >= 0.9 && v <= 0.99 : v >= 0.05 && v <= 0.89;
  if (!ok) {
    problems += 1;
    console.log(`${kind} ${key ?? id}: ${funded ? 'Malva-funded' : 'reseller'} but sortOrder ${sortOrder}`);
  }
};

const product = await ctp.all('/product-discounts');
const cart = await ctp.all('/cart-discounts');
for (const d of product) report('product', d.id, d.key, (d.key ?? '').startsWith('mau-pd-malva-'), d.sortOrder);
for (const d of cart) report('cart', d.id, d.key, d.custom?.fields?.fundedBy === 'malva', d.sortOrder);
for (const [kind, list] of [['product', product], ['cart', cart]]) {
  const seen = new Map();
  for (const d of list) seen.set(d.sortOrder, [...(seen.get(d.sortOrder) ?? []), d.key ?? d.id]);
  for (const [value, keys] of seen) if (keys.length > 1) {
    problems += 1;
    console.log(`${kind}: sortOrder ${value} is used by ${keys.join(', ')}`);
  }
}
console.log(`${product.length} product and ${cart.length} cart discounts checked, ${problems} problem(s).`);
process.exit(problems === 0 ? 0 : 2);
