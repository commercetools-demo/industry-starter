/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// node scripts/verify-discount-preview.mjs <storeKey> <discountId> [--kind=product|cart] [sku] [quantity]
// Builds a temporary cart in the store with one line (the first assigned SKU unless given), reads what the platform applied and prints
// it next to the editor's preview figures, then deletes the cart. Refuses an inactive discount. Writes only the temporary cart.
import { connect, fail, readArgs } from './catalog-live.mjs';

const { storeKey, flags, rest } = readArgs(process.argv.slice(2), { usage: 'usage: verify-discount-preview.mjs <storeKey> <discountId> [--kind=product|cart] [sku] [quantity]' });
const [discountId, sku, quantity = '1'] = rest;
if (!discountId) fail('usage: verify-discount-preview.mjs <storeKey> <discountId> [--kind=product|cart] [sku] [quantity]');
const kind = [...flags].includes('--kind=cart') ? 'cart' : 'product';

const ctp = await connect();
const discount = await ctp.api('GET', `/${kind}-discounts/${encodeURIComponent(discountId)}`);
if (!discount.isActive) fail(`Discount ${discount.key ?? discountId} is inactive: activate it first.`);
const store = await ctp.api('GET', `/stores/key=${encodeURIComponent(storeKey)}`);
const currency = store.countries?.some((c) => c.code === 'US') && !store.countries?.some((c) => c.code === 'DE') ? 'USD' : 'EUR';
const country = currency === 'USD' ? 'US' : 'DE';
const retail = store.distributionChannels?.[0];
const line = sku ?? (await ctp.api('GET', `/in-store/key=${encodeURIComponent(storeKey)}/product-projections?limit=1`)).results[0]?.masterVariant?.sku;
if (!line) fail('The store shows no product to test with.');

let cartId;
try {
  const cart = await ctp.api('POST', `/in-store/key=${encodeURIComponent(storeKey)}/carts`, {
    currency,
    country,
    store: { typeId: 'store', key: storeKey },
    lineItems: [{ sku: line, quantity: Number(quantity), ...(retail ? { distributionChannel: retail } : {}) }],
  });
  cartId = cart.id;
  const priced = await ctp.api('GET', `/carts/${cartId}`);
  console.log(`discount ${discount.key ?? discountId} (${kind}), cart in ${storeKey}, line ${line} x ${quantity}`);
  for (const item of priced.lineItems) {
    const applied = (item.discountedPricePerQuantity ?? []).flatMap((q) => q.discountedPrice.includedDiscounts.map((d) => d.discount.id));
    console.log(`  list ${item.price.value.centAmount}, line total ${item.totalPrice.centAmount}, discount applied: ${applied.includes(discount.id) || (item.price.discounted?.discount?.id === discount.id) ? 'yes' : 'no'}`);
  }
  console.log(`  cart total ${priced.totalPrice.centAmount} ${priced.totalPrice.currencyCode}`);
  console.log('Compare these figures with the editor preview for the same sample.');
} finally {
  if (cartId) {
    const latest = await ctp.api('GET', `/carts/${cartId}`);
    await ctp.api('DELETE', `/carts/${cartId}?version=${latest.version}`);
    console.log('temporary cart deleted');
  }
}
