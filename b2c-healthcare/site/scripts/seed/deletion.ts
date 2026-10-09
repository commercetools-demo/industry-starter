import { coll, hasPrefix, listAll, withRetry, realSleep, type Ctx, type Kind, type Rec } from './lib';

/**
 * Shared by cleanup-sample.ts (delete everything WITHOUT the mlv- prefix) and reset-seed.ts (delete ONLY mlv- resources).
 * Kinds are visited in dependency order; each kind's items are sorted so referencing resources go first.
 */
export type Mode = 'sample' | 'seed';

/** Sample data order (E-03): carts, orders, inventory, products, categories (leaves first), product types, shipping methods, tax categories, stores, zones. */
export const SAMPLE_ORDER: Kind[] = ['carts', 'orders', 'inventory', 'products', 'categories', 'productTypes', 'shippingMethods', 'taxCategories', 'stores', 'zones'];
/** Seed reset order: reviews first (they reference products and customers), then shipping before zones and tax; states, types and channels last (they are referenced by the rest). */
export const SEED_ORDER: Kind[] = ['reviews', 'inventory', 'products', 'categories', 'productTypes', 'shippingMethods', 'taxCategories', 'zones', 'recurrencePolicies', 'states', 'types', 'channels'];
/** Zones that existed before the seed and stay (project findings: `usa` is reused, `europe` is left alone). */
export const KEPT_ZONES = ['usa', 'europe'];

export interface Item { kind: Kind; id: string; key?: string; version: number; published?: boolean; depth: number; /** DELETE with `dataErasure=true` (reviews carry patient text). */ erase?: boolean }

const toItem = (kind: Kind, r: Rec): Item => ({
  kind,
  id: r.id as string,
  key: r.key as string | undefined,
  version: r.version as number,
  published: kind === 'products' ? !!(r.masterData as { published?: boolean } | undefined)?.published : undefined,
  depth: kind === 'categories' ? ((r.ancestors as unknown[]) ?? []).length : 0,
  erase: kind === 'reviews' ? true : undefined,
});

/** Whether a resource of this kind is in scope of the mode. Never selects a prefixed resource in `sample` mode. */
export function selected(mode: Mode, kind: Kind, r: Rec): boolean {
  if (mode === 'seed') return hasPrefix(r);
  if (hasPrefix(r)) return false;
  if (kind === 'zones' && KEPT_ZONES.includes(r.key as string)) return false;
  return true;
}

export async function planDeletion(ctx: Ctx, mode: Mode): Promise<Item[]> {
  const items: Item[] = [];
  for (const kind of mode === 'sample' ? SAMPLE_ORDER : SEED_ORDER) {
    if (mode === 'seed' && (kind === 'carts' || kind === 'orders')) continue;
    const found = (await listAll(ctx.root, kind)).filter((r) => selected(mode, kind, r)).map((r) => toItem(kind, r));
    // children before parents: deepest categories first
    items.push(...(kind === 'categories' ? found.sort((a, b) => b.depth - a.depth) : found));
  }
  return items;
}

const label = (i: Item) => `${i.kind} ${i.key ?? i.id}`;

export async function executeDeletion(ctx: Ctx, items: Item[]): Promise<{ deleted: number }> {
  let deleted = 0;
  for (const item of items) {
    if (ctx.dryRun) {
      ctx.log(`would delete  ${label(item)}`);
      continue;
    }
    const handle = coll(ctx.root, item.kind).withId({ ID: item.id });
    let version = item.version;
    if (item.kind === 'products' && item.published) {
      version = (await withRetry(() => handle.post({ body: { version, actions: [{ action: 'unpublish' }] } }).execute(), ctx.sleep)).body.version as number;
    }
    if (item.kind === 'states') {
      // a state cannot be removed while another state lists it as a transition target
      version = (await withRetry(() => handle.post({ body: { version, actions: [{ action: 'setTransitions', transitions: [] }] } }).execute(), ctx.sleep)).body.version as number;
    }
    try {
      await withRetry(() => handle.delete({ queryArgs: { version, ...(item.erase ? { dataErasure: true } : {}) } }).execute(), ctx.sleep);
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 400 || status === 409) throw new Error(`${label(item)} could not be deleted (${(e as Error).message}). Something still references it (a customer's cart, order or recurring order?): run again with --include-customers (npm run seed:full does).`);
      throw e;
    }
    deleted += 1;
    ctx.log(`deleted       ${label(item)}`);
    if (ctx.pauseMs) await (ctx.sleep ?? realSleep)(ctx.pauseMs);
  }
  return { deleted };
}

export async function runDeletion(ctx: Ctx, mode: Mode): Promise<{ planned: number; deleted: number }> {
  const items = await planDeletion(ctx, mode);
  const { deleted } = await executeDeletion(ctx, items);
  ctx.log(`${ctx.dryRun ? 'dry run: ' : ''}${items.length} resource(s) ${ctx.dryRun ? 'would be ' : ''}deleted`);
  return { planned: items.length, deleted };
}
