// DTOs of the catalog screens (what the seller routes return). No server imports: components import from here.
import type { AssortmentState } from './assortment-state';
import type { CartCondition, Effect, ProductScope } from './discount-rule';

export type LocalizedText = Record<string, string>;

export interface MoneyValue {
  centAmount: number;
  currencyCode: string;
}

export interface AssortmentRow {
  productId: string;
  productKey: string;
  sku: string;
  name: LocalizedText;
  /** Malva list price (or, for a store's own item, its retail price); null reads "Price pending", never 0. */
  listPrice: MoneyValue | null;
  state: AssortmentState;
  /** Where the reason comes from; the text of the reason is `reason` (may be empty for plain states). */
  reason: string;
  reasonBy?: string;
  categoryIds: string[];
}

export type AssortmentFilter = 'all' | 'assigned' | 'available' | 'blocked';

export interface AssortmentPage {
  rows: AssortmentRow[];
  /** Rows matching the filters. */
  total: number;
  /** Master products assigned to this store. */
  assigned: number;
  totalMaster: number;
  capped: boolean;
}

export interface ChainInfo {
  masterCount: number;
  approvedCount: number;
  resellerCount: number;
  branchCount: number;
}

export interface Impact {
  count: number;
  openCartCount: number;
  branches: number;
}

export interface CategoryOption {
  id: string;
  key: string;
  name: LocalizedText;
  parentId?: string;
}

export interface PriceRow {
  sku: string;
  productId: string;
  name: LocalizedText;
  listCent: number | null;
  overrideCent: number | null;
  /** Percent below the Malva list price, information only. */
  belowListPercent: number | null;
  /** The store's own item: no Malva list price exists, the retail price is its only price. */
  own: boolean;
}

export interface PricePage {
  rows: PriceRow[];
  total: number;
  currency: 'EUR' | 'USD';
  currencies: ('EUR' | 'USD')[];
}

export interface PriceChange {
  sku: string;
  /** null deletes the override (the Malva list price applies). */
  centAmount: number | null;
}

export interface BulkPreviewRow {
  sku: string;
  name: LocalizedText;
  listCent: number;
  newCent: number;
  belowListPercent: number;
  aboveListPercent: number;
  invalid: boolean;
}

export interface TailoringRow {
  productId: string;
  sku: string;
  name: LocalizedText;
  tailored: boolean;
  tailoredLocales: string[];
  hasTailoredImages: boolean;
}

export interface ImageRef {
  url: string;
  label?: string;
  width?: number;
  height?: number;
}

export interface TailoringDetail {
  productId: string;
  sku: string;
  languages: string[];
  master: { name: LocalizedText; description: LocalizedText; images: ImageRef[] };
  tailored: { name: LocalizedText; description: LocalizedText; images: ImageRef[] };
  tailoredLocales: string[];
}

export type DiscountKind = 'product' | 'cart';

export interface DiscountView {
  id: string;
  version: number;
  key: string;
  kind: DiscountKind;
  name: LocalizedText;
  scope: ProductScope | CartCondition | { kind: 'custom'; text: string };
  effect: Effect | { kind: 'custom'; text: string };
  stacking?: 'Stacking' | 'StopAfterThisDiscount';
  validFrom?: string;
  validUntil?: string;
  isActive: boolean;
  sortOrder: string;
  funded: 'malva' | 'store';
  /** 1 = applied first among the store's own discounts of the kind; null for Malva-funded (locked). */
  rank: number | null;
  draft: boolean;
  code?: string;
}
