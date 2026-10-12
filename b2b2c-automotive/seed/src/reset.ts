// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Api, Kind } from './api';
import { executeCleanup, formatCounts, isSeedOwned, type Entry, type Plan } from './cleanup';
import { CONTRACT_KEYS, K } from './data/base';
import { allProductDrafts } from './data/catalog';
import { categoryDrafts } from './data/categories';
import { cartDiscountDrafts, discountCodeDrafts, productDiscountDrafts } from './data/discounts';
import { typeDrafts } from './data/custom-types';
import { inventoryDrafts, recurrencePolicyDrafts } from './data/extras';
import { BUSINESS_UNITS, CUSTOMERS, channelDrafts, roleDrafts, storeDrafts } from './data/org';
import { isSeedPriceKey, standalonePriceDrafts } from './data/prices';
import { productTypeDrafts } from './data/product-types';
import { stateDrafts } from './data/states';
import { shippingMethodDrafts, taxCategoryDraft, zoneDrafts } from './data/tax-shipping';
import { OWNED_CONTAINERS } from './data/base';
import { allTailoringKeys } from './drafts';
import { fail, getAdmin, isMainModule, parseArgs, Runner, sleep } from './lib';
import type { Res } from './api';

/**
 * Removes the seed's OWN resources (every key comes from the data files and starts with `mau-`), in reverse
 * dependency order, so `npm run seed` can rebuild from nothing. It never touches sample data (that is seed:cleanup) and
 * leaves the Contentools default theme (`configuration/default-theme`) alone because Contentools users own it afterwards.
 *
 *   npm run reset -- --dry-run
 *   npm run reset -- --confirm spec-test-b2b2c-automotive
 */
const keys = (xs: { key?: string }[]): string[] => xs.map((x) => x.key as string);

/** Kind and explicit key list in DELETION order. */
export function resetTargets(): { kind: Kind; keys: string[] }[] {
  return [
    { kind: 'standalone-prices', keys: keys(standalonePriceDrafts()) },
    { kind: 'product-tailoring', keys: allTailoringKeys() },
    { kind: 'business-units', keys: BUSINESS_UNITS.map((b) => b.key).reverse() },
    { kind: 'customers', keys: CUSTOMERS.map((c) => c.key) },
    { kind: 'discount-codes', keys: keys(discountCodeDrafts) },
    { kind: 'cart-discounts', keys: keys(cartDiscountDrafts) },
    { kind: 'product-discounts', keys: keys(productDiscountDrafts) },
    { kind: 'stores', keys: keys(storeDrafts()) },
    { kind: 'product-selections', keys: [K.selMaster, K.selNorth, K.selSouth] },
    { kind: 'inventory', keys: keys(inventoryDrafts()) },
    { kind: 'products', keys: keys(allProductDrafts()) },
    { kind: 'categories', keys: keys(categoryDrafts).reverse() },
    { kind: 'product-types', keys: keys(productTypeDrafts) },
    { kind: 'channels', keys: keys(channelDrafts) },
    { kind: 'recurrence-policies', keys: keys(recurrencePolicyDrafts) },
    { kind: 'shipping-methods', keys: keys(shippingMethodDrafts) },
    { kind: 'tax-categories', keys: [taxCategoryDraft.key as string] },
    { kind: 'zones', keys: keys(zoneDrafts) },
    { kind: 'types', keys: keys(typeDrafts) },
    { kind: 'associate-roles', keys: keys(roleDrafts) },
    { kind: 'states', keys: keys(stateDrafts) },
  ];
}

/** `mau-` keys, the explicit contract keys of `CONTRACT_KEYS`, and standalone price keys of the seed's own scheme and SKUs. */
export const isResettable = (kind: Kind, key: string): boolean => (kind === 'standalone-prices' ? isSeedPriceKey(key, key.split('__')[0] ?? '') : isSeedOwned(key) || CONTRACT_KEYS.includes(key));

export async function planReset(api: Api): Promise<Plan & { objects: { container: string; key: string }[] }> {
  const entries: Entry[] = [];
  const counts: Plan['counts'] = [];
  const refused: string[] = [];
  for (const t of resetTargets()) {
    let matched = 0;
    for (const key of t.keys) {
      if (!isResettable(t.kind, key)) { refused.push(`${t.kind} ${key}: not a seed key`); continue; }
      const res = await api.getByKey(t.kind, key);
      if (!res) continue;
      matched += 1;
      entries.push({ kind: t.kind, res: res as Res, label: `${t.kind} ${key}`, depth: 0 });
    }
    counts.push({ kind: t.kind, listed: t.keys.length, matched, left: t.keys.length - matched });
  }
  const objects: { container: string; key: string }[] = [];
  for (const container of OWNED_CONTAINERS) for (const o of await api.listObjects(container)) objects.push({ container, key: o.key });
  return { entries, counts, refused, objects };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { api, env } = await getAdmin();
  if (!args.dryRun && args.confirm !== env.projectKey) throw new Error(`--confirm must equal the project key "${env.projectKey}" (or use --dry-run)`);
  const plan = await planReset(api);
  console.log(formatCounts(plan).join('\n'));
  const run = new Runner(args.dryRun);
  let failed = await executeCleanup(api, run, plan, () => sleep(80));
  for (const o of plan.objects) {
    try {
      await run.act(`delete custom object ${o.container}/${o.key}`, () => api.removeObject(o.container, o.key));
    } catch (e) {
      failed += 1;
      console.error(`FAILED custom object ${o.container}/${o.key}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`${args.dryRun ? 'dry run: ' : ''}${run.changes} deletion(s), ${failed} failed`);
  if (failed > 0) process.exit(1);
}

if (isMainModule(import.meta.url)) main().catch(fail);
