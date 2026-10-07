// App-level domain types. No SDK imports: components import types from here only (workstream H creates this file;
// other workstreams append inside sections marked `// ===== <LETTER>: <topic> =====`).

// ===== H: catalog =====
export type Locale = 'en-US' | 'de-DE';
export type CurrencyCode = 'USD' | 'EUR';
export type CountryCode = 'US' | 'DE';
export interface Market {
  locale: Locale;
  currency: CurrencyCode;
  country: CountryCode;
}

/** commercetools `centAmount`; `formatMoney` is the only place that divides by 100. */
export interface Money {
  centAmount: number;
  currencyCode: string;
}

export type OfferKind = 'base-package' | 'addon' | 'equipment' | 'device' | 'bundle';
export type PlanFamily = 'internet' | 'phone';
/** `mobile` is derived for phone plans (the phone plan type has no technology attribute). */
export type Technology = 'cable' | 'fixed-wireless' | 'mobile';
export type TermKey = 'month-to-month' | '12-months' | '24-months';
/** 0 = month-to-month. */
export type TermMonths = 0 | 12 | 24;
export type AudienceKey = 'consumer' | 'small-business' | 'employee';
export type ExistingCustomerRule = 'any' | 'existing' | 'new';
export type EquipmentKind = 'router' | 'modem' | 'extender' | 'gateway';

export interface PlanFacts {
  kind: 'plan';
  family: PlanFamily;
  technology: Technology;
  downstreamMbps?: number;
  upstreamMbps?: number;
  typicalDownloadMbps?: number;
  typicalUploadMbps?: number;
  typicalLatencyMs?: number;
  /** -1 = unlimited (D-017). */
  dataGb?: number;
  hotspotGb?: number;
  linesIncluded?: number;
  networkGeneration?: '4g' | '5g';
  priceLockMonths?: number;
  /** Localized text. */
  earlyTerminationFee?: string;
  badge?: 'most-popular';
  /** RAW references (product keys such as "malva-appletv" or offer keys); J's refersTo() resolves them. */
  includedAddons: string[];
  /** RAW references, same rule. */
  conflictsWith: string[];
  requiredEquipmentKinds: EquipmentKind[];
  requiredAddonKinds: string[];
  /** Localized bullet strings. */
  highlights: string[];
}
export interface AddonFacts {
  kind: 'addon';
  addonKind: 'streaming' | 'security' | 'protection';
  provider?: string;
  appliesToFamilies: PlanFamily[];
  /** Empty = any. */
  appliesToTechnologies: Technology[];
  chargeType?: string;
  trialDays?: number;
  /** Key of attribute `addon-tag`: music, video or extras. */
  tag?: string;
  highlights: string[];
}
export interface EquipmentFacts {
  kind: 'equipment';
  equipmentKind: EquipmentKind;
  maxDownstreamMbps?: number;
  supportedTechnologies: Technology[];
  wifiStandard?: string;
  chargeType?: string;
  /** RAW references (offer or SKU keys). */
  incompatibleWith: string[];
}
export interface DeviceFacts {
  kind: 'device';
  brand?: string;
  os?: string;
  networkGeneration?: '4g' | '5g';
  compatiblePlanFamilies: PlanFamily[];
}
export type OfferFacts = PlanFacts | AddonFacts | EquipmentFacts | DeviceFacts;

