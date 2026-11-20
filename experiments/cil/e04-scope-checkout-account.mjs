import { readFileSync } from 'node:fs';
import { anonymous, gql, rest, show } from './lib.mjs';

// Demo password comes from the app's own git-ignored env file; it is never printed.
const env = Object.fromEntries(readFileSync(new URL('../../../../../b2c-foodservice/storefront/.env.local', import.meta.url), 'utf8')
  .split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.split('=')[0], l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]));

let t = (await anonymous()).token;
const q = async (label, query, vars) => { const r = await gql(t, query, vars); show(label, r.json); return r.json; };
const brief = (j) => JSON.stringify(j).slice(0, 500);

// ---- session scope with the real keys
console.log('\n#### SCOPE');
for (const body of [{ storeKey: 'b2c-retail-store' }, { storeKey: 'nope' }, { supplyChannelId: 'nope' }, { distributionChannelId: 'nope' }]) {
  const r = await rest('PUT', '/session/scope', body, t);
  console.log(JSON.stringify(body), '->', r.status, brief({ ...r.json, token: r.json?.token ? '<jwt>' : undefined }));
  if (r.status === 200 && r.json.token) t = r.json.token;
}
await q('viewer after scope', '{ viewer { store { key name } } }');

// ---- cart: stock cap, shipping, payment methods, beginPayment
console.log('\n#### CART');
const sku = 'MCF-COF-COLDBREW-250-WB';
await q('addCartLine huge quantity (stock cap error?)', 'mutation($sku:String!){ addCartLine(input:{sku:$sku, quantity:5000}){ userErrors{ code message } cart { lines { quantity } } } }', { sku });
await q('addCartLine unknown sku', 'mutation{ addCartLine(input:{sku:"NOPE", quantity:1}){ userErrors{ code message } } }');
await q('addCartLines two skus', 'mutation($a:String!){ addCartLines(inputs:[{sku:$a,quantity:1},{sku:"MCF-COF-COLDBREW-1K-WB",quantity:1}]){ userErrors{ code message } cart { lineCount } } }', { a: sku });
await q('paymentMethods', '{ paymentMethods { __typename } }');
await q('beginPayment with no address / no routing rule', 'mutation{ beginPayment { paymentTicket projectKey region mode payable { amount currencyCode } expiresAt userErrors { code message } } }');
await q('applyDiscountCode WELCOME10 (app seed code)', 'mutation{ applyDiscountCode(code:"WELCOME10"){ userErrors{ code message } cart { discountCodes { __typename } } } }');
await q('setCustomerEmail guest', 'mutation{ setCustomerEmail(email:"guest@example.com"){ userErrors{ code } } }');

// ---- market switch round trip
console.log('\n#### MARKET');
let r = await rest('PATCH', '/session', { locale: 'en-CA', currency: 'CAD', country: 'CA' }, t);
console.log('PATCH to CA ->', r.status); const usToken = t; t = r.json.token;
await q('CA cart', '{ cart { lineCount } }');
t = usToken;
await q('back on the old US token: cart still there?', '{ viewer { country } cart { lineCount } }');
r = await rest('PATCH', '/session', { locale: 'en-US', currency: 'USD', country: 'US' }, t);
console.log('PATCH back to US ->', r.status); t = r.json.token;
await q('US cart after round trip', '{ viewer { country } cart { lineCount } }');

// ---- signed-in customer: demo Maya (US)
console.log('\n#### ACCOUNT (demo customer Maya, seeded test data)');
const si = await rest('POST', '/session', { grant_type: 'password', email: 'maya.okonkwo@example.com', password: env.DEMO_LOGIN_PASSWORD, locale: 'en-US', currency: 'USD', country: 'US' }, t);
console.log('password grant ->', si.status, brief({ ...si.json, token: si.json?.token ? '<jwt>' : undefined }));
if (si.status === 200) {
  t = si.json.token;
  await q('me', '{ me { id key firstName lastName email addresses { id } custom { __typename } } }');
  await q('cart after sign-in (anonymous cart merged?)', '{ cart { lineCount } }');
  await q('orders', '{ orders(first: 5) { totalCount edges { node { id orderNumber orderState shipmentState state { __typename } availableActions custom { __typename } returns { id } deliveries { id } lines { id sku custom { __typename } } } } } }');
  await q('shoppingLists', '{ shoppingLists { id name lines { sku } } }');
}
