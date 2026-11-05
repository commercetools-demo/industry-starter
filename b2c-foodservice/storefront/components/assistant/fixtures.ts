import type {
  CardOrder,
  CardProduct,
  CheckoutPayload,
  ComparisonPayload,
  GuidePayload,
  OrderStatusPayload,
  PlanPayload,
  ProductsPayload,
} from './payloads';

/**
 * Fixture payloads for the six cards, in the enriched wire shape (snake_case, absent fields omitted). Used by the showcase page and the
 * card tests. No image URLs on purpose: the cards draw their neutral placeholder, and nothing here points at the network.
 */

export type ShowcaseLocale = 'en-US' | 'en-CA';
export type ShowcaseComponent = 'products' | 'comparison' | 'plan' | 'guide' | 'order_status' | 'checkout';
export const SHOWCASE_LOCALES: readonly ShowcaseLocale[] = ['en-US', 'en-CA'];
export const SHOWCASE_COMPONENTS: readonly ShowcaseComponent[] = ['products', 'comparison', 'plan', 'guide', 'order_status', 'checkout'];

const CURRENCY: Record<ShowcaseLocale, string> = { 'en-US': 'USD', 'en-CA': 'CAD' };
/** CAD prices are a flat 1.35 on the USD ones, rounded to the cent. */
const priced = (locale: ShowcaseLocale, usd: number): number => (locale === 'en-CA' ? Math.round(usd * 1.35 * 100) / 100 : usd);

function products(locale: ShowcaseLocale): Record<'espresso' | 'filter' | 'machine' | 'grinder' | 'family' | 'soldOut', CardProduct> {
  const currency = CURRENCY[locale];
  return {
    espresso: {
      product_id: 'mcf-espresso-1kg',
      title: 'Malva Espresso Blend 1 kg (Whole Bean)',
      brand: 'Malva Coffee',
      price: priced(locale, 32),
      currency,
      rating: 4.6,
      review_count: 218,
      labels: ['Dark roast', 'Fairtrade'],
      in_stock: true,
      short_description: 'Cocoa, toasted hazelnut and a long, syrupy finish. Built for milk drinks.',
      options: {},
      option_values: {},
    },
    filter: {
      product_id: 'mcf-filter-500g',
      title: 'Malva Morning Filter 500 g',
      brand: 'Malva Coffee',
      price: priced(locale, 17.5),
      currency,
      rating: 4.3,
      review_count: 96,
      labels: ['Medium roast'],
      in_stock: true,
      short_description: 'Stone fruit and brown sugar, clean and easy.',
      options: {},
      option_values: {},
    },
    machine: {
      product_id: 'mcf-machine-pro',
      title: 'Malva Pro Espresso Machine',
      brand: 'Malva Coffee',
      price: priced(locale, 349),
      currency,
      rating: 4.8,
      review_count: 41,
      in_stock: true,
      options: {},
      option_values: {},
    },
    grinder: {
      product_id: 'mcf-grinder-s',
      title: 'Malva Burr Grinder S',
      brand: 'Malva Coffee',
      price: priced(locale, 129),
      currency,
      rating: 4.4,
      review_count: 63,
      in_stock: true,
      options: {},
      option_values: {},
    },
    family: {
      product_id: 'mcf-house-blend',
      title: 'Malva House Blend',
      brand: 'Malva Coffee',
      price: priced(locale, 15),
      currency,
      rating: 4.5,
      review_count: 340,
      labels: ['Everyday'],
      in_stock: true,
      options: { size: ['250 g', '500 g', '1 kg'], grind: ['whole bean', 'filter', 'espresso'] },
      option_values: {},
    },
    soldOut: {
      product_id: 'mcf-reserve-geisha',
      title: 'Malva Reserve Geisha 200 g',
      brand: 'Malva Coffee',
      price: priced(locale, 48),
      currency,
      rating: 4.9,
      review_count: 12,
      in_stock: false,
      options: {},
      option_values: {},
    },
  };
}

/** The variants `GET /api/assistant/card/product` answers for the family above (the detail panel in the showcase has no network, so this is for tests). */
export function familyVariants(locale: ShowcaseLocale): CardProduct[] {
  const currency = CURRENCY[locale];
  const base = { brand: 'Malva Coffee', currency, in_stock: true, options: {}, variant_of: 'mcf-house-blend' } as const;
  return [
    {
      ...base,
      product_id: 'mcf-house-250-whole',
      title: 'Malva House Blend',
      price: priced(locale, 15),
      option_values: { size: '250 g', grind: 'whole bean' },
    },
    {
      ...base,
      product_id: 'mcf-house-500-whole',
      title: 'Malva House Blend',
      price: priced(locale, 27),
      option_values: { size: '500 g', grind: 'whole bean' },
    },
    {
      ...base,
      product_id: 'mcf-house-1kg-whole',
      title: 'Malva House Blend',
      price: priced(locale, 49),
      in_stock: false,
      option_values: { size: '1 kg', grind: 'whole bean' },
    },
  ];
}

export function productsPayload(locale: ShowcaseLocale, layout: 'carousel' | 'grid' | 'list' = 'carousel'): ProductsPayload {
  const p = products(locale);
  return {
    title: 'Coffee for milk drinks',
    layout,
    items: [
      { product: p.espresso, reason: 'Dark and sweet, it holds its own against steamed milk.' },
      { product: p.family, reason: 'The everyday pick; choose a size and grind with the assistant.' },
      { product: p.filter },
      { product: p.soldOut },
    ],
  };
}

