// Brand partnership (W-16): the guardrails that still exist after the owner scope change. There is NO price floor, NO territory
// rule and NO content review (Q-T03, Q-O03, Q-T06). What remains: the fitment-claim rule (Enforced: a local product that claims
// fitment is never published by the reseller until Malva approves) and an informational price note. KPIs: Compliance over the
// fitment claims and the number of claims pending. Flags: this store's local products awaiting Malva review.
import 'server-only';
import type { PartnershipFlag, Partnership } from '@/lib/w-types';
import { complianceScore } from '@/lib/partnership/score';
import { LOCAL_TYPE } from './local-products';
import { CONTAINERS, listStoreObjects } from './w-objects';
import { listOwnProducts, textAttribute } from './w-products';

export type { PartnershipFlag, Partnership };

export async function getPartnership(storeKey: string): Promise<Partnership> {
  const [products, records] = await Promise.all([listOwnProducts(LOCAL_TYPE, storeKey), listStoreObjects<{ storeKey?: unknown; productKey?: string; claimedVehicles?: unknown }>(CONTAINERS.localReview, storeKey)]);
  const claimed = new Map(records.map((r) => [r.value.productKey ?? '', Array.isArray(r.value.claimedVehicles) ? (r.value.claimedVehicles as unknown[]).filter((v): v is string => typeof v === 'string') : []]));
  const flags: PartnershipFlag[] = products
    .filter((p) => textAttribute(p, 'review-state') === 'pending')
    .map((p) => {
      const key = p.key ?? p.id;
      return { kind: 'fitment-claim' as const, part: { key, sku: p.masterVariant.sku ?? '', name: { ...(p.name ?? {}) } }, claimedVehicles: claimed.get(key) ?? [], fixHref: `/import?tab=local&key=${encodeURIComponent(key)}` };
    })
    .sort((a, b) => a.part.sku.localeCompare(b.part.sku));
  const checkedKeys = new Set([...flags.map((f) => f.part.key), ...[...claimed.entries()].filter(([, v]) => v.length > 0).map(([k]) => k)]);
  return {
    rules: [
      { id: 'fitment', state: 'Enforced' },
      { id: 'price', state: 'Informational' },
    ],
    kpis: { compliance: { score: complianceScore(checkedKeys.size, flags.length), checked: checkedKeys.size, flags: flags.length }, claimsPending: flags.length },
    flags,
  };
}
