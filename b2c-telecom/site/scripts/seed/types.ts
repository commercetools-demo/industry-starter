import type { CtApi } from './lib';

export type Kind =
  | 'type'
  | 'productType'
  | 'taxCategory'
  | 'zoneCoverage'
  | 'customerGroup'
  | 'recurrencePolicy'
  | 'category'
  | 'shippingMethod'
  | 'cartDiscount'
  | 'discountCode'
  | 'product'
  | 'inventory'
  | 'customObject'
  | 'demoCustomer'
  | 'demoOrder';

/** REST collection per kind (path relative to the project). */
export const COLLECTION: Record<Kind, string> = {
  type: 'types',
  productType: 'product-types',
  taxCategory: 'tax-categories',
  zoneCoverage: 'zones',
  customerGroup: 'customer-groups',
  recurrencePolicy: 'recurrence-policies',
  category: 'categories',
  shippingMethod: 'shipping-methods',
  cartDiscount: 'cart-discounts',
  discountCode: 'discount-codes',
  product: 'products',
  inventory: 'inventory',
  customObject: 'custom-objects',
  demoCustomer: 'customers',
  demoOrder: 'orders',
};

export interface Draft {
  key: string;
}

export interface Ref {
  kind: Kind;
  key: string;
  from: { kind: Kind; key: string };
}

export type Change = { path: string; from: unknown; to: unknown };

export type Outcome =
  | { status: 'created' | 'unchanged' }
  | { status: 'updated'; changes: Change[] }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; error: string };

export type SeedManifest = { [K in Kind]?: Draft[] };

export interface Ctx {
  /** Country code -> key of the adopted zone, filled by the zoneCoverage reconciler. */
  zoneKeys: Record<string, string>;
}

export interface Reconciler<D extends Draft = Draft, R = unknown> {
  kind: Kind;
  order: number;
  refs(draft: D): Ref[];
  fetch(api: CtApi, key: string): Promise<R | null>;
  create(api: CtApi, draft: D, ctx: Ctx): Promise<void>;
  diff(existing: R, draft: D): { changes: Change[]; conflict?: string };
  update(api: CtApi, existing: R, changes: Change[], draft: D, ctx: Ctx): Promise<void>;
  remove(api: CtApi, existing: R, ctx: Ctx): Promise<void>;
}

/** Registry-friendly view of a typed reconciler (drafts are validated by the manifest owner). */
export type AnyReconciler = Reconciler<Draft, unknown>;

export function asReconciler<D extends Draft, R>(r: Reconciler<D, R>): AnyReconciler {
  return r as unknown as AnyReconciler;
}

export type PlanItem = {
  kind: Kind;
  key: string;
  action: 'create' | 'update' | 'unchanged' | 'skip';
  changes: Change[];
  reason?: string;
};
export type Plan = PlanItem[];

// ---------------------------------------------------------------------------------------------------------------
// Draft shapes (manifests are typed TypeScript modules)

export type LocalizedString = Record<string, string>;
export type Money = { currencyCode: string; centAmount: number };
export type KeyRef = { typeId: string; key: string };

export type AttributeType =
  | { name: 'text' | 'ltext' | 'boolean' | 'number' | 'money' | 'date' | 'time' | 'datetime' }
  | { name: 'enum'; values: { key: string; label: string }[] }
  | { name: 'lenum'; values: { key: string; label: LocalizedString }[] }
  | { name: 'reference'; referenceTypeId: string }
  | { name: 'set'; elementType: AttributeType }
  | { name: 'nested'; typeReference: KeyRef };

export interface AttributeDefinitionDraft {
  name: string;
  label: LocalizedString;
  type: AttributeType;
  isRequired: boolean;
  attributeConstraint?: 'None' | 'Unique' | 'CombinationUnique' | 'SameForAll';
  inputHint?: 'SingleLine' | 'MultiLine';
  isSearchable?: boolean;
  level?: 'Variant' | 'Product';
  savedToLineItem?: boolean;
  inputTip?: LocalizedString;
}

