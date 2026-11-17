// Runs against the LOCAL federated gateway (extension.serve --gateway), which composes the gap-probe
// extension with the deployed core schema. Nothing is pushed to the project.
import { readFileSync } from 'node:fs';
import { anonymous, rest, show } from './lib.mjs';
const env = Object.fromEntries(readFileSync(new URL('../../../../../b2c-foodservice/storefront/.env.local', import.meta.url), 'utf8')
  .split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.split('=')[0], l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]));

const LOCAL = 'http://localhost:4010/graphql';
const anon = (await anonymous()).token;
const si = await rest('POST', '/session', { grant_type: 'password', email: 'noah.patel@example.com', password: env.DEMO_LOGIN_PASSWORD, locale: 'en-US', currency: 'USD', country: 'US' }, anon);
const t = si.json.token;

async function q(label, query, token = t) {
  const res = await fetch(LOCAL, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ query }) });
  const text = await res.text(); let j; try { j = JSON.parse(text); } catch { j = text; }
  show(`${label} [HTTP ${res.status}]`, j);
}

await q('config keys visible to the resolver (names only)', '{ probeConfigKeys }');
await q('C2 store list via HTTP API from a resolver', '{ probeStores(country: "US") { key name city hours } }');
await q('D1 review count on a product via @requires(_ctId)', '{ product(sku: "MCF-COF-COLDBREW-250-WB") { productName probeReviewCount } }');
await q('C1 recurring order count on `me` via @requires(_ctId) (signed-in Noah)', '{ me { firstName probeRecurringOrderCount } }');
await q('C1 same field with an ANONYMOUS session (me is null, so no leak?)', '{ me { firstName probeRecurringOrderCount } }', anon);
