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

// ===== K: eligibility and exclusivity =====
export type CustomerType = 'consumer' | 'small-business' | 'employee';
export interface ServiceLocation {
  postalCode: string;
  country: CountryCode;
  /** cable, fixed-wireless, mobile */
  served: Record<Technology, boolean>;
  anyServed: boolean;
  /** ISO time of the (cached) answer. */
  checkedAt: string;
}
export interface HeldService {
  offerKey: string;
  offerName: string;
  source: 'order' | 'recurring-order';
  /** Order number or recurring order id. */
  reference: string;
}
/** Server-side only (contains a Date), never serialized to the client. */
export interface BuyerContext {
  customerType: CustomerType;
  isExistingCustomer: boolean;
  channel: string;
  now: Date;
  location?: ServiceLocation;
  held: HeldService[];
  signedIn: boolean;
}
export interface ConflictFinding {
  source: 'cart' | 'held';
  candidateKey: string;
  otherKey: string;
  otherName: string;
  lineItemId?: string;
  reference?: string;
  declaredBy: 'candidate' | 'other' | 'both';
}
export type AvailabilityState = 'no-location' | 'served' | 'partially-served' | 'not-served';
// ===== L: pricing =====
export type PriceSelectionMode = 'Fixed' | 'Dynamic';
export interface LineRecurrence {
  policyKey: 'malva-monthly';
  priceSelectionMode: PriceSelectionMode;
}

export type PeriodKind = 'intro' | 'standing' | 'step';
export interface SchedulePeriod {
  /** 1-based. */
  index: number;
  /** Billing months, inclusive, counted from the order date. `toMonth` 0 = until cancelled. */
  fromMonth: number;
  toMonth: number;
  months: number;
  /** YYYY-MM-DD, inclusive both ends. */
  startsOn: string;
  endsOn: string;
  /** Per unit (per line of service). */
  monthlyAmount: Money;
  kind: PeriodKind;
}
export interface AfterTerm {
  startsOn: string;
  monthlyAmount: Money;
  basis: 'month-to-month-price';
}
export interface PriceSchedule {
  v: 1;
  offerKey: string;
  sku: string;
  termMonths: TermMonths;
  quantity: number;
  currencyCode: string;
  priceMode: PriceSelectionMode;
  /** YYYY-MM-DD (UTC): the intro and the term both start here (D-023). */
  orderDate: string;
  /** Month-to-month has ONE open-ended period (toMonth = 0 meaning "until cancelled"). */
  periods: SchedulePeriod[];
  /** true for month-to-month. */
  openEnded: boolean;
  /** Sum over the term x quantity; null when openEnded. */
  totalContractValue: Money | null;
  /** First period amount x quantity + one-time fees of this line (activation fee). */
  dueAtOrder: Money;
  /** null for month-to-month. */
  afterTerm: AfterTerm | null;
  introEndsOn: string | null;
  status: 'active' | 'cancelled' | 'amended';
  cancelledOn?: string;
  amendedOn?: string;
  /** The `amendedOn` of the previous version. */
  supersedes?: string;
}
export interface ScheduleError {
  code: 'PERIOD_NOT_PRICED' | 'NO_STANDING_PRICE' | 'INTRO_NOT_BELOW_STANDING' | 'BAD_DATE';
  detail?: string;
}
export type ScheduleResult = { ok: true; value: PriceSchedule } | { ok: false; error: ScheduleError };

export interface RecurringOrderSummary {
  id: string;
  key?: string;
  originOrderId: string;
  state: 'Active' | 'Paused' | 'Expired' | 'Canceled' | 'Failed';
  startsAt: string;
  nextOrderAt?: string;
  lastOrderAt?: string;
  expiresAt?: string;
  cadence: { unit: 'Days' | 'Weeks' | 'Months'; every: number } | { dayOfMonth: number };
  /** Total of the recurring cart (engine value). */
  monthly: Money;
  lines: { name: string; sku: string; quantity: number; priceSelectionMode: PriceSelectionMode | null }[];
  failureReason?: string;
}

