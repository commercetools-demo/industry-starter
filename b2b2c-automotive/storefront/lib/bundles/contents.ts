// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// What a bundle contains (workstream W-11). Pure: no server imports. The seed's and the portal's bundles carry two attributes on the master
// variant: `component-skus` (a set of SKUs) and `component-quantities` (a set of `<sku>:<qty>` strings).

export interface BundleComponent {
  sku: string;
  qty: number;
}

type Attributes = { name: string; value?: unknown }[] | undefined;
interface ProductLike {
  masterVariant?: { attributes?: Attributes };
  variants?: { attributes?: Attributes }[];
}

const SKU = /^[A-Za-z0-9._-]{1,64}$/;
const MAX_QTY = 99;

const attributeOf = (product: ProductLike, name: string): unknown => [product.masterVariant, ...(product.variants ?? [])].flatMap((v) => v?.attributes ?? []).find((a) => a.name === name)?.value;

/**
 * The components of a bundle product, or `null` when the product has no `component-skus` (it is a plain part). A component without a
 * `<sku>:<qty>` entry counts once; a bad or zero quantity is 1 and a quantity above 99 is 99; malformed or repeated SKUs are dropped.
 */
export function parseBundleContents(product: ProductLike): BundleComponent[] | null {
  const skus = attributeOf(product, 'component-skus');
  if (!Array.isArray(skus)) return null;
  const quantities = new Map<string, number>();
  const raw = attributeOf(product, 'component-quantities');
  for (const entry of Array.isArray(raw) ? raw : []) {
    if (typeof entry !== 'string') continue;
    const parts = entry.split(':');
    if (parts.length !== 2) continue;
    const qty = Number(parts[1]);
    quantities.set(parts[0], Number.isInteger(qty) && qty >= 1 ? Math.min(qty, MAX_QTY) : 1);
  }
  const seen = new Set<string>();
  const components: BundleComponent[] = [];
  for (const sku of skus) {
    if (typeof sku !== 'string' || !SKU.test(sku) || seen.has(sku)) continue;
    seen.add(sku);
    components.push({ sku, qty: quantities.get(sku) ?? 1 });
  }
  return components.length > 0 ? components : null;
}

/** Bundles that can be sold: the minimum over the components of available quantity divided by `qty`, rounded down. A missing sku has none. */
export function bundleUnits(components: readonly BundleComponent[], availableBySku: Readonly<Record<string, number>>): number {
  if (components.length === 0) return 0;
  return Math.min(...components.map((c) => Math.floor(Math.max(0, availableBySku[c.sku] ?? 0) / c.qty)));
}

/** Units of a component line for `bundleQty` bundles. */
export const childQuantity = (bundleQty: number, componentQty: number): number => bundleQty * componentQty;

/**
 * The stock of a bundle line, derived from its component lines (a bundle has no inventory entry of its own): how many whole bundles the
 * branch can cover and how many more the warehouse can. `components` carry the per bundle quantity of each component sku.
 */
export function bundleLineStock(
  components: readonly BundleComponent[],
  stockBySku: Readonly<Record<string, { branchQty: number; masterQty: number }>>,
): { branchQty: number; masterQty: number } {
  if (components.length === 0) return { branchQty: 0, masterQty: 0 };
  const whole = (pick: (s: { branchQty: number; masterQty: number }) => number) =>
    Math.min(...components.map((c) => Math.floor(Math.max(0, pick(stockBySku[c.sku] ?? { branchQty: 0, masterQty: 0 })) / c.qty)));
  const branch = whole((s) => s.branchQty);
  const total = whole((s) => s.branchQty + s.masterQty);
  return { branchQty: branch, masterQty: Math.max(0, total - branch) };
}
