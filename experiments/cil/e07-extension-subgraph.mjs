// Calls the raw LOCAL extension subgraph directly, simulating what the router does for federation
// entities (it supplies `id` and the @requires fields such as `_ctId`). Nothing is pushed.
import { show } from './lib.mjs';
const URL_ = 'http://localhost:4010/graphql';
async function q(label, query, variables) {
  const res = await fetch(URL_, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }) });
  const t = await res.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  show(`${label} [HTTP ${res.status}]`, j);
}

const ent = (type, rep, field) => ({
  query: `query($r:[_Any!]!){ _entities(representations:$r){ ... on ${type} { ${field} } } }`,
  variables: { r: [rep] },
});
let e = ent('Product', { __typename: 'Product', id: 'x', _ctId: '230931da-293d-4a23-8587-347aaf023d99' }, 'probeReviewCount');
await q('D1 reviews on Ember Ristretto (project has 163 reviews in total)', e.query, e.variables);
e = ent('Customer', { __typename: 'Customer', id: 'x', _ctId: 'dd4819e6-df48-4a12-af5d-e6b8330de865' }, 'probeRecurringOrderCount');
await q('C1 recurring orders of Noah (he has one recurring order)', e.query, e.variables);
e = ent('Customer', { __typename: 'Customer', id: 'x', _ctId: '00000000-0000-0000-0000-000000000000' }, 'probeRecurringOrderCount');
await q('C1 unknown customer id', e.query, e.variables);