export interface ProductTypeDraft extends Draft {
  name: string;
  description: string;
  attributes: AttributeDefinitionDraft[];
}

export interface FieldDefinitionDraft {
  name: string;
  label: LocalizedString;
  required: boolean;
  type: AttributeType | { name: 'Boolean' | 'String' | 'LocalizedString' | 'Number' | 'DateTime' | 'Date' | 'Time' | 'Money' };
  inputHint?: 'SingleLine' | 'MultiLine';
}

export interface TypeDraft extends Draft {
  name: LocalizedString;
  description?: LocalizedString;
  resourceTypeIds: string[];
  fieldDefinitions: FieldDefinitionDraft[];
}

export interface TaxRateDraft {
  key: string;
  name: string;
  amount: number;
  includedInPrice: boolean;
  country: string;
}
export interface TaxCategoryDraft extends Draft {
  name: string;
  description?: string;
  rates: TaxRateDraft[];
}

/** key is the country code; the reconciler adopts the zone that holds it. */
export interface ZoneCoverageDraft extends Draft {
  country: string;
}

export interface CustomerGroupDraft extends Draft {
  groupName: string;
}

export interface RecurrencePolicyDraft extends Draft {
  name: LocalizedString;
  description?: LocalizedString;
  schedule: { type: 'standard'; value: number; intervalUnit: 'Days' | 'Weeks' | 'Months' };
}

export interface CategoryDraft extends Draft {
  name: LocalizedString;
  slug: LocalizedString;
  description?: LocalizedString;
  orderHint?: string;
  parent?: string; // category key
}

export interface ShippingRateDraft {
  price: Money;
  freeAbove?: Money;
}
export interface ShippingMethodDraft extends Draft {
  name: string;
  localizedName: LocalizedString;
  localizedDescription: LocalizedString;
  taxCategory: KeyRef;
  active: boolean;
  isDefault: boolean;
  predicate?: string;
  /** zone is the country code of the manifest; the reconciler maps it to the adopted zone. */
  zoneRates: { zone: string; shippingRates: ShippingRateDraft[] }[];
}

export interface CartDiscountDraft extends Draft {
  name: LocalizedString;
  description?: LocalizedString;
  value: Record<string, unknown>;
  cartPredicate: string;
  target?: Record<string, unknown>;
  sortOrder: string;
  stackingMode?: 'Stacking' | 'StopAfterThisDiscount';
  isActive: boolean;
  requiresDiscountCode: boolean;
  validFrom?: string;
  validUntil?: string;
  recurringOrderScope?: Record<string, unknown>;
}

export interface DiscountCodeDraft extends Draft {
  name?: LocalizedString;
  description?: LocalizedString;
  code: string;
  cartDiscounts: string[]; // keys
  cartPredicate?: string;
  isActive: boolean;
  maxApplications?: number;
  maxApplicationsPerCustomer?: number;
  validFrom?: string;
  validUntil?: string;
}

export interface PriceDraft {
  key: string;
  value: Money;
  country?: string;
  customerGroup?: string; // key
  validFrom?: string;
  validUntil?: string;
}

export interface VariantDraft {
  sku: string;
  key?: string;
  attributes: { name: string; value: unknown }[];
  prices: PriceDraft[];
  images?: { url: string; label?: string; dimensions: { w: number; h: number } }[];
}

export interface ProductDraft extends Draft {
  productType: string; // key
  name: LocalizedString;
  slug: LocalizedString;
  description?: LocalizedString;
  categories: string[]; // keys
  categoryOrderHints?: Record<string, string>; // category key -> hint
  taxCategory: string; // key
  masterVariant: VariantDraft;
  variants: VariantDraft[];
  publish: boolean;
}

export interface InventoryDraft extends Draft {
  sku: string;
  quantityOnStock: number;
  restockableInDays?: number;
}

export interface CheckCtx {
  projectKey: string;
}
