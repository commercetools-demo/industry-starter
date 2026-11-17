import { anonymous, gql, show } from './lib.mjs';
const t = (await anonymous()).token;
const q = async (label, query, vars) => show(label, (await gql(t, query, vars)).json);

await q('A1 search no filter: count, facets, first 3',
  '{ search(first: 3) { totalCount facets { code label options { value label count } } nodes { id productName slug availability { inStock quantity } price { centAmount currencyCode } } } }');
await q('A1 products list (no search text)', '{ products(first: 3) { totalCount: __typename edges { node { productName } } pageInfo { hasNextPage } } }');
await q('A1 text query', '{ search(first: 3, query: "espresso") { totalCount nodes { productName } } }');
await q('C3 product by sku (unknown sku -> null?)', '{ product(sku: "NOPE-1") { id productName } }');
await q('A1 categories', '{ categories { id slug name parent { id } } }');
