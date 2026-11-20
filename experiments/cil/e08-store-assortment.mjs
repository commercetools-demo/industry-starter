import { anonymous, gql, rest, show } from './lib.mjs';
let t = (await anonymous()).token;
const count = async (label) => show(label, (await gql(t, '{ search(first: 1) { totalCount } products(first:1){ pageInfo { hasNextPage } } viewer { store { key } } }')).json);
await count('no store scope');
const r = await rest('PUT', '/session/scope', { storeKey: 'b2c-retail-store' }, t); t = r.json.token;
await count('store scope = b2c-retail-store (no product selections attached to it)');
