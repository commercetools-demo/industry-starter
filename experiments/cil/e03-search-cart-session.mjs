import { anonymous, gql, rest, show } from './lib.mjs';
let s = await anonymous();
let t = s.token;
const q = async (label, query, vars) => { const r = await gql(t, query, vars); show(label, r.json); return r.json; };
const brief = (j) => JSON.stringify(j).slice(0, 600);

// ---- A1 search: facets, attribute filter, sort, availability on nodes
const first = await q('A1 search: totalCount, facet codes, first 3',
  '{ search(first: 3) { totalCount facets { code label options { value count } } nodes { id productName availability { inStock quantity } price { amount currencyCode } defaultVariant { sku } } } }');
const facets = first?.data?.search?.facets ?? [];
console.log('\nfacet codes:', facets.map((f) => `${f.code}(${f.options.length})`).join(', '));

// brand evidence: are drinks and coffee both visible with no store?
await q('A1 text query "almond" (a Malva Drinks product?)', '{ search(first: 3, query: "almond") { totalCount nodes { productName } } }');

// ---- store scope via REST (PUT /session/scope)
const scope = await rest('PUT', '/session/scope', { store: 'b2c-retail-store' }, t);
console.log('\n## PUT /session/scope with the project store ->', scope.status, brief(scope.json));
const scope2 = await rest('PUT', '/session/scope', { store: 'mcf-selection-malva-drinks' }, t);
console.log('## PUT /session/scope with a non-store key ->', scope2.status, brief(scope2.json));

// ---- C2 availability per store?
await q('C2 variant availability on a product (single number, not per store?)',
  '{ search(first: 1) { nodes { productName availability { inStock quantity } variants { sku availability { inStock quantity } } } } }');

// ---- A2 cart: addCartLine shape, custom fields, channel override
const sku = first?.data?.search?.nodes?.[0]?.defaultVariant?.sku;
console.log('\nusing sku', sku);
await q('A2 addCartLine plain', 'mutation($sku:String!){ addCartLine(input:{sku:$sku, quantity:2}){ userErrors{ code message } cart { lineCount lines { id sku quantity custom { __typename } } totals { __typename } } } }', { sku });
await q('A2 addCartLine WITH custom fields (does the input accept `custom`?)', 'mutation($sku:String!){ addCartLine(input:{sku:$sku, quantity:1, custom:{fulfilment: DELIVERY}}){ userErrors{ code message } cart { lineCount } } }', { sku });
await q('A2 addCartLine with supplyChannel (is there per-line supply channel?)', 'mutation($sku:String!){ addCartLine(input:{sku:$sku, quantity:1, supplyChannel:"x"}){ userErrors{ code } } }', { sku });
await q('A2 addCartLine with recurrence (is there per-line recurrence?)', 'mutation($sku:String!){ addCartLine(input:{sku:$sku, quantity:1, recurrenceInfo:{}}){ userErrors{ code } } }', { sku });
await q('A2 cart custom fields type', '{ cart { lineCount custom { __typename } lines { id custom { __typename } } } }');
await q('A2 introspect UpdateCartLineCustomFieldsInput via bad field', 'mutation { updateCartLineCustomFields(input:{lineId:"x", custom:{fulfilment: COLLECT}}){ userErrors{ code } } }');

// ---- C5 market change via PATCH /session
const sw = await rest('PATCH', '/session', { locale: 'en-CA', currency: 'CAD', country: 'CA' }, t);
console.log('\n## PATCH /session to CA/CAD ->', sw.status, brief(sw.json));
if (sw.json?.token) t = sw.json.token;
await q('C5 cart after market switch (carried over? emptied? error?)', '{ viewer { country currency locale } cart { lineCount lines { sku quantity lineTotal { amount currencyCode } } } }');
