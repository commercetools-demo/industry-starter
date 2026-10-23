// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Api, Kind } from './api';
import { deleteTargets, isSeedOwned, type Target } from './cleanup';
import { CONTRACT_KEYS } from './data/base';
import { CATEGORIES } from './data/categories';
import { shoppingListDraft, CUSTOMERS } from './data/customers';
import { typeDrafts } from './data/custom-types';
import { cartDiscountDrafts, discountCodeDrafts, productDiscountDrafts } from './data/discounts';
import { inventoryDrafts, recurrencePolicyDrafts } from './data/extras';
import { productTypeDrafts } from './data/product-types';
import { PRODUCTS } from './data/products';
import { reviewDrafts } from './data/reviews';
import { stateDrafts } from './data/states';
import { channelDrafts } from './data/stores';
import { shippingMethodDrafts, taxCategoryDrafts, zoneDrafts } from './data/tax-shipping';
import { fail, getAdmin, isMainModule, parseArgs, Runner, sleep } from './lib';

/**
 * Removes the seed's OWN resources (every key comes from the data files and starts with `mcf-`, or is in CONTRACT_KEYS),
 * in reverse dependency order, so `npm run seed` can rebuild from nothing. It never touches anything else (a hand-made
 * product stays) and never touches sample data (that is seed:inventory and seed:cleanup).
 *
 *   npm run reset -- --dry-run
 *   npm run reset -- --confirm <projectKey>
 */
const keys = (xs: { key?: string }[]): string[] => xs.map((x) => x.key as string);

/** Kind and explicit key list in DELETION order. */
export function resetTargets(): { kind: Kind; keys: string[] }[] {
  return [
    { kind: 'reviews', keys: keys(reviewDrafts()) },
    { kind: 'shopping-lists', keys: [shoppingListDraft().key as string] },
    { kind: 'customers', keys: CUSTOMERS.map((c) => c.key) },
    { kind: 'discount-codes', keys: keys(discountCodeDrafts) },
    { kind: 'cart-discounts', keys: keys(cartDiscountDrafts) },
    { kind: 'product-discounts', keys: keys(productDiscountDrafts()) },
    { kind: 'inventory', keys: keys(inventoryDrafts()) },
    { kind: 'products', keys: PRODUCTS.map((p) => p.key) },
    { kind: 'shipping-methods', keys: keys(shippingMethodDrafts) },
    { kind: 'tax-categories', keys: keys(taxCategoryDrafts) },
    { kind: 'zones', keys: keys(zoneDrafts) },
    { kind: 'categories', keys: CATEGORIES.map((c) => c.key).reverse() },
    { kind: 'product-types', keys: keys(productTypeDrafts) },
    { kind: 'recurrence-policies', keys: keys(recurrencePolicyDrafts) },
    { kind: 'channels', keys: keys(channelDrafts()) },
    { kind: 'types', keys: keys(typeDrafts) },
    // Definition order: `ordered` references `preparing`, so the referencing state goes first.
    { kind: 'states', keys: keys(stateDrafts) },
  ];
}

/** `mcf-` keys and the explicit contract keys; nothing else is ever deleted by reset. */
export const isResettable = (key: string): boolean => isSeedOwned(key) || CONTRACT_KEYS.includes(key);

export async function planReset(api: Api): Promise<{ targets: Target[]; refused: string[] }> {
  const targets: Target[] = [];
  const refused: string[] = [];
  for (const t of resetTargets()) {
    for (const key of t.keys) {
      if (!isResettable(key)) { refused.push(`${t.kind} ${key}: not a seed key`); continue; }
      const res = await api.getByKey(t.kind, key);
      if (res) targets.push({ kind: t.kind, id: res.id, label: `${t.kind} ${key}` });
    }
  }
  return { targets, refused };
}

export async function runReset(api: Api, run: Runner, pause?: () => Promise<void>): Promise<{ failed: string[]; refused: string[] }> {
  const plan = await planReset(api);
  for (const r of plan.refused) console.error(`REFUSED ${r}`);
  const failed = await deleteTargets(api, run, plan.targets, pause);
  return { failed, refused: plan.refused };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { api, env } = await getAdmin();
  if (!args.dryRun && args.confirm !== env.projectKey) throw new Error(`--confirm must equal the project key "${env.projectKey}" (or use --dry-run)`);
  const run = new Runner(args.dryRun);
  const r = await runReset(api, run, () => sleep(80));
  for (const f of r.failed) console.error(`FAILED ${f}`);
  console.log(`${args.dryRun ? 'dry run: ' : ''}${run.changes} deletion(s), ${r.failed.length} failed`);
  if (r.failed.length > 0 || r.refused.length > 0) process.exit(1);
}

if (isMainModule(import.meta.url)) main().catch(fail);
