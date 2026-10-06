import type { Product, Variant } from '@/lib/types';

export function makeVariant(over: Partial<Variant> = {}): Variant {
  return {
    id: 1,
    sku: 'BANANAS-1KG',
    images: ['https://images.example.com/bananas.jpg'],
    price: { centAmount: 249, currencyCode: 'USD' },
    attributes: {},
    increment: { value: 1, unit: 'kg', label: '1 kg' },
    approximateWeight: false,
    availability: { isOnStock: true, availableQuantity: 100 },
    ...over,
  };
}

export function makeProduct(over: Partial<Product> = {}): Product {
  return {
    type: 'Product',
    id: 'p-1',
    name: 'Bananas',
    slug: 'bananas',
    description: '',
    brand: 'Finca Verde',
    dietary: [],
    allergens: [],
    recurringEligible: false,
    categoryIds: [],
    substituteProductIds: [],
    variants: [makeVariant()],
    ...over,
  };
}
