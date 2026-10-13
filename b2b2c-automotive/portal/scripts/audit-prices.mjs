// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Detective control for price integrity (workstream X-11, attack A14). READ ONLY: lists every standalone price of the project whose money is
// not a whole number of cents above zero with two fraction digits, that sits on a channel no store knows, or that is in USD on a store that does
// not sell in the US. Exit code 1 when any exists. Run with the seller-admin client of the environment (it never prints a secret):
//   node --env-file=.env.local scripts/audit-prices.mjs
// Refuses any project other than spec-test-b2b2c-automotive (JUNIOR-GUIDE rule 7). Needs CTP_API_URL, CTP_AUTH_URL, CTP_PROJECT_KEY,
// CTP_ADMIN_CLIENT_ID and CTP_ADMIN_CLIENT_SECRET in the environment; the scope is `view_products view_stores`-class read access.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const EXPECTED_PROJECT_KEY = 'spec-test-b2b2c-automotive';

const sells = (store) => ((store.countries ?? []).some((c) => c.code === 'US') ? ['EUR', 'USD'] : ['EUR']);

/**
 * `prices` are standalone prices (`{ id, sku, value, channel? }`), `stores` are stores with `countries` and `distributionChannels` references.
 * A price without a channel is a Malva base price (the owner's, written by the seed) and is checked for its money only.
 */
export function auditPrices({ prices, stores }) {
  const channelStore = new Map();
  for (const store of stores) for (const ref of store.distributionChannels ?? []) channelStore.set(ref.id, store);
  const problems = [];
  const add = (price, code, message) => problems.push({ id: price.id, sku: price.sku, code, message });
  for (const price of prices) {
    const v = price.value ?? {};
    if (v.type !== 'centPrecision' || !Number.isInteger(v.centAmount) || !(v.centAmount > 0) || v.fractionDigits !== 2) {
      add(price, 'INVALID_MONEY', `value is not a whole cent amount above zero (centAmount ${String(v.centAmount)}, type ${String(v.type)})`);
    }
    if (price.channel?.id) {
      const store = channelStore.get(price.channel.id);
      if (!store) add(price, 'CHANNEL_WITHOUT_STORE', `channel ${price.channel.id} is not a distribution channel of any store`);
      else if (!sells(store).includes(v.currencyCode)) add(price, 'CURRENCY_NOT_SOLD', `${String(v.currencyCode)} on a channel of store ${store.key}, which does not sell in it`);
    }
  }
  return problems;
}

/* eslint-disable no-restricted-syntax -- a standalone read-only operator script, not app code: it talks to the commercetools HTTP API directly so it needs no Next.js runtime */
async function token(env) {
  const basic = Buffer.from(`${env.CTP_ADMIN_CLIENT_ID}:${env.CTP_ADMIN_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${env.CTP_AUTH_URL.replace(/\/$/, '')}/oauth/token`, { method: 'POST', headers: { authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
  if (!res.ok) throw new Error(`token request failed with status ${res.status}`);
  return (await res.json()).access_token;
}

async function pages(env, accessToken, resource, query = '') {
  const results = [];
  for (let offset = 0; ; offset += 500) {
    const res = await fetch(`${env.CTP_API_URL.replace(/\/$/, '')}/${env.CTP_PROJECT_KEY}/${resource}?limit=500&offset=${offset}${query}`, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`${resource} read failed with status ${res.status}`);
    const body = await res.json();
    results.push(...body.results);
    if (body.results.length < 500) return results;
  }
}

/* eslint-enable no-restricted-syntax */

export async function run(env = process.env) {
  if (env.CTP_PROJECT_KEY !== EXPECTED_PROJECT_KEY) {
    console.error(`audit-prices refuses to run: CTP_PROJECT_KEY must be ${EXPECTED_PROJECT_KEY}`);
    return 2;
  }
  for (const name of ['CTP_API_URL', 'CTP_AUTH_URL', 'CTP_ADMIN_CLIENT_ID', 'CTP_ADMIN_CLIENT_SECRET']) {
    if (!env[name]) {
      console.error(`audit-prices: ${name} is not set`);
      return 2;
    }
  }
  const accessToken = await token(env);
  const [prices, stores] = await Promise.all([pages(env, accessToken, 'standalone-prices'), pages(env, accessToken, 'stores')]);
  const problems = auditPrices({ prices, stores });
  for (const p of problems) console.error(`${p.code} ${p.sku ?? ''} ${p.id}: ${p.message}`);
  console.log(`audit-prices: ${prices.length} prices, ${problems.length} problems`);
  return problems.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  run().then(
    (code) => process.exit(code),
    (error) => {
      console.error(`audit-prices failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      process.exit(2);
    },
  );
}
