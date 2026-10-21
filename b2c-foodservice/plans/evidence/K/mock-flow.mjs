// Drives the running dev server (mock commercetools) through the checkout API with a cookie jar. Local only.
const B = 'http://localhost:3055';
let jar = {};
async function call(method, path, body) {
  const res = await fetch(B + path, {
    method, redirect: 'manual',
    headers: { 'content-type': 'application/json', cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  for (const c of res.headers.getSetCookie()) {
    const [kv] = c.split(';');
    const i = kv.indexOf('=');
    if (/Max-Age=0/i.test(c)) delete jar[kv.slice(0, i)];
    else jar[kv.slice(0, i)] = kv.slice(i + 1);
  }
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text.slice(0, 120); }
  return { status: res.status, json, loc: res.headers.get('location') };
}
const show = (label, r) => console.log(label, r.status, r.loc ?? '', JSON.stringify(r.json).slice(0, 260));
const mock = (path, body) => fetch('https://localhost:9455' + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());

await call('GET', '/en-US/shop');
await call('POST', '/api/cart/lines', { sku: 'MCF-POD-EMBER-10', quantity: 2, fulfilment: 'delivery' });
await call('POST', '/api/cart/lines', { sku: 'MCF-POD-CASA-10', quantity: 1, fulfilment: 'collect', storeKey: 'mcf-store-nyc-soho' });
show('state', await call('GET', '/api/checkout'));
show('pickup empty', await call('PUT', '/api/checkout/pickup', { person: 'me', pickupName: '' }));
const prep = await call('PUT', '/api/checkout/pickup', { person: 'me', pickupName: 'Maya Lopez' });
console.log('payments', JSON.stringify(prep.json.payments), 'cookie', Boolean(jar.mcf_pay_carts));
show('session stale', await call('POST', '/api/checkout/session', { expectedTotalCents: 1, part: 0 }));
const bagId = (await call('GET', '/api/cart')).json.cart.id;
for (const p of prep.json.payments) {
  show(`session part ${p.part}`, await call('POST', '/api/checkout/session', { expectedTotalCents: p.totalCents, part: p.part }));
}
const parts = JSON.parse(decodeURIComponent(jar.mcf_pay_carts));
console.log('clone ids', parts.map((p) => p.id), 'bag', bagId);
// Simulate the hosted Checkout finishing payment 0, then payment 1.
const { createHash } = await import('node:crypto');
const CROCK = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function b32(buf) { let bits = 0, v = 0, o = ''; for (const b of buf) { v = (v << 8) | b; bits += 8; while (bits >= 5) { o += CROCK[(v >>> (bits - 5)) & 31]; bits -= 5; } } if (bits) o += CROCK[(v << (5 - bits)) & 31]; return o; }
const base = 'MC-' + b32(createHash('sha256').update(bagId).digest()).slice(0, 10);
console.log('base', base);
console.log('placed A', (await mock('/__mock/place-order', { cartId: parts[0].id, orderNumber: base + '-A', email: 'maya@example.com', address: { firstName: 'Maya', lastName: 'Lopez', country: 'US' } })).id);
show('complete A', await call('POST', '/api/checkout/complete', { part: 0 }));
show('bag after A', await call('GET', '/api/cart'));
console.log('placed B', (await mock('/__mock/place-order', { cartId: parts[1].id, orderNumber: base + '-B', email: 'maya@example.com' })).id);
show('complete B', await call('POST', '/api/checkout/complete', { part: 1 }));
show('bag after B', await call('GET', '/api/cart'));
console.log('guest cookie', jar.mcf_guest_email);
show('return', await call('GET', '/checkout/return?orderNumber=' + base + '-A'));
const orders = await (await fetch('https://localhost:9455/__mock/orders')).json();
for (const o of orders) {
  const r = await call('GET', '/api/orders/' + o.id);
  show('order ' + o.orderNumber, { ...r, json: { collect: r.json.order?.collect?.length, ship: Boolean(r.json.order?.ship), state: r.json.order?.state, linked: r.json.order?.linked, lines: r.json.order?.lines?.map((l) => l.fulfilment) } });
}
const page = await fetch(B + '/en-US/checkout/confirmation/' + orders[0].id, { headers: { cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') } });
const html = await page.text();
console.log('confirmation', page.status, /Order confirmed/.test(html), /Pickup name: Maya Lopez/.test(html), /Collection progress/.test(html));
console.log('no recent', (await fetch(B + '/en-US/checkout/confirmation/nope')).status, /No recent order/.test(await (await fetch(B + '/en-US/checkout/confirmation/nope')).text()));