// ===== M: cart (My bundle) =====
// Name notes: J's `CartIssue` (per line, with reasons) is kept as is; the cart API's issue shape is `BundleIssue`.
// M does not re-declare `OfferFacts`: the offer data the mappers need is `Offer` (H).
export type BundleLineKind = 'plan' | 'addon' | 'equipment' | 'device' | 'fee';
export interface CartLine {
  /** commercetools line item id, or custom line item id for fee lines. */
  id: string;
  source: 'line-item' | 'custom-line-item';
  /** Offer key; for a fee line the key of the plan it belongs to. */
  offerKey: string;
  /** null for fee lines. */
  sku: string | null;
  kind: BundleLineKind;
  name: string;
  family: PlanFamily | null;
  technology: Technology | null;
  imageUrl?: string;
  /** First 3 highlights of the offer (localized). */
  bullets: string[];
  /** Short description (add-on rows). */
  description: string;
  quantity: number;
  termMonths: TermMonths;
  chargeType: 'recurring' | 'one-time';
  /** null for one-time lines. */
  recurrence: LineRecurrence | null;
  /** Engine `price` (before discounts). */
  unitListPrice: Money;
  /** Engine line total / quantity (after discounts, before tax); display only, `total` is authoritative. */
  unitPrice: Money;
  /** Engine `totalPrice`. */
  total: Money;
  /** From `discountedPricePerQuantity[].discountedPrice.includedDiscounts[].discount.key`. */
  appliedDiscountKeys: string[];
  /** Custom field `parentLineItemId` (D-026). */
  parentLineId: string | null;
  /** Included by the plan (J) and priced 0. */
  includedAtNoCharge: boolean;
  /** Equipment line that is a default for a kind the parent plan requires (D-025). */
  requiredEquipment: boolean;
  /** Plans only: computed by L's `buildSchedule` (provisional order date = today). */
  schedule: PriceSchedule | null;
  /** Plans only. */
  label: BroadbandLabelData | null;
  /** Equipment and devices only. */
  stock: { available: number | null; inStock: boolean } | null;
}
export type DiscountCodeReason = 'unknown-code' | 'not-active' | 'not-valid' | 'not-applicable' | 'max-reached' | 'stopped';
export interface CartDiscountCodeInfo {
  code: string;
  state: 'applied' | 'not-applicable' | 'not-active' | 'not-valid' | 'max-reached' | 'stopped';
  reason: DiscountCodeReason | null;
}
export interface BundleIssueReason {
  code: string;
  messageKey: string;
  params: Record<string, string | number>;
  offerKeys: string[];
}
/** What is wrong with a line of the bundle: a rule that changed after the add (J/K revalidation) or a data gap. */
export interface BundleIssue {
  code: string;
  severity: 'blocking';
  lineId: string | null;
  offerKey: string | null;
  /** J/K resolution; `none` for data gaps. */
  resolution: CartIssueResolution | 'none';
  reasons: BundleIssueReason[];
}
export interface CartSummary {
  /** Recurring subtotals by kind (sum of engine line totals). */
  plans: Money;
  addons: Money;
  devicesMonthly: Money;
  /** Sum of engine line totals of recurring / one-time lines (one-time includes fee lines). */
  monthly: Money;
  oneTime: Money;
  /** Sum of the discounts the engine applied (positive amount). */
  discountTotal: Money;
  /** Engine taxedPrice portion (null until it exists) and engine totalPrice (due today). */
  tax: Money | null;
  total: Money;
}
export interface Cart {
  id: string;
  version: number;
  currencyCode: string;
  country: string;
  lines: CartLine[];
  /** Number of non-fee lines (distinct); header pill "My bundle · N". */
  itemCount: number;
  summary: CartSummary;
  discountCodes: CartDiscountCodeInfo[];
  /** null when the minimum is 0 for this currency. */
  minimumOrder: { required: Money; shortfall: Money | null } | null;
  issues: BundleIssue[];
  canCheckout: boolean;
  checkoutBlockedBy: ('EMPTY' | 'MINIMUM_ORDER' | 'ISSUES')[];
  /** Cart custom field (K serviceability). */
  postalCode: string | null;
}
export interface BlockedAdd {
  kind: 'incompatible' | 'conflict' | 'ineligible' | 'unavailable' | 'invalid' | 'limit';
  offerKey: string;
  reasons: BundleIssueReason[];
  /** Only for kind 'conflict' and for ONE_PLAN_PER_CATEGORY. */
  replace?: { removeLineId: string; removeOfferKey: string; removeOfferName: string };
}
export interface DiscountPrompt {
  pairingKey: string;
  discountKey: string;
  candidate: { offerKey: string; sku: string; name: string; quantity: number; termMonths: TermMonths };
  /** Per month, quoted from a priced prospective cart. */
  saving: Money;
  messageKey: string;
  params: Record<string, string | number>;
}
// Label data (broadband-facts-label contract; all strings already formatted).
export interface LabelRow {
  k: string;
  v: string;
}
export interface BroadbandLabelData {
  id: string;
  planName: string;
  kind: string;
  price: string;
  priceNote: string;
  monthlyFees: LabelRow[];
  oneTime: LabelRow[];
  etf: string;
  discounts: string;
  speeds: LabelRow[];
  data: string;
}
export interface LabelSnapshot {
  v: 1;
  takenAt: string;
  locale: string;
  currencyCode: string;
  labels: { sku: string; offerKey: string; label: BroadbandLabelData }[];
}

