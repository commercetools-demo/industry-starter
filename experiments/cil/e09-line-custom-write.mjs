// Re-checks whether line custom fields are writable, trying every plausible input shape, and shows
// that READING them works on an existing line. Test cart only.
import { anonymous, gql, show } from './lib.mjs';
const t = (await anonymous()).token;
const run = async (label, query) => { const r = await gql(t, query); console.log(`\n## ${label}\n` + JSON.stringify(r.json.errors?.map((e) => e.message) ?? r.json.data).slice(0, 600)); return r.json; };

const add = await gql(t, 'mutation{ addCartLine(input:{sku:"MCF-COF-COLDBREW-250-WB", quantity:1}){ cart { lines { id custom { __typename } } } } }');
const lineId = add.json.data.addCartLine.cart.lines[0].id;
console.log('line added, id ok:', !!lineId);

for (const shape of [
  'custom: {fulfilment: DELIVERY}',
  'custom: {McfLineFulfilment: {fulfilment: DELIVERY}}',
  'customFields: {fulfilment: DELIVERY}',
  'fields: {fulfilment: DELIVERY}',
  'mcfLineFulfilment: {fulfilment: DELIVERY}',
]) {
  await run(`updateCartLineCustomFields { lineId, ${shape} }`, `mutation{ updateCartLineCustomFields(input:{lineId:"${lineId}", ${shape}}){ userErrors{ code message } } }`);
}
await run('addCartLine with custom (same shapes as above tried once)', 'mutation{ addCartLine(input:{sku:"MCF-COF-COLDBREW-250-WB", quantity:1, custom:{McfLineFulfilment:{fulfilment: DELIVERY}}}){ userErrors{ code } } }');

// read side: a line that already carries custom fields (Noah's cart from the app)
const env = (await import('node:fs')).readFileSync(new URL('../../../../../b2c-foodservice/storefront/.env.local', import.meta.url), 'utf8');