export function comparisonPayload(locale: ShowcaseLocale): ComparisonPayload {
  const p = products(locale);
  const high = p.machine.price;
  const low = p.grinder.price;
  return {
    title: 'Machine or grinder first?',
    recommended_product_id: p.machine.product_id,
    dimensions: ['price', 'rating', 'counter space'],
    entries: [
      {
        product_id: p.machine.product_id,
        product: p.machine,
        best_for: 'Home espresso and milk drinks',
        pros: ['Steam wand included', 'Pressure gauge on the front', 'Highest rated of the two'],
        cons: ['Needs a grinder to get the most out of it'],
      },
      {
        product_id: p.grinder.product_id,
        product: p.grinder,
        best_for: 'Upgrading beans you already brew',
        pros: ['Fresher, more even grounds'],
        cons: ['Does not brew on its own', 'Larger hopper takes counter space'],
      },
    ],
    price_delta: {
      amount: Math.round((high - low) * 100) / 100,
      low_product_id: p.grinder.product_id,
      low_price: low,
      high_product_id: p.machine.product_id,
      high_price: high,
    },
  };
}

export function planPayload(locale: ShowcaseLocale): PlanPayload {
  const p = products(locale);
  return {
    title: 'Set up a home espresso corner',
    intro: 'Three steps, cheapest sensible option for each.',
    steps: [
      { label: 'Pick a machine', detail: 'One machine covers espresso and steamed milk.', products: [p.machine] },
      { label: 'Add a grinder', products: [p.grinder] },
      { label: 'Choose beans', detail: 'Two blends that suit espresso.', products: [p.espresso, p.filter] },
      { label: 'Pick a descaler', products: [] },
    ],
  };
}

export function guidePayload(locale: ShowcaseLocale): GuidePayload {
  const p = products(locale);
  return {
    title: 'Dialling in an espresso shot',
    sections: [
      {
        heading: 'Start with the dose',
        body: 'Weigh 18 g of coffee into the basket and level it. Consistency matters more than the exact number.',
      },
      {
        heading: 'Aim for 25 to 30 seconds',
        body: 'If the shot runs faster, grind finer. If it crawls, grind coarser. Change one thing at a time.',
      },
      { heading: 'Taste, then adjust', body: 'Sour means under-extracted; bitter and dry means over-extracted.' },
    ],
    related_products: [p.espresso, p.grinder],
    sources: ['Malva brew guide'],
  };
}

const orderBase = (locale: ShowcaseLocale): Pick<CardOrder, 'items' | 'total' | 'currency'> => {
  const p = products(locale);
  const items = [
    { product_id: p.espresso.product_id, title: p.espresso.title, quantity: 2, price: p.espresso.price },
    { product_id: p.filter.product_id, title: p.filter.title, quantity: 1, price: p.filter.price },
  ];
  const total = Math.round(items.reduce((sum, i) => sum + i.price * i.quantity, 0) * 100) / 100;
  return { items, total, currency: CURRENCY[locale] };
};

export function orderStatusPayload(locale: ShowcaseLocale, status: CardOrder['status'] = 'shipped'): OrderStatusPayload {
  return {
    order_id: 'MC-10482',
    summary: status === 'delayed' ? 'Your order is running late at the carrier.' : 'Your order left our roastery and is on its way.',
    next_step: 'Nothing to do on your side.',
    order: {
      order_id: 'MC-10482',
      ...(status ? { status } : {}),
      placed_at: '2026-10-28T09:12:00Z',
      ...orderBase(locale),
      estimated_delivery: '2026-11-06',
      tracking_url: 'https://tracking.example.com/MC-10482',
      view_url: '/account/orders/MC-10482',
    },
  };
}

/** Totals are the platform's cent-exact figures (minor units) as the server sends them; the card never computes them. */
export function checkoutPayload(locale: ShowcaseLocale, { discount }: { discount: boolean } = { discount: true }): CheckoutPayload {
  const p = products(locale);
  const currency = CURRENCY[locale];
  const lines = [
    { product_id: p.espresso.product_id, title: p.espresso.title, price: p.espresso.price, quantity: 1 },
    { product_id: p.grinder.product_id, title: p.grinder.title, price: p.grinder.price, quantity: 1 },
  ];
  const subtotalMinor = Math.round(lines.reduce((sum, l) => sum + l.price * l.quantity, 0) * 100);
  const discountMinor = discount ? 500 : 0;
  return {
    note: 'Whole bean, delivered.',
    fulfillment_method: 'delivery',
    cart: { currency, item_count: 2, subtotal: subtotalMinor / 100 },
    totals: {
      currency,
      subtotal_minor: subtotalMinor,
      ...(discount ? { discount_minor: discountMinor } : {}),
      total_minor: subtotalMinor - discountMinor,
    },
    lines,
  };
}

/** The shipped fixture per component and locale (the checkout one has a discount). */
export function fixtureFor(component: ShowcaseComponent, locale: ShowcaseLocale): unknown {
  switch (component) {
    case 'products':
      return productsPayload(locale);
    case 'comparison':
      return comparisonPayload(locale);
    case 'plan':
      return planPayload(locale);
    case 'guide':
      return guidePayload(locale);
    case 'order_status':
      return orderStatusPayload(locale);
    case 'checkout':
      return checkoutPayload(locale);
  }
}

export { products as productFixtures };
