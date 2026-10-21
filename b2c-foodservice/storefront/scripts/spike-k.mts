/* eslint-disable no-restricted-imports, no-restricted-syntax -- standalone research script (task K-01), not app code: it cannot import lib/ct/client */
// SPDX-License-Identifier: MIT
// Workstream K, spike K-01. NOT YET RUN: needs live credentials in .env.local (OA-04, OA-K-a for S6 to S8 and S11 to S15).
// Run: node --env-file=.env.local --experimental-strip-types scripts/spike-k.mts [S1 S2 ...]
// It builds its own client (lib/ct/client imports 'server-only' and the `@/` alias, which plain node cannot resolve).
// Prints PASS / FAIL / UNKNOWN per probe, ids and key names only. Creates carts that stay in the project (D-019).
import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk';
import { ClientBuilder } from '@commercetools/ts-client';

type Verdict = 'PASS' | 'FAIL' | 'UNKNOWN';

const env = (n: string): string => {
  const v = process.env[n]?.trim();
  if (!v) throw new Error(`Missing ${n}`);
  return v;
};
const projectKey = env('CTP_PROJECT_KEY');
if (projectKey !== env('EXPECTED_PROJECT_KEY')) throw new Error('Wrong project key');
const client = new ClientBuilder()
  .withProjectKey(projectKey)
  .withClientCredentialsFlow({
    host: env('CTP_AUTH_URL'),
    projectKey,
    scopes: env('CTP_SCOPES').split(/\s+/),
    credentials: { clientId: env('CTP_CLIENT_ID'), clientSecret: env('CTP_CLIENT_SECRET') },
  })
  .withHttpMiddleware({ host: env('CTP_API_URL') })
  .build();
const api = createApiBuilderFromCtpClient(client).withProjectKey({ projectKey });

const wanted = new Set(process.argv.slice(2));
const results: Record<string, string> = {};
const run = async (id: string, fn: () => Promise<[Verdict, string]>) => {
  if (wanted.size && !wanted.has(id)) return;
  let line: string;
  try {
    const [v, f] = await fn();
    line = `${v}: ${f}`;
  } catch (e) {
    const err = e as { statusCode?: number; body?: { errors?: { code?: string }[] } };
    line = `FAIL: status ${err.statusCode ?? '?'} code ${err.body?.errors?.[0]?.code ?? 'n/a'}`;
  }
  results[id] = line;
  console.log(id, line);
};

const US = { country: 'US', state: 'NY', city: 'New York', postalCode: '10012', streetName: 'Prince Street', streetNumber: '148', email: 'spike-k@example.com' };
const CA = { country: 'CA', state: 'ON', city: 'Toronto', postalCode: 'M5V 2T6', streetName: 'King Street', streetNumber: '1', email: 'spike-k@example.com' };

async function firstSku(): Promise<string> {
  const { body } = await api.productProjections().get({ queryArgs: { limit: 1, staged: false } }).execute();
  const sku = body.results[0]?.masterVariant.sku;
  if (!sku) throw new Error('No product');
  return sku;
}

const post = async (id: string, version: number, actions: object[]) =>
  (await api.carts().withId({ ID: id }).post({ body: { version, actions: actions as never } }).execute()).body;

async function multipleCart() {
  const sku = await firstSku();
  const created = (
    await api.carts().post({
      body: { currency: 'USD', country: 'US', shippingMode: 'Multiple', anonymousId: `spike-k-${Date.now()}`, taxMode: 'Platform', deleteDaysAfterLastModification: 1 },
    }).execute()
  ).body;
  let cart = await post(created.id, created.version, [{ action: 'addLineItem', sku, quantity: 1 }]);
  cart = await post(cart.id, cart.version, [
    { action: 'addItemShippingAddress', address: { ...US, key: 'collect-spike', firstName: 'Spike', lastName: 'Tester' } },
    {
      action: 'addShippingMethod',
      shippingKey: 'collect-spike',
      shippingMethod: { typeId: 'shipping-method', key: 'mcf-collect' },
      shippingAddress: { ...US, key: 'collect-spike' },
    },
  ]);
  return cart;
}

await run('S1', async () => {
  const cart = await multipleCart();
  return [cart.shipping?.length ? 'PASS' : 'FAIL', `cart ${cart.id}, shipping entries ${cart.shipping?.length ?? 0}`];
});
await run('S2', async () => {
  const cart = await multipleCart();
  return ['UNKNOWN', `cart ${cart.id}, taxedPrice present ${Boolean(cart.taxedPrice)} (needs every quantity allocated; compare per market by hand)`];
});
await run('S3', async () => {
  const sku = await firstSku();
  const base = { anonymousId: `spike-k-${Date.now()}`, lineItems: [{ sku, quantity: 1 }], deleteDaysAfterLastModification: 1 };
  const us = (await api.carts().post({ body: { ...base, currency: 'USD', country: 'US', shippingAddress: US } }).execute()).body;
  const ca = (await api.carts().post({ body: { ...base, currency: 'CAD', country: 'CA', shippingAddress: CA } }).execute()).body;
  const keys = async (cartId: string) =>
    (await api.shippingMethods().matchingCart().get({ queryArgs: { cartId } }).execute()).body.results.map((x) => x.key).join(',');
  return ['PASS', `US keys ${await keys(us.id)}; CA keys ${await keys(ca.id)}`];
});
await run('S5', async () => {
  const cart = await multipleCart();
  const out: string[] = [];
  for (const code of ['WELCOME10', 'FREESHIP', 'COFFEE15']) {
    try {
      const current = (await api.carts().withId({ ID: cart.id }).get().execute()).body;
      const updated = await post(cart.id, current.version, [{ action: 'addDiscountCode', code }]);
      out.push(`${code}:${updated.discountCodes?.at(-1)?.state ?? '?'}`);
    } catch {
      out.push(`${code}:error`);
    }
  }
  return ['UNKNOWN', `cart ${cart.id} ${out.join(' ')}`];
});
for (const id of ['S4', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12', 'S13', 'S14', 'S15']) {
  await run(id, async () => ['UNKNOWN', ['S4', 'S9', 'S10'].includes(id) ? 'not scripted; see plans/evidence/K/spike/README.md' : 'blocked: OA-K-a']);
}
console.log(JSON.stringify(results, null, 2));
