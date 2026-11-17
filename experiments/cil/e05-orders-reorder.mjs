import { readFileSync } from 'node:fs';
import { anonymous, gql, rest, show } from './lib.mjs';
const env = Object.fromEntries(readFileSync(new URL('../../../../../b2c-foodservice/storefront/.env.local', import.meta.url), 'utf8')
  .split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.split('=')[0], l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]));

const anon = (await anonymous()).token;
const si = await rest('POST', '/session', { grant_type: 'password', email: 'noah.patel@example.com', password: env.DEMO_LOGIN_PASSWORD, locale: 'en-US', currency: 'USD', country: 'US' }, anon);
const t = si.json.token;
const q = async (label, query, vars) => { const r = await gql(t, query, vars); show(label, r.json); return r.json; };

const list = await q('A4 orders list (light type)', '{ orders(first: 20) { totalCount edges { node { id orderNumber origin orderState shipmentState paymentState placedAt total { amount currencyCode } availableActions } } } }');
const nodes = list?.data?.orders?.edges?.map((e) => e.node) ?? [];
console.log('\nactions by order:', nodes.map((n) => `${n.orderNumber}:${n.orderState}/${n.shipmentState}:[${n.availableActions}]`).join(' | '));

const target = nodes[0];
if (target) {
  await q('A4 order detail: workflow state, returns, deliveries, lines.custom, custom',
    'query($id:ID!){ order(id:$id){ orderNumber orderState shipmentState state { key name } store { key } custom { __typename } returns { id lines { sku quantity shipmentState } } deliveries { recordedAt parcels { __typename } } availableActions lines { id sku quantity shippedQuantity outstandingQuantity custom { __typename ... on McfLineFulfilmentCustom { fulfilment brand } } } } }', { id: target.id });
  await q('A4 reorder (adds the order lines to the current cart; reports unavailable with reason)',
    'mutation($id:ID!){ reorder(orderId:$id){ userErrors { code message } unavailable { sku reason } cart { lineCount lines { sku quantity } } } }', { id: target.id });
}
await q('A4 requestReturn with a bad order id (validation only, nothing written)',
  'mutation{ requestReturn(input:{orderId:"nope", lines:[{lineId:"x", quantity:1}]}){ userErrors { code message } } }');
await q('B2 updateProfile input shape', 'mutation{ updateProfile(input:{firstName:"Maya"}){ userErrors { code } } }');
await q('B2 addAddress input fields (phone?)', 'mutation{ addAddress(input:{address:{country:"US", phone:"1"}}){ userErrors { code } } }');
await q('B2 any delete-account mutation? (expected: unknown field)', 'mutation{ deleteAccount { __typename } }');
await q('B3 any saved payment-method field? (expected: unknown)', '{ me { paymentMethods { __typename } } }');
await q('D1 reviews on a product? (expected: unknown)', '{ product(sku:"MCF-COF-COLDBREW-250-WB") { reviews { __typename } ratingStats { __typename } } }');
await q('C1 recurring orders root field? (expected: unknown)', '{ recurringOrders { __typename } }');
await q('C2 stores/channels/inventory root field? (expected: unknown)', '{ stores { __typename } channels { __typename } inventory { __typename } }');
