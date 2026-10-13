// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Api, Kind, Res } from './api';
import { PREFIX } from './lib';
import { SAMPLE_ALLOWLIST } from './data/sample-allowlist';
import { fail, getAdmin, isMainModule, parseArgs, Runner, sleep } from './lib';

/**
 * Deletes ONLY the project's known sample data. It lists each resource kind and keeps exactly those whose key is in
 * the explicit allow-list of `src/data/sample-allowlist.ts` (standalone prices: whose SKU is in it). There is no
 * wildcard and no "delete everything not mine": anything not listed is left alone, and anything with the seed prefix
 * `mau-` is refused even if it were listed. Needs EXPECTED_PROJECT_KEY to match (checked by getAdmin) and
 * `--confirm <projectKey>` for a real run.
 *
 *   npm run seed:cleanup -- --dry-run
 *   npm run seed:cleanup -- --confirm spec-test-b2b2c-automotive
 */
type Allow = Record<string, readonly string[]>;

export interface Entry { kind: Kind; res: Res; label: string; depth: number; detachChannels?: string[] }
export interface Plan { entries: Entry[]; counts: { kind: string; listed: number; matched: number; left: number }[]; refused: string[] }

/** Deletion order: dependants before what they reference; categories deepest first. */
export const DELETE_ORDER: Kind[] = [
  'carts', 'orders', 'inventory', 'standalone-prices', 'products', 'product-discounts', 'discount-codes', 'cart-discounts', 'shipping-methods', 'tax-categories', 'zones',
  'categories', 'product-types', 'recurrence-policies', 'stores', 'channels',
];

export const isSeedOwned = (key: string | undefined): boolean => !!key && key.startsWith(PREFIX);

const KIND_ALLOW: Record<string, string> = {
  products: 'products', categories: 'categories', 'product-types': 'product-types', 'shipping-methods': 'shipping-methods',
  'tax-categories': 'tax-categories', zones: 'zones', channels: 'channels', 'product-discounts': 'product-discounts',
  'cart-discounts': 'cart-discounts', 'recurrence-policies': 'recurrence-policies',
};

export async function planCleanup(api: Api, allow: Allow = SAMPLE_ALLOWLIST): Promise<Plan> {
  const entries: Entry[] = [];
  const counts: Plan['counts'] = [];
  const refused: string[] = [];
  // Ids of the allow-listed sample resources that other resources reference. What references them has to go (or be
  // detached) first: sample carts and orders, inventory entries, prices, discount codes, store channel lists.
  const idsOf = async (kind: Kind): Promise<string[]> => {
    const keys = new Set<string>(allow[KIND_ALLOW[kind] as string] ?? []);
    return (await api.list(kind)).filter((r) => !!r.key && keys.has(r.key) && !isSeedOwned(r.key)).map((r) => r.id);
  };
  const channelIds = await idsOf('channels');
  const refIds = {
    channel: channelIds,
    order: [...channelIds, ...(await idsOf('shipping-methods')), ...(await idsOf('tax-categories')), ...(await idsOf('cart-discounts'))],
    code: await idsOf('cart-discounts'),
  };
  const refers = (res: Res, ids: string[]) => { const json = JSON.stringify(res); return ids.some((id) => json.includes(id)); };
  const idList = channelIds.map((id) => `"${id}"`).join(',');
  const where: Partial<Record<Kind, string>> = {
    carts: `lineItems(supplyChannel(id in (${idList})) or distributionChannel(id in (${idList})))`,
    inventory: `supplyChannel(id in (${idList}))`,
  };
  for (const kind of DELETE_ORDER) {
    if ((kind === 'carts' || kind === 'inventory') && channelIds.length === 0) { counts.push({ kind, listed: 0, matched: 0, left: 0 }); continue; }
    const listed = await api.list(kind, where[kind] ? { where: where[kind] } : undefined);
    const keys = new Set(kind === 'standalone-prices' ? [] : (allow[KIND_ALLOW[kind] as string] ?? []));
    const skus = new Set(kind === 'standalone-prices' ? (allow['standalone-price-skus'] ?? []) : []);
    let matched = 0;
    for (const res of listed) {
      const hit = kind === 'carts' || kind === 'inventory' || kind === 'stores' ? refers(res, refIds.channel)
        : kind === 'orders' ? refers(res, refIds.order)
        : kind === 'discount-codes' ? refers(res, refIds.code)
        : kind === 'standalone-prices' ? skus.has(res.sku as string) || refers(res, refIds.channel)
        : !!res.key && keys.has(res.key);
      if (!hit) continue;
      if (isSeedOwned(res.key) || isSeedOwned(res.sku as string | undefined)) {
        refused.push(`${kind} ${res.key ?? res.id}: key has the seed prefix ${PREFIX}`);
        continue;
      }
      matched += 1;
      const detach = kind === 'stores';
      entries.push({
        kind, res, label: detach ? `detach sample channels from store ${res.key ?? res.id}` : `${kind} ${res.key ?? res.id}`,
        depth: kind === 'categories' ? ((res.ancestors as unknown[]) ?? []).length : 0, ...(detach ? { detachChannels: channelIds } : {}),
      });
    }
    counts.push({ kind, listed: listed.length, matched, left: listed.length - matched });
  }
  const order = (e: Entry) => DELETE_ORDER.indexOf(e.kind);
  entries.sort((a, b) => order(a) - order(b) || b.depth - a.depth);
  return { entries, counts, refused };
}

