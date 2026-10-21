import type { ErrorCode } from '@/lib/errors';

export type LocaleKey = 'en-US' | 'en-CA';

export interface Money { centAmount: number; currencyCode: string }
/** discounted = the price to pay when present; discountName only when the discount was expanded. */
export interface Price { value: Money; discounted?: Money; discountName?: string }
export interface ImageRef { url: string; width?: number; height?: number; alt?: string }

export type AttributeValue =
  | string | number | boolean
  | { key: string; label: string }
  | Array<string | number | boolean | { key: string; label: string }>;

export interface Variant {
  id: number; sku: string;
  images: ImageRef[];
  price?: Price;
  attributes: Record<string, AttributeValue>;
  availability?: { isOnStock: boolean; availableQuantity?: number };
}

export interface RatingStats {
  average: number;
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface Product {
  id: string; key?: string; slug: string; name: string; description?: string;
  productTypeKey?: string;
  categoryIds: string[];
  masterVariant: Variant; variants: Variant[];
  attributes: Record<string, AttributeValue>;
  rating?: RatingStats;
}

export interface Category {
  id: string; key?: string; name: string; slug: string; description?: string;
  imageUrl?: string; parentId?: string; orderHint?: string; children: Category[];
}

export type ApiErrorBody = { error: { code: ErrorCode; message: string } };
