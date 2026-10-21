export interface Price {
  centAmount: number;
  currencyCode: string;
  discounted?: { centAmount: number; currencyCode: string };
}

export interface Variant {
  id: number;
  sku: string;
  images: string[];
  price?: Price;
  prices: Price[];
  attributes: Array<{ name: string; value: unknown }>;
  availability?: { isOnStock?: boolean };
}

export interface Product {
  type: 'Product';
  id: string;
  name: string;
  slug: string;
  description?: string;
  categories: Array<{ id: string }>;
  variants: Variant[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parent?: { id: string };
  children?: Category[];
}
