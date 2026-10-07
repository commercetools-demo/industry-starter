// One-off cleanup of the furniture sample data in spec-test-b2c-telecom (owner approved 2026-10-07: catalog + sample customers, carts, orders, store).
// Usage: node cleanup.mjs <path-to-.env.seed> [--execute]    (default is a dry run: lists counts, deletes nothing)
import { readFileSync } from 'node:fs';
const [envPath] = process.argv.slice(2);
const EXECUTE = process.argv.includes('--execute');
const ALLOWED = 'spec-test-b2c-telecom';
const env = Object.fromEntries(readFileSync(envPath, 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]));
if (env.CTP_PROJECT_KEY !== ALLOWED) { console.error(`refusing: project key is not ${ALLOWED}`); process.exit(2); }
const API = env.CTP_API_URL.replace(/\/$/, ''); const P = env.CTP_PROJECT_KEY;
const tokenRes = await fetch(`${env.CTP_AUTH_URL.replace(/\/$/, '')}/oauth/token`, { method: 'POST', headers: { authorization: 'Basic ' + Buffer.from(`${env.CTP_CLIENT_ID}:${env.CTP_CLIENT_SECRET}`).toString('base64'), 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
if (!tokenRes.ok) { console.error('token request failed', tokenRes.status); process.exit(3); }
const tok = await tokenRes.json();
console.log('granted scopes:', String(tok.scope).split(' ').map((s) => s.replace(':' + P, '')).sort().join(' '));
const H = { authorization: `Bearer ${tok.access_token}`, 'content-type': 'application/json' };
async function call(method, path, body, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(`${API}/${P}${path}`, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 429 || r.status >= 500) { await new Promise((s) => setTimeout(s, 500 * (i + 1))); continue; }
    const text = await r.text();
    return { status: r.status, body: text ? JSON.parse(text) : null };
  }
  throw new Error(`${method} ${path} kept failing`);
}
async function listAll(path, extra = '') {
  const out = []; let offset = 0;
  for (;;) { const r = await call('GET', `${path}?limit=500&offset=${offset}&withTotal=false${extra}`); if (r.status !== 200) throw new Error(`GET ${path} ${r.status} ${JSON.stringify(r.body?.message)}`); out.push(...r.body.results); if (r.body.results.length < 500) break; offset += 500; }
  return out;
}
const summary = {};
async function del(kind, path, version, label) {
  if (!EXECUTE) { summary[kind] = (summary[kind] ?? 0) + 1; return true; }
  let v = version;
  for (let i = 0; i < 3; i++) {
    const r = await call('DELETE', `${path}${path.includes('?') ? '&' : '?'}version=${v}`);
    if (r.status === 200) { summary[kind] = (summary[kind] ?? 0) + 1; return true; }
    if (r.status === 409) { const cur = await call('GET', path.split('?')[0]); if (cur.status === 200) { v = cur.body.version; continue; } }
    console.error(`FAILED delete ${kind} ${label}: ${r.status} ${r.body?.message ?? ''}`); summary[kind + '_failed'] = (summary[kind + '_failed'] ?? 0) + 1; return false;
  }
  return false;
}
// 1 discounts
for (const x of await listAll('/discount-codes')) await del('discount-codes', `/discount-codes/${x.id}`, x.version, x.code);
for (const x of await listAll('/cart-discounts')) await del('cart-discounts', `/cart-discounts/${x.id}`, x.version, x.key);
for (const x of await listAll('/product-discounts')) await del('product-discounts', `/product-discounts/${x.id}`, x.version, x.key);
// 2 sample orders, carts, customers
for (const x of await listAll('/orders')) await del('orders', `/orders/${x.id}`, x.version, x.orderNumber ?? x.id);
for (const x of await listAll('/carts')) await del('carts', `/carts/${x.id}`, x.version, x.key ?? x.id);
for (const x of await listAll('/customers')) await del('customers', `/customers/${x.id}`, x.version, x.email);
// 3 products (unpublish, then delete)
for (const x of await listAll('/products')) {
  let { id, version } = x;
  if (EXECUTE && x.masterData.published) {
    const u = await call('POST', `/products/${id}`, { version, actions: [{ action: 'unpublish' }] });
    if (u.status !== 200) { console.error(`FAILED unpublish ${x.key}: ${u.status} ${u.body?.message}`); summary.products_failed = (summary.products_failed ?? 0) + 1; continue; }
    version = u.body.version;
  }
  await del('products', `/products/${id}`, version, x.key);
}
// 4 inventory
for (const x of await listAll('/inventory')) await del('inventory', `/inventory/${x.id}`, x.version, x.sku);
// 5 categories, leaves first
const cats = (await listAll('/categories')).sort((a, b) => b.ancestors.length - a.ancestors.length);
for (const x of cats) await del('categories', `/categories/${x.id}`, x.version, x.key);
// 6 product types
for (const x of await listAll('/product-types')) await del('product-types', `/product-types/${x.id}`, x.version, x.key);
// 7 store
for (const x of await listAll('/stores')) await del('stores', `/stores/key=${x.key}`, x.version, x.key);
console.log(EXECUTE ? 'DELETED:' : 'DRY RUN, would delete:', JSON.stringify(summary));
