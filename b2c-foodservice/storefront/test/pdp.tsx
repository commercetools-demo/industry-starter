import type { RenderResult } from '@testing-library/react';
import type { ReactNode } from 'react';
import { unstable_serialize } from 'swr';
import { keyChannels } from '@/lib/cache-keys';
import type { Selection } from '@/lib/product/resolve-variant';
import { parseSelection } from '@/lib/product/selection';
import type {
  Money, ProductPageData, RecurrencePolicyView, SelectorDef, Store, VariantStock, VariantView,
} from '@/lib/types';
import { renderShell, stubFetch } from '@/test/shell';

/** Test data for the product page (workstream H). Plain objects, no commercetools types. */
export const usd = (centAmount: number): Money => ({ centAmount, currencyCode: 'USD' });

const ALL_DAY = { open: '00:00', close: '23:59' } as const;
export const STORE_SOHO: Store = {
  id: 'ch-soho', key: 'mcf-store-nyc-soho', name: 'Malva SoHo', addressLine: '1 Prince St', city: 'New York', postalCode: '10012',
  country: 'US', timeZone: 'America/New_York', collectionMinutes: 15,
  hours: { mon: ALL_DAY, tue: ALL_DAY, wed: ALL_DAY, thu: ALL_DAY, fri: ALL_DAY, sat: ALL_DAY, sun: ALL_DAY },
};
export const STORE_BK: Store = { ...STORE_SOHO, id: 'ch-bk', key: 'mcf-store-brooklyn', name: 'Malva Brooklyn', addressLine: '2 Bedford Ave' };

export const POLICIES: RecurrencePolicyView[] = [
  { id: 'rp-2w', key: 'mcf-every-2-weeks', name: 'Every 2 weeks', schedule: { unit: 'Weeks', value: 2 } },
  { id: 'rp-1m', key: 'mcf-every-month', name: 'Every month', schedule: { unit: 'Months', value: 1 } },
];

export const stock = (over: Partial<VariantStock> = {}): VariantStock => ({ online: 50, stores: { 'ch-soho': 20, 'ch-bk': 0 }, ...over });

export function variantView(sku: string, attrs: VariantView['attrs'], cents: number | null, over: Partial<VariantView> = {}): VariantView {
  return {
    sku, id: 1, attrs, attrLabels: {},
    price: cents === null ? null : { value: usd(cents), tiers: [] },
    recurring: [], images: [], stock: stock(), ...over,
  };
}

const recurring = (cents: number): VariantView['recurring'] => [
  { policyId: 'rp-2w', value: usd(Math.round(cents * 0.9)) },
  { policyId: 'rp-1m', value: usd(Math.round(cents * 0.9)) },
];
const img = (n: string) => ({ url: `https://img.example.com/${n}.jpg`, alt: n });

const BASE: Omit<ProductPageData, 'product'> = {
  guideLinks: { original: 'original-pods', vertuo: 'vertuo-pods' },
  policies: POLICIES, inventoryFailed: false, freeShippingThreshold: usd(7500), returnDays: 30, collection: true, country: 'US', currency: 'USD',
};

const baseProduct = (over: Partial<ProductPageData['product']>): ProductPageData['product'] => ({
  id: 'p-1', slug: 'ember-ristretto', name: 'Ember Ristretto', categoryName: 'Pods', breadcrumb: [{ id: 'cat-pods', name: 'Pods', slug: 'pods' }],
  tagline: 'A dark roast pod.', description: 'A dark roast pod. Compatible with Original machines.', shape: 'pods', badge: 'bestseller',
  subscribable: true, rating: null, variants: [], defaultSku: '', selectors: [],
  facts: { intensity: 12, roast: 'Dark', roastKey: 'dark', origin: 'Brazil', notes: ['dark chocolate', 'oak'], specs: [{ key: 'system', value: 'Original' }] },
  ...over,
});

export function podPage(over: Partial<ProductPageData> = {}): ProductPageData {
  const variants = [
    variantView('POD-10', { capsulesPerPack: 10 }, 590, { recurring: recurring(590), images: [img('pack'), img('lifestyle'), img('box')], unit: { money: usd(59), perKey: 'capsule' } }),
    variantView('POD-50', { capsulesPerPack: 50 }, 2595, { recurring: recurring(2595), images: [img('pack')], unit: { money: usd(52), perKey: 'capsule' } }),
    variantView('POD-100', { capsulesPerPack: 100 }, 4720, { recurring: recurring(4720), images: [img('pack')], unit: { money: usd(47), perKey: 'capsule' } }),
  ];
  const selectors: SelectorDef[] = [
    { attr: 'capsulesPerPack', renderer: 'pill', required: true, options: [{ value: '10', label: '10' }, { value: '50', label: '50' }, { value: '100', label: '100' }] },
  ];
  return { ...BASE, product: baseProduct({ variants, selectors, defaultSku: 'POD-10', systemKey: 'original', rating: { average: 4.5, count: 4, distribution: { 1: 0, 2: 0, 3: 0, 4: 2, 5: 2 } } }), ...over };
}

