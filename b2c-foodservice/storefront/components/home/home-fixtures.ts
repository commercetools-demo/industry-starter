import type { Category, ProductSummary, PromiseFigures, Store } from '@/lib/types';
import { CLOSED_ALL_WEEK } from '@/lib/hours';

// Test fixtures shared by the home component tests.

export const product = (over: Partial<ProductSummary> = {}): ProductSummary => ({
  id: 'p-1', slug: 'ember-ristretto', sku: 'MCF-POD-EMBER-10', name: 'Ember Ristretto', categoryName: 'Pods',
  imageAlt: 'Ember Ristretto', badge: 'bestseller',
  price: { from: { centAmount: 12345, currencyCode: 'USD' }, fromIsRange: false },
  requiredChoice: null, rating: null, availability: null,
  ...over,
});

export const FIGURES: PromiseFigures = {
  freeShippingThreshold: { centAmount: 8800, currencyCode: 'USD' },
  collectionMinutes: 17,
  returnDays: 21,
};

export const category = (key: string, slug: string, name: string, imageUrl?: string): Category => ({
  id: `id-${key}`, key, name, slug, children: [], ...(imageUrl ? { imageUrl } : {}),
});

export const TREE: Category[] = [
  category('mcf-cat-pods', 'pods', 'Pods', 'https://img.example.com/pods.jpg'),
  category('mcf-cat-coffee', 'coffee', 'Coffee'),
  category('mcf-cat-machines', 'machines', 'Machines'),
  category('mcf-cat-accessories', 'accessories', 'Accessories'),
  category('mcf-cat-gifts', 'gifts', 'Gifts'),
];

export const STORE: Store = {
  id: 'ch-brooklyn', key: 'mcf-store-nyc-brooklyn', name: 'Malva Brooklyn', addressLine: '1 Main St', city: 'New York',
  postalCode: '11201', country: 'US', hours: CLOSED_ALL_WEEK, timeZone: 'America/New_York', collectionMinutes: 23,
};