export interface OfferVariant {
  id: number;
  sku: string;
  isMaster: boolean;
  /** null for add-ons/equipment without a term. */
  term: TermKey | null;
  termMonths: TermMonths | null;
  /** Price carrying a recurrence policy (monthly). Not set on devices: their financed prices are `financedPrices`. */
  recurringPrice?: Money;
  /** Price with no recurrence policy (activation fee, equipment or handset purchase). */
  oneTimePrice?: Money;
  /** Devices only: every recurring (installment, lease) price of the market, lowest first. */
  financedPrices?: Money[];
  /** Only when the variant has an inventory entry (equipment, devices); undefined = not tracked (services, D-019). */
  availableQuantity?: number;
  images: string[];
  /** Variant-level attributes as plain values (devices: color, memory-gb). */
  attributes: Record<string, string | number | boolean | string[]>;
}
export interface Offer {
  id: string;
  key: string;
  kind: OfferKind;
  name: string;
  slug: string;
  description: string;
  categoryKeys: string[];
  /** FIRST category assigned in commercetools (plp-led-catalog-navigation). */
  primaryCategoryKey?: string;
  /** Product keys of the wrapped plan/add-on/equipment/device. */
  anchors: string[];
  /** Merged from the anchor product (null if the anchor is missing; the offer is then hidden by the catalog read). */
  facts: OfferFacts | null;
  /** RAW: offer.included-offers union plan.included-addons. */
  includedOffers: string[];
  /** RAW offer keys (exceptions/allow-list, see J). */
  compatibleAddons: string[];
  compatibleEquipment: string[];
  /** RAW: offer.conflicts-with union plan.conflicts-with. */
  conflictsWith: string[];
  /** Empty = everyone. */
  audience: AudienceKey[];
  existingCustomer: ExistingCustomerRule;
  /** Empty = every channel. */
  channels: string[];
  /** ISO. */
  startTime?: string;
  endTime?: string;
  /** variants[0] is ALWAYS the master variant (D-011). */
  variants: OfferVariant[];
  /** = master variant (D-011). */
  headline: { recurring?: Money; oneTime?: Money; term: TermKey | null; termMonths: TermMonths | null };
  image?: string;
}
export interface Category {
  id: string;
  key: string;
  name: string;
  slug: string;
  /** Every locale's slug (locale switch / canonical redirect). */
  slugs: Record<string, string>;
  parentId?: string;
  orderHint?: string;
  image?: string;
  children: Category[];
}
/** Minor units; min inclusive, max exclusive. */
export interface PriceBand {
  id: string;
  min?: number;
  max?: number;
}
export interface ListingQuery {
  chip?: string;
  sort?: 'price-asc' | 'price-desc' | 'name';
  band?: string;
  page?: number;
  pageSize?: number;
}
export interface ListingResult {
  offers: Offer[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  /** Counts over the whole category, not just the page. */
  chips: { id: string; count: number }[];
  bands: { id: string; count: number }[];
  /** Explicit empty reason; recovery links are the root categories. */
  empty?: 'no-offers' | 'no-match';
  /** Present with `empty`: the root categories to link to, so the page never shows a blank list. */
  recoveryLinks?: { key: string; name: string; slug: string }[];
}
export interface SearchResult {
  offers: Offer[];
  total: number;
  page: number;
  pageSize: number;
  categoryFacet: { key: string; count: number }[];
  bandFacet: { id: string; count: number }[];
}
export type SearchSort = 'relevance' | 'price-asc' | 'price-desc';

// ===== J: offer rules =====
export type ReasonCode =
  | 'SPEED_TOO_LOW'
  | 'TECHNOLOGY_MISMATCH'
  | 'FAMILY_MISMATCH'
  | 'ALREADY_INCLUDED'
  | 'DECLARED_INCOMPATIBLE'
  | 'EXCLUSIVE_CONFLICT'
  | 'CATALOG_DATA_INCOMPLETE'
  | 'OFFER_NOT_FOUND'
  | 'REQUIRED_EQUIPMENT_MISSING'
  | 'PARENT_REQUIRED'
  | 'AMBIGUOUS_PARENT'
  | 'ALREADY_ATTACHED'
  // used by workstream K (declared here once so nobody edits the union twice):
  | 'HELD_SERVICE_CONFLICT'
  | 'NOT_ELIGIBLE_AUDIENCE'
  | 'NOT_ELIGIBLE_EXISTING_CUSTOMER'
  | 'NOT_ELIGIBLE_CHANNEL'
  | 'NOT_STARTED'
  | 'ENDED'
  | 'NOT_SERVICEABLE';

export interface Reason {
  code: ReasonCode;
  /** Always `offers.reason.${code}`. */
  messageKey: string;
  /** ICU params: planName, candidateName, otherName, max, needed, kind. */
  params: Record<string, string | number>;
  /** The offers involved (plan first, then candidate / other). */
  offerKeys: string[];
}
export interface ReplaceTarget {
  lineItemId: string;
  offerKey: string;
  offerName: string;
}
export type VerdictStatus = 'allowed' | 'unavailable' | 'included';
export interface EquipmentSelection {
  kind: EquipmentKind;
  offerKey: string;
  variantSku: string;
  mode: 'rental' | 'purchase';
}
export interface CompatVerdict {
  status: VerdictStatus;
  /** Empty when allowed; the first element is the primary reason. */
  reasons: Reason[];
  /** The plan line the add-on/equipment attaches to (cart mode). */
  parentLineItemId?: string;
  /** Present with AMBIGUOUS_PARENT. */
  candidateParents?: string[];
  /** Present with EXCLUSIVE_CONFLICT: lines the buyer may replace (the buyer decides, never automatic). */
  replaces?: ReplaceTarget[];
  /** Present when the candidate is a plan. */
  requiredEquipment?: EquipmentSelection[];
}
export interface CartLineRef {
  lineItemId: string;
  offerKey: string;
  parentLineItemId?: string;
  quantity: number;
}
export type CartIssueResolution = 'remove' | 'replace' | 'choose-equipment';
export interface CartIssue {
  lineItemId: string;
  offerKey: string;
  blocking: true;
  resolution: CartIssueResolution;
  reasons: Reason[];
}
export interface CandidateEntry {
  offer: Offer;
  verdict: CompatVerdict;
}