// ===== R: account user =====
export interface AccountUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  customerNumber?: string;
  isEmailVerified: boolean;
  createdAt: string;
}
/** Shown as a toast after a sign-in merged the anonymous bundle: `count` lines of the merged bundle need attention (`names` joined). */
export interface MergeNote {
  key: 'review';
  count: number;
  names: string;
}

// ===== S: orders and account =====
export type OrderStatus = 'placed' | 'processing' | 'shipped' | 'delivered' | 'completed' | 'cancelled' | 'unknown';
/** What an order line is, derived from the line alone (no catalog read). */
export type OrderLineKind = 'internet-plan' | 'phone-plan' | 'device' | 'equipment' | 'addon' | 'other';
/** The "Type" column of the contract table. */
export type OrderLineFamily = 'cable' | 'wireless' | 'phone' | 'addon' | 'equipment' | 'installments' | 'lease' | 'outright' | 'other';
export type AcquisitionMode = 'outright' | 'installments' | 'lease';
/** The device line's acquisition, read from the line's custom fields (never inferred from a price). */
export interface OrderLineAcquisition {
  mode: AcquisitionMode;
  termMonths: number | null;
  /** YYYY-MM-DD: the last installment date or the return-by date; the line's own field `acquisitionEndDate` when present, else computed. */
  endDate: string | null;
}
export type DeviceColor = 'black' | 'silver' | 'violet';
export interface OrderLine {
  id: string;
  sku: string;
  offerKey: string;
  name: string;
  imageUrl?: string;
  quantity: number;
  kind: OrderLineKind;
  family: OrderLineFamily;
  /** Handset lines: memory and colour parsed from the SKU (`MLV-DEV-NOVAPRO-BLK-256`). */
  deviceVariant: { memoryGb: string; color: DeviceColor } | null;
  recurring: boolean;
  priceMode: PriceSelectionMode | null;
  /** 0 = month-to-month, null = unknown. */
  termMonths: number | null;
  unitPrice: Money;
  total: Money;
  parentLineId: string | null;
  acquisition: OrderLineAcquisition | null;
}
export interface AddressView {
  id: string;
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefaultShipping: boolean;
}
export interface Order {
  id: string;
  orderNumber: string;
  /** ISO timestamp. */
  createdAt: string;
  status: OrderStatus;
  orderState: string;
  shipmentState: string | null;
  /** YYYY-MM-DD (UTC): the stored service start, else the order date. */
  serviceStartDate: string;
  lines: OrderLine[];
  /** `order.totalPrice`: due at order. */
  total: Money;
  /** Sum of the recurring lines at their standing price (the intro price is not the monthly price "after that"). */
  monthly: Money;
  shippingAddress: AddressView | null;
  /** Parsed `priceSchedule` (L); empty when absent or invalid. */
  schedules: PriceSchedule[];
  /** Parsed `labelSnapshot` (M), the labels as they were at order time; null when absent or invalid. */
  labels: LabelSnapshot['labels'] | null;
}
export interface OrderListItem {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: OrderStatus;
  /** Names of the first two lines; `more` = the rest. */
  itemNames: string[];
  more: number;
  /** Due at order. */
  total: Money;
  monthly: Money;
}
export interface ContractRow {
  key: string;
  orderNumber: string;
  sku: string;
  name: string;
  deviceVariant: OrderLine['deviceVariant'];
  family: OrderLineFamily;
  /** YYYY-MM-DD. */
  startedOn: string;
  /** 0 = month-to-month, null = unknown. */
  termMonths: number | null;
  /** YYYY-MM-DD, committed terms and device payments only. */
  endsOn: string | null;
  /** Current monthly amount of the row (quantity included). */
  monthly: Money;
}
export interface RecurringSummary {
  id: string;
  originOrderId: string;
  state: RecurringOrderSummary['state'];
  nextOrderAt?: string;
  expiresAt?: string;
}
export interface ActivePlan {
  key: string;
  orderNumber: string;
  sku: string;
  name: string;
  /** The stored label of the order; null for an order without a snapshot. */
  label: BroadbandLabelData | null;
}
export interface ReorderUnavailable {
  sku: string;
  name: string;
  reason: 'not-available' | 'recurrence-lost';
}
export interface ReorderResult {
  cart: Cart;
  unavailable: ReorderUnavailable[];
}