export function coffeePage(over: Partial<ProductPageData> = {}): ProductPageData {
  const v = (sku: string, size: number, grind: string, cents: number) =>
    variantView(sku, { sizeGrams: size, grind }, cents, { recurring: recurring(cents), attrLabels: { grind: grind === 'whole-bean' ? 'Whole bean' : 'Filter' }, unit: { money: usd(Math.round((cents / size) * 100)), perKey: '100g' } });
  const variants = [v('COF-250-WB', 250, 'whole-bean', 1695), v('COF-250-FIL', 250, 'filter', 1695), v('COF-1K-WB', 1000, 'whole-bean', 5765), v('COF-1K-FIL', 1000, 'filter', 5765)];
  const selectors: SelectorDef[] = [
    { attr: 'sizeGrams', renderer: 'pill', required: true, options: [{ value: '250', label: '250' }, { value: '1000', label: '1000' }] },
    { attr: 'grind', renderer: 'pill', required: true, options: [{ value: 'whole-bean', label: 'Whole bean' }, { value: 'filter', label: 'Filter' }] },
  ];
  return {
    ...BASE,
    product: baseProduct({ id: 'p-2', slug: 'ethiopia-yirgacheffe', name: 'Ethiopia Yirgacheffe', categoryName: 'Coffee', shape: 'coffee', variants, selectors, defaultSku: 'COF-250-WB', facts: { roast: 'Light', roastKey: 'light', origin: 'Ethiopia', notes: ['jasmine'], specs: [] } }),
    ...over,
  };
}

export function machinePage(system = 'original', over: Partial<ProductPageData> = {}): ProductPageData {
  const v = (sku: string, colour: string, bundle: string, cents: number) =>
    variantView(sku, { colour, bundle }, cents, { attrLabels: { colour: colour === 'black' ? 'Black' : 'Red', bundle: bundle === 'machine-only' ? 'Machine only' : 'Starter capsules' }, images: [img(`${colour}-1`), img(`${colour}-2`)] });
  const variants = [v('MAC-B-M', 'black', 'machine-only', 12900), v('MAC-B-S', 'black', 'starter-capsules', 15390), v('MAC-R-M', 'red', 'machine-only', 12900), v('MAC-R-S', 'red', 'starter-capsules', 15390)];
  const selectors: SelectorDef[] = [
    { attr: 'colour', renderer: 'colour', required: true, options: [{ value: 'black', label: 'Black' }, { value: 'red', label: 'Red' }] },
    { attr: 'bundle', renderer: 'pill', required: true, options: [{ value: 'machine-only', label: 'Machine only' }, { value: 'starter-capsules', label: 'Starter capsules' }] },
  ];
  return {
    ...BASE,
    product: baseProduct({
      id: 'p-3', slug: 'pod-one', name: 'Pod One', categoryName: 'Machines', shape: 'machine', subscribable: false, badge: null, variants, selectors,
      defaultSku: 'MAC-B-M', systemKey: system, facts: { notes: [], specs: [{ key: 'pressureBar', value: '19' }, { key: 'warrantyMonths', value: '24' }] },
    }),
    policies: [],
    ...over,
  };
}

export function accessoryPage(over: Partial<ProductPageData> = {}): ProductPageData {
  const variants = [variantView('ACC-CRE', { colour: 'cream' }, 2495, { attrLabels: { colour: 'Cream' } }), variantView('ACC-BLA', { colour: 'black' }, 2495, { attrLabels: { colour: 'Black' } })];
  const selectors: SelectorDef[] = [
    { attr: 'colour', renderer: 'colour', required: true, options: [{ value: 'cream', label: 'Cream' }, { value: 'black', label: 'Black' }] },
  ];
  return { ...BASE, product: baseProduct({ id: 'p-4', slug: 'glass-cups', name: 'Glass cups', categoryName: 'Accessories', shape: 'accessory', subscribable: false, badge: null, variants, selectors, defaultSku: 'ACC-CRE', facts: { notes: [], specs: [] } }), policies: [], ...over };
}

export interface RenderPdpOptions {
  locale?: string;
  /** Query string values (the initial selection is parsed from them, as the route does). */
  query?: Record<string, string>;
  landingSku?: string;
  /** Key of the chosen store; omit for none. */
  selectedKey?: string | null;
  choose?: string;
  /** Rendered next to the page inside the providers (probes). */
  extra?: ReactNode;
  /** Extra fetch stubs by URL prefix (the channel list and the cart count are always stubbed). */
  routes?: Record<string, (init?: RequestInit) => unknown>;
}

/** Renders the whole page composition inside the shell providers with the channel list seeded. */
export async function renderPdp(data: ProductPageData, opts: RenderPdpOptions = {}): Promise<RenderResult> {
  const { default: ProductDetail } = await import('@/components/pdp/ProductDetail');
  const locale = opts.locale ?? 'en-US';
  const us = locale === 'en-US';
  const channels = { stores: us ? [STORE_SOHO, STORE_BK] : [], selectedKey: opts.selectedKey ?? null };
  stubFetch({ '/api/channels': () => channels, '/api/cart/count': () => ({ count: 0 }), ...opts.routes });
  const landing = data.product.variants.find((v) => v.sku === (opts.landingSku ?? data.product.defaultSku));
  const initial: Selection = parseSelection(opts.query ?? {}, data.product.selectors, landing);
  return renderShell(
    <>
      <ProductDetail data={data} initialSelection={initial} {...(opts.choose ? { choose: opts.choose } : {})} />
      {opts.extra}
    </>,
    {
      locale,
      fallback: {
        [unstable_serialize(keyChannels(us ? 'US' : 'CA'))]: channels,
      },
    },
  );
}
