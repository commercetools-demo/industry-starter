/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Customer facts for audience rules (W-07): what each customer of the store bought (categories with ancestors, SKUs), the last
// order date and the marketing consent. Read from the store's orders (at most 2,000) and customers; cached for 5 minutes per
// store. Consent comes from the custom field `marketingConsent` of the seed type `malva-customer`; a customer without it has not
// consented. Nothing here sends anything (Q-P01).
import 'server-only';
import type { CustomerFact } from '@/lib/marketing/audience';
import { hydrateByIds, listCategories } from './catalog-data';
import { wRoot } from './w-root';

export const ORDER_LIMIT = 2000;
const TTL_MS = 5 * 60_000;
const cache = new Map<string, { expires: number; facts: CustomerFact[] }>();

export function clearAudienceCache(storeKey?: string): void {
  if (storeKey) cache.delete(storeKey);
  else cache.clear();
}

interface OrderLine {
  customerId?: string;
  createdAt: string;
  lines: { productId: string; sku: string }[];
}

export async function loadAudienceFacts(storeKey: string, now: number = Date.now()): Promise<CustomerFact[]> {
  const hit = cache.get(storeKey);
  if (hit && hit.expires > now) return hit.facts;
  const root = await wRoot();
  const inStore = root.inStoreKeyWithStoreKeyValue({ storeKey });

  const customers: { id: string; consent: boolean }[] = [];
  for (let offset = 0; offset < 5000; offset += 500) {
    const { body } = await inStore.customers().get({ queryArgs: { limit: 500, offset } }).execute();
    customers.push(...body.results.map((c) => ({ id: c.id, consent: c.custom?.fields?.marketingConsent === true })));
    if (body.results.length < 500) break;
  }

  const orders: OrderLine[] = [];
  for (let offset = 0; offset < ORDER_LIMIT; offset += 500) {
    const { body } = await inStore.orders().get({ queryArgs: { limit: Math.min(500, ORDER_LIMIT - offset), offset, sort: 'createdAt desc' } }).execute();
    orders.push(...body.results.map((o) => ({ customerId: o.customerId, createdAt: o.createdAt, lines: (o.lineItems ?? []).map((l) => ({ productId: l.productId, sku: l.variant?.sku ?? '' })) })));
    if (body.results.length < 500) break;
  }

  const [categories, products] = await Promise.all([listCategories(), hydrateByIds([...new Set(orders.flatMap((o) => o.lines.map((l) => l.productId)))])]);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const withAncestors = (ids: readonly string[]): string[] => {
    const keys = new Set<string>();
    for (const id of ids) {
      for (let cur = byId.get(id), guard = 0; cur && guard < 20; cur = cur.parentId ? byId.get(cur.parentId) : undefined, guard += 1) keys.add(cur.key);
    }
    return [...keys];
  };

  const facts: CustomerFact[] = customers.map((c) => {
    const own = orders.filter((o) => o.customerId === c.id);
    const lines = own.flatMap((o) => o.lines);
    return {
      customerId: c.id,
      consent: c.consent,
      categoryKeys: withAncestors([...new Set(lines.flatMap((l) => products.get(l.productId)?.categoryIds ?? []))]),
      skus: [...new Set(lines.map((l) => l.sku).filter(Boolean))],
      lastOrderAt: own.reduce<string | null>((latest, o) => (latest === null || o.createdAt > latest ? o.createdAt : latest), null),
    };
  });
  cache.set(storeKey, { expires: now + TTL_MS, facts });
  return facts;
}
