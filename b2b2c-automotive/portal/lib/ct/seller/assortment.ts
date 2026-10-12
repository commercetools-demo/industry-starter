// Assortment reads (T-02): the rows of "Assigned products", the authority chain card and the impact of a change.
import 'server-only';
import { ASSIGNED_STATES } from '@/lib/catalog/assortment-state';
import type { AssortmentFilter, AssortmentPage, AssortmentRow, ChainInfo, Impact } from '@/lib/catalog/types';
import { categoryAndDescendants, listCategories } from './catalog-data';
import { catalogRoot } from './catalog-root';
import { assignedBySku, loadMembers, type MemberRow, type Members } from './assortment-members';
import { listPricesBySku } from './prices';
import { chunk } from './versioned';

export { assignedBySku } from './assortment-members';

export interface AssortmentQuery {
  state?: AssortmentFilter;
  text?: string;
  categoryId?: string;
  offset: number;
  limit: number;
}

const isAssignedState = (r: MemberRow) => (ASSIGNED_STATES as readonly string[]).includes(r.state);

/** Rows of the store matching the filters (state filter, text, category with its descendants), before paging. */
export async function filterRows(members: Members, q: Pick<AssortmentQuery, 'state' | 'text' | 'categoryId'>): Promise<MemberRow[]> {
  const categoryIds = q.categoryId ? categoryAndDescendants(await listCategories(), q.categoryId) : undefined;
  const needle = q.text?.trim().toLowerCase();
  return members.rows.filter((r) => {
    if (q.state === 'assigned' && !isAssignedState(r)) return false;
    if (q.state === 'available' && !['available', 'withdrawn', 'pre-release'].includes(r.state)) return false;
    if (q.state === 'blocked' && r.state !== 'blocked-upstream') return false;
    if (categoryIds && !r.info.categoryIds.some((id) => categoryIds.has(id))) return false;
    if (needle && !(r.info.sku.toLowerCase().includes(needle) || Object.values(r.info.name).some((n) => n.toLowerCase().includes(needle)))) return false;
    return true;
  });
}

export async function listAssortment(storeKey: string, q: AssortmentQuery): Promise<AssortmentPage> {
  const members = await loadMembers(storeKey);
  const matching = await filterRows(members, q);
  const page = matching.slice(q.offset, q.offset + q.limit);
  const prices = await listPricesBySku(storeKey, page.map((r) => r.info.sku));
  const rows: AssortmentRow[] = page.map((r) => ({
    productId: r.info.id,
    productKey: r.info.key,
    sku: r.info.sku,
    name: r.info.name,
    listPrice: prices.get(r.info.sku) ?? null,
    state: r.state,
    reason: r.reason,
    ...(r.reasonBy ? { reasonBy: r.reasonBy } : {}),
    categoryIds: r.info.categoryIds,
  }));
  return {
    rows,
    total: matching.length,
    assigned: members.rows.filter((r) => r.membership.inMaster && members.resellerIds.has(r.info.id)).length,
    totalMaster: members.masterIds.size,
    capped: members.capped,
  };
}

/**
 * "Select all N matching the filter": the product ids the server resolves itself from the same filter code. For `withdraw` the
 * assigned rows, for `assign` the rows that can be assigned (never blocked upstream and never awaiting review).
 */
export async function resolveFilterIds(storeKey: string, filter: Pick<AssortmentQuery, 'state' | 'text' | 'categoryId'>, intent: 'assign' | 'withdraw'): Promise<string[]> {
  const members = await loadMembers(storeKey);
  const rows = await filterRows(members, filter);
  const wanted: readonly string[] = intent === 'withdraw' ? ['inherited', 'local'] : ['available', 'withdrawn', 'pre-release'];
  return rows.filter((r) => wanted.includes(r.state)).map((r) => r.info.id);
}

/** Counts for the chain card: master pool, approved (master minus blocked upstream), the store's selection, branch channels. */
export async function getChain(storeKey: string): Promise<ChainInfo> {
  const members = await loadMembers(storeKey);
  const blocked = new Set(members.object.blockedUpstream.map((b) => b.sku));
  const approved = members.rows.filter((r) => members.masterIds.has(r.info.id) && !blocked.has(r.info.sku)).length;
  return { masterCount: members.masterIds.size, approvedCount: approved, resellerCount: members.resellerIds.size, branchCount: members.store.branchChannels.length };
}

/** What a withdraw touches: the products, the store's branches and the open carts that contain them. */
export async function assortmentImpact(storeKey: string, productIds: readonly string[]): Promise<Impact> {
  const ids = [...new Set(productIds)];
  const [store, root] = await Promise.all([loadMembers(storeKey).then((m) => m.store), catalogRoot()]);
  const carts = new Set<string>();
  for (const part of chunk(ids, 100)) {
    const { body } = await root
      .carts()
      .get({ queryArgs: { where: 'cartState="Active" and store(key=:s) and lineItems(productId in :ids)', 'var.s': storeKey, 'var.ids': part, limit: 500 } })
      .execute();
    for (const cart of body.results) carts.add(cart.id);
  }
  return { count: ids.length, openCartCount: carts.size, branches: store.branchChannels.length };
}

/** True when the SKU's product is in the store's own selection. Used by W (bundles) as the COMPONENT_NOT_ASSIGNED guard. */
export async function isAssigned(storeKey: string, sku: string): Promise<boolean> {
  return (await assignedBySku(storeKey)).has(sku);
}