export function formatCounts(plan: Plan): string[] {
  return [
    'kind                 listed  to delete  left in place',
    ...plan.counts.map((c) => `${c.kind.padEnd(20)} ${String(c.listed).padStart(6)} ${String(c.matched).padStart(10)} ${String(c.left).padStart(14)}`),
    ...plan.refused.map((r) => `REFUSED ${r}`),
  ];
}

const selectionMembers = new WeakMap<Api, Map<string, Set<string>>>();

/** A product that is in a product selection cannot be deleted: take it out of every selection first. */
async function removeFromSelections(api: Api, productId: string): Promise<void> {
  let cache = selectionMembers.get(api);
  if (!cache) {
    cache = new Map();
    for (const sel of await api.list('product-selections')) cache.set(sel.id, new Set(await api.listSelectionProducts(sel.id)));
    selectionMembers.set(api, cache);
  }
  for (const [selectionId, members] of cache) {
    if (!members.has(productId)) continue;
    const sel = await api.getById('product-selections', selectionId);
    if (sel) await api.update('product-selections', sel, [{ action: 'removeProduct', product: { typeId: 'product', id: productId } }]);
    members.delete(productId);
  }
}

/** A store that lists a sample channel keeps its other channels; only the sample ones are removed from it. */
async function detachChannels(api: Api, e: Entry): Promise<void> {
  const store = await api.getById('stores', e.res.id);
  if (!store) return;
  const drop = new Set(e.detachChannels ?? []);
  const keep = (field: string) => ((store[field] as { id?: string }[] | undefined) ?? []).filter((c) => c.id && !drop.has(c.id));
  const had = (field: string) => ((store[field] as { id?: string }[] | undefined) ?? []).length;
  const actions: Record<string, unknown>[] = [];
  if (keep('distributionChannels').length !== had('distributionChannels')) {
    actions.push({ action: 'setDistributionChannels', distributionChannels: keep('distributionChannels').map((c) => ({ typeId: 'channel', id: c.id })) });
  }
  if (keep('supplyChannels').length !== had('supplyChannels')) {
    actions.push({ action: 'setSupplyChannels', supplyChannels: keep('supplyChannels').map((c) => ({ typeId: 'channel', id: c.id })) });
  }
  if (actions.length) await api.update('stores', store, actions);
}

async function remove(api: Api, e: Entry): Promise<void> {
  if (e.kind === 'stores' && e.detachChannels) return detachChannels(api, e);
  if (e.kind === 'products') {
    // A published product must be unpublished before it can be deleted.
    const p = await api.getById('products', e.res.id);
    if (!p) return;
    await removeFromSelections(api, p.id);
    let version = p.version;
    if ((p.masterData as { published: boolean }).published) version = (await api.update('products', p, [{ action: 'unpublish' }])).version;
    await api.remove('products', { id: p.id, version });
    return;
  }
  await api.remove(e.kind, e.res);
}

export async function executeCleanup(api: Api, run: Runner, plan: Plan, pause: () => Promise<void> = () => Promise.resolve()): Promise<number> {
  let failed = 0;
  for (const e of plan.entries) {
    try {
      await run.act(`delete ${e.label}`, () => remove(api, e));
      await pause();
    } catch (err) {
      failed += 1;
      console.error(`FAILED ${e.label}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return failed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { api, env } = await getAdmin();
  if (!args.dryRun && args.confirm !== env.projectKey) throw new Error(`--confirm must equal the project key "${env.projectKey}" (or use --dry-run)`);
  const plan = await planCleanup(api);
  console.log(formatCounts(plan).join('\n'));
  const run = new Runner(args.dryRun);
  const failed = await executeCleanup(api, run, plan, () => sleep(80));
  console.log(`${args.dryRun ? 'dry run: ' : ''}${run.changes} deletion(s), ${failed} failed`);
  if (failed > 0 || plan.refused.length > 0) process.exit(1);
}

if (isMainModule(import.meta.url)) main().catch(fail);
