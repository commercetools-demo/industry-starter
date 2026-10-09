import { erasePatient } from '../privacy/erase-patient';
import { CONTAINER_PREFIX, MALVA_CONTAINERS } from './containers';
import { executeDeletion, planDeletion, SEED_ORDER } from './deletion';
import { coll, listAll, realSleep, withRetry, type Ctx, type Rec } from './lib';
import { isSyntheticEmail } from './synthetic';

/**
 * Full cleanup before a full seeding, in dependency order:
 *
 *   1. (--include-customers) the synthetic customers: emails on example.com (the seed's patients and the demo/test sign-ups).
 *      Their recurring orders first (they reference orders, carts and recurrence policies), then everything the patient erasure
 *      collects (orders, carts, payments, reviews, shopping lists, custom objects of the patient, the customer) with
 *      `dataErasure=true`; then example.com guest orders and carts.
 *   2. reviews, then products, categories, product types, shipping, tax, zones, recurrence policies, states, types, channels
 *      (the existing `seed` deletion; only keys starting `mlv-`).
 *   3. every `malva-*` Custom Object container (the 13 in lib/ct/custom-objects.ts and any other with the prefix).
 *
 * Nothing outside these sets is touched: sample data is `cleanup-sample.ts`'s job, customers without an example.com email are never deleted.
 */
export interface ResetOptions { includeCustomers: boolean }
export interface ResetSummary { customers: number; objects: number; resources: number }

const pause = (ctx: Ctx) => (ctx.pauseMs ? (ctx.sleep ?? realSleep)(ctx.pauseMs) : Promise.resolve());
const emailOf = (r: Rec) => String(r.customerEmail ?? r.email ?? '');

/** Synthetic customers (example.com), each with their recurring orders and everything `erasePatient` collects. */
export async function eraseSyntheticCustomers(ctx: Ctx): Promise<number> {
  const customers = (await listAll(ctx.root, 'customers')).filter((c) => isSyntheticEmail(String(c.email ?? '')));
  for (const c of customers) {
    const id = c.id as string;
    // recurring orders have a DELETE with dataErasure; they must go before the orders and carts they point at
    const recurring = (await listAll(ctx.root, 'recurringOrders')).filter((r) => (r.customer as { id?: string } | undefined)?.id === id);
    for (const r of recurring) {
      ctx.log(`${ctx.dryRun ? 'would delete ' : 'deleted     '} recurringOrders ${String(r.id)}`);
      if (!ctx.dryRun) {
        await withRetry(() => coll(ctx.root, 'recurringOrders').withId({ ID: r.id as string }).delete({ queryArgs: { version: r.version, dataErasure: true } }).execute(), ctx.sleep);
        await pause(ctx);
      }
    }
    await erasePatient(ctx.root, id, { dryRun: ctx.dryRun, confirm: id, log: ctx.log, sleep: ctx.sleep });
  }
  return customers.length;
}

/** Guest orders and carts (no customer id) with an example.com email. */
export async function eraseSyntheticGuestCarts(ctx: Ctx): Promise<number> {
  let n = 0;
  for (const kind of ['orders', 'carts'] as const) {
    const guests = (await listAll(ctx.root, kind)).filter((r) => isSyntheticEmail(emailOf(r)));
    for (const r of guests) {
      ctx.log(`${ctx.dryRun ? 'would delete ' : 'deleted     '} ${kind} ${String(r.id)}`);
      if (!ctx.dryRun) {
        await withRetry(() => coll(ctx.root, kind).withId({ ID: r.id as string }).delete({ queryArgs: { version: r.version, dataErasure: true } }).execute(), ctx.sleep);
        await pause(ctx);
      }
      n += 1;
    }
  }
  return n;
}

interface ObjectsApi {
  get(a: { queryArgs: Rec }): { execute(): Promise<{ body: { results: { container: string; key: string; version: number }[] } }> };
  withContainerAndKey(a: { container: string; key: string }): { delete(a: { queryArgs: Rec }): { execute(): Promise<unknown> } };
}

/** Deletes every object of every `malva-*` container (the known 13 are always visited, others are found by listing). */
export async function deleteMalvaObjects(ctx: Ctx): Promise<number> {
  const api = (ctx.root as unknown as { customObjects: () => ObjectsApi }).customObjects();
  const found: { container: string; key: string; version: number }[] = [];
  for (let offset = 0; ; offset += 200) {
    const page = (await withRetry(() => api.get({ queryArgs: { limit: 200, offset } }).execute(), ctx.sleep)).body.results;
    found.push(...page.filter((o) => o.container.startsWith(CONTAINER_PREFIX)));
    if (page.length < 200) break;
  }
  const unknown = [...new Set(found.map((o) => o.container))].filter((c) => !(MALVA_CONTAINERS as readonly string[]).includes(c));
  if (unknown.length > 0) ctx.log(`note: also removing containers not in the known list: ${unknown.join(', ')}`);
  for (const o of found) {
    ctx.log(`${ctx.dryRun ? 'would delete ' : 'deleted     '} customObject ${o.container}/${o.key}`);
    if (!ctx.dryRun) {
      await withRetry(() => api.withContainerAndKey({ container: o.container, key: o.key }).delete({ queryArgs: { version: o.version, dataErasure: true } }).execute(), ctx.sleep);
      await pause(ctx);
    }
  }
  return found.length;
}

export async function runReset(ctx: Ctx, o: ResetOptions): Promise<ResetSummary> {
  let customers = 0;
  if (o.includeCustomers) {
    customers = await eraseSyntheticCustomers(ctx);
    await eraseSyntheticGuestCarts(ctx);
  } else {
    ctx.log('customers are kept (add --include-customers to erase the example.com customers and their carts, orders, payments, lists and recurring orders)');
  }
  // reviews first, the rest in dependency order (SEED_ORDER starts with reviews)
  const items = await planDeletion(ctx, 'seed');
  const { deleted } = await executeDeletion(ctx, items);
  const objects = await deleteMalvaObjects(ctx);
  ctx.log(`${ctx.dryRun ? 'dry run: ' : ''}reset ${ctx.dryRun ? 'would remove' : 'removed'} ${customers} customer(s), ${items.length} resource(s) (order: ${SEED_ORDER.join(', ')}), ${objects} custom object(s)`);
  return { customers, objects, resources: ctx.dryRun ? items.length : deleted };
}
