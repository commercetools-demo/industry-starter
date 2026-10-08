/**
 * App types: the only shapes components, hooks and context may import.
 * Skeleton only; each workstream adds its own types here. SDK types are never re-exported:
 * lib/mappers/ converts them before they leave lib/ct/.
 */

/** commercetools localized string: locale key -> text. Render with getLocalizedString(field, locale). */
export type LocalizedString = Record<string, string>;

/** Money as the platform sends it. Render with formatMoney(centAmount, currencyCode, locale). */
export interface Money {
  centAmount: number;
  currencyCode: string;
  fractionDigits: number;
}

/** Consultation mode; each maps to a price channel (`mlv-remote`, `mlv-office`). */
export type ConsultationMode = 'remote' | 'office';

/** Doctor as shown in lists and cards (resolved for one locale; fees from the channel prices). */
export interface DoctorCard {
  id: string;
  key: string;
  slug: string;
  name: string;
  specialty: string;
  specialtyKey: string;
  yearsExperience: number;
  clinicName: string;
  city: string;
  modes: ConsultationMode[];
  /** Fee per offered mode, from the price on the mode's channel; absent when the doctor does not offer it. */
  fees: Partial<Record<ConsultationMode, Money>>;
  /** Average review rating (1-5), null without reviews. */
  rating: number | null;
  reviewCount: number;
  /** Two letters for the avatar fallback. */
  initials: string;
  /** Pexels portrait (clean URL) or null: the avatar then shows the initials. */
  portraitUrl: string | null;
  /**
   * Set by the mappers: false when the doctor has no fee in the visitor's currency (not sold in this region, workstream W): show
   * "not available in this region" instead of a price and do not offer booking. Absent means sellable; lists exclude such doctors.
   */
  sellableInRegion?: boolean;
}

/** Full doctor profile. */
export interface Doctor extends DoctorCard {
  bio: string;
  languages: string[];
  education: string;
  timezone: string;
}

/** Medicine as shown in lists and detail pages (one variant, one price per pack). */
export interface Medication {
  id: string;
  key: string;
  slug: string;
  name: string;
  description: string;
  sku: string | null;
  strength: string;
  dosageForm: string;
  rxOnly: boolean;
  dispenseUnit: string;
  minRemainingShelfLifeDays: number | null;
  maxQtyPerOrder: number | null;
  hsaEligible: boolean;
  controlClass: string | null;
  price: Money | null;
  /** Set by the mappers: false when there is no price in the visitor's currency (not sold in this region): not purchasable, never a broken price. Absent means sellable. */
  sellableInRegion?: boolean;
  imageUrl: string | null;
  categoryIds: string[];
}

/** Minimal cart for first paint (header count); the cart workstream extends it. */
export interface CartSummary {
  id: string;
  version: number;
  /** Total quantity across lines. */
  itemCount: number;
  /** Number of cart lines; the header count bubble shows this (Q-020). */
  lineCount: number;
  currencyCode: string;
}

/** Signed-in user as the client sees it. The session cookie has ids only; names come from getCustomerById. */
export interface AccountUser {
  id: string;
  firstName?: string;
  lastName?: string;
  /** The patient's own email; present once `GET /api/auth/me` has answered. */
  email?: string;
}

/** Product fields every catalog page needs (title, description, imagery). */
export interface ProductBasics {
  id: string;
  key: string;
  productTypeId: string;
  name: LocalizedString;
  slug: LocalizedString;
  description: LocalizedString;
  sku: string | null;
  imageUrls: string[];
  categoryIds: string[];
}

/** A catalog category with its children nested (public, identical for every visitor). */
export interface Category {
  id: string;
  key: string;
  name: LocalizedString;
  slug: LocalizedString;
  parentId: string | null;
  orderHint: string;
  children: Category[];
}

/** One shipping rate of a method, per zone (public data). */
export interface ShippingRateInfo {
  zoneId: string;
  price: Money;
  freeAbove: Money | null;
}

/** An active shipping method as shown before a cart exists. */
export interface ShippingMethodInfo {
  id: string;
  key: string;
  name: string;
  description: LocalizedString;
  isDefault: boolean;
  rates: ShippingRateInfo[];
}

/** Body of every non-2xx BFF response (see lib/api.ts). */
export interface ApiErrorBody {
  error: string;
}

/** Next free slot of a doctor in the current mode (workstream K): drives the card badge and the "Available today" filter. */
export interface DoctorAvailability {
  /** UTC instant of the slot. */
  startsAt: string;
  /** Clinic-local date (`YYYY-MM-DD`). */
  localDate: string;
  /** True when `localDate` is today in the clinic time zone. */
  isToday: boolean;
}

/** A doctor card plus the availability for the listing mode (null: no slot in the next 7 days). */
export interface DoctorListItem extends DoctorCard {
  next: DoctorAvailability | null;
}

/** One saved delivery address of the signed-in patient (a commercetools Customer address; country is always US). */
export interface Address {
  id: string;
  firstName: string;
  lastName: string;
  street: string;
  /** Apartment, suite, unit; empty when absent. */
  street2: string;
  city: string;
  /** US state or DC, two letters. */
  state: string;
  zip: string;
  /** E.164, `+1XXXXXXXXXX`. */
  phone: string;
  country: 'US';
  /** At most one address is the default shipping address. */
  isDefault: boolean;
}

/** The editable part of an address, as the form submits it and the validators return it. */
export type AddressInput = Omit<Address, 'id' | 'isDefault' | 'country'>;

/** A verified patient's review as shown on a doctor profile (workstream L). */
export interface DoctorReview {
  id: string;
  rating: number;
  title?: string;
  text?: string;
  /** ISO timestamp; shown as "Verified patient · Mon YYYY". */
  createdAt: string;
}

/** Doctor profile page data: the full doctor plus the verified reviews (empty when none). */
export interface DoctorProfile extends Doctor {
  reviews: DoctorReview[];
}

/** One free time of a day, as the booking panel needs it. */
export interface BookingSlot {
  /** UTC instant; this is what the booking request sends back. */
  startsAt: string;
  /** Clinic-local `HH:mm`. */
  time: string;
}

/** A day of the 7-day picker (clinic-local date), with its free times (possibly none). */
export interface SlotDay {
  /** `YYYY-MM-DD` in the clinic zone. */
  date: string;
  slots: BookingSlot[];
}

/** Body of `GET /api/doctors/:key/slots`. */
export interface SlotsResponse {
  mode: ConsultationMode;
  /** IANA zone of the clinic (named to the visitor for remote sessions). */
  timezone: string;
  days: SlotDay[];
}

/** Body of a successful `POST /api/bookings`. */
export interface BookingCreated {
  reference: string;
}

/** What `/booked/<ref>` shows. Contains the booker's name only for the greeting; no reason text, phone or email. */
export interface BookingView {
  reference: string;
  firstName: string;
  doctorName: string;
  specialty: string;
  clinicName: string;
  mode: ConsultationMode;
  startsAt: string;
  timezone: string;
  fee: Money | null;
  guest: boolean;
}

// ---- prescriptions (workstream N) -------------------------------------------------------------

/** `ok` can be selected; `short-dated` can be selected on its own terms; the rest are the refusal reasons shown on the row. */
export type RxLineStatus = 'ok' | 'short-dated' | 'NO_REFILLS' | 'EXPIRED' | 'OUT_OF_STOCK' | 'CEILING' | 'SHELF_LIFE' | 'CREDENTIAL';

/** Why a credential does not permit a controlled purchase (workstream U). */
export type CredentialProblem = 'NONE' | 'WRONG_SCOPE' | 'EXPIRED' | 'PENDING';

/** One medication row of a prescription card; shown to the owner of the prescription only. */
export interface RxLineView {
  lineRef: string;
  name: string;
  sig: string;
  qty: number;
  /** Catalog pack price (the short-dated price for a short-dated row); null when the catalog has none. */
  price: Money | null;
  status: RxLineStatus;
  selectable: boolean;
  /** "N available" under the rule that refused (units for refills, packs for stock and ceilings). */
  remaining?: number;
  ceiling?: number;
  /** `order` per-order limit, `period` calendar-month ceiling. */
  scope?: 'order' | 'period';
  /** Actual expiry of the stock (short-dated and shelf-life rows). */
  expiryDate?: string;
  /** "Minimum N months of shelf life on delivery"; null for undated goods or no promise. */
  minShelfLifeMonths: number | null;
  /** Controlled class of the product, when it has one (workstream U); the row is shown but unavailable without a valid credential. */
  controlClass?: string;
  /** `CREDENTIAL` only. */
  credential?: CredentialProblem;
}

export interface RxView {
  number: string;
  prescriber: string;
  /** ISO date. */
  issuedAt: string;
  refillsLeft: number;
  patientName: string;
  lines: RxLineView[];
}

/** The signed-in patient's own prescriptions for quick-picks (numbers and dates only; no medication data). */
export interface RxQuickPick {
  number: string;
  issuedAt: string;
}

// ---- cart (workstream O) ----------------------------------------------------------------------

/** Why a cart line can no longer be dispensed; the N rule reasons, plus `UNAVAILABLE` (prescription no longer found). */
export type CartLineIssue = 'NO_REFILLS' | 'EXPIRED' | 'OUT_OF_STOCK' | 'CEILING' | 'SHELF_LIFE' | 'UNAVAILABLE' | 'CREDENTIAL';

export interface CartLineProblem {
  reason: CartLineIssue;
  /** Same extras as the prescription row. */
  remaining?: number;
  ceiling?: number;
  scope?: 'order' | 'period';
  expiryDate?: string;
  /** `CREDENTIAL` only: why the credential does not hold (workstream U), and the control class it must cover. */
  credential?: CredentialProblem;
  credentialClass?: string;
}

/** One medication line. Quantity is the prescribed quantity and is never editable. */
export interface CartLine {
  id: string;
  sku: string;
  name: LocalizedString;
  rxNumber: string;
  rxLineRef: string;
  /** Prescribed quantity shown as "Qty N" (the platform quantity counts packs). */
  prescribedQty: number;
  unitPrice: Money;
  /** Platform line total. */
  totalPrice: Money;
  /** The unit price differs from the one seen on the previous read. */
  priceUpdated: boolean;
  /** Set by re-validation on load; the line stays in the cart until the patient removes it. */
  unavailable?: CartLineProblem;
  /** Payer cost-share (workstream U); absent when the patient has no funding scheme. */
  cover?: LineCover;
  /** What the plan covers for this line (line total); present when `cover` is covered/partly/not-covered. */
  coveredAmount?: Money;
  /** What the patient owes for this line (the platform line total at the external price). */
  youOwe?: Money;
  /** The patient can only buy this against a restricted instrument (eligible item); copied to the line when added. */
  eligibleForRestricted?: boolean;
}

/** `unresolved` = the cover could not be determined (different from `not-covered`: no figure is shown). */
export type LineCover = 'covered' | 'partly' | 'not-covered' | 'unresolved';

export interface CartShipping {
  name: string;
  /** Platform shipping price (after discounts); zero is shown as FREE. */
  price: Money;
}

/** The whole cart as the page needs it. Every amount comes from the platform response. */
export interface Cart extends CartSummary {
  lines: CartLine[];
  /** Sum of the platform line totals (integer cents) in the server mapper; null for an empty cart. */
  subtotal: Money | null;
  /** null until a shipping method is set (never the case for carts we create). */
  shipping: CartShipping | null;
  /** `cart.totalPrice`. */
  total: Money;
  /** Number of lines that failed re-validation; Checkout is disabled while above zero. */
  unavailableCount: number;
  /** Payer cost-share (workstream U): the amount the patient owes (the platform total) and what the plan covers. */
  youOwe?: Money;
  planCovers?: Money;
  /** The resolver could not answer: no cover figures are shown and Checkout is disabled. */
  unresolved?: boolean;
  /** Allowance, restricted instrument and card split for this cart (workstream U); filled by the server reads that know the patient. */
  tender?: TenderView;
}

/** How the amount owed would be paid, in tender order: allowance, restricted instrument, card. */
export interface TenderView {
  allowance: { balance: Money; applies: Money; forfeitsOn: string } | null;
  restricted: { available: boolean; reason?: 'none-eligible'; eligibleSubtotal: Money; applies: Money; chosen: boolean };
  /** What is left for the card; zero means no card payment is taken. */
  card: Money;
  /** The part of the total no restricted instrument can pay (ineligible lines and delivery). */
  needsOtherTender: Money;
}

export const isFullCart = (cart: CartSummary | Cart | null | undefined): cart is Cart => Boolean(cart && 'lines' in cart);

/** One entry of the region switcher (workstream W): a locale the project can sell in, with its display label. */
export interface RegionOption {
  locale: string;
  label: string;
}

// ---------------------------------------------------------------- checkout (workstream Q)

/** A delivery method the platform says fits the cart (matching-cart), with the price of the rate that matches. */
export interface DeliveryOption {
  key: string;
  /** Platform method name; the card shows its own localized label per known key. */
  name: string;
  price: Money;
}

/** The cart as checkout shows it: every amount is the platform's, taken from the last cart read. */
export interface CheckoutCart extends Cart {
  /** Address set on the cart; null until one is saved. */
  shippingAddress: AddressInput | null;
  /** Key of the selected delivery method; null until one is set. */
  shippingMethodKey: string | null;
  /** `taxedPrice.totalTax`; null while the platform has not calculated tax. */
  tax: Money | null;
}

/** Which payment path the page uses. `demo` is the dev-only fake provider (never in production). */
export type PaymentMode = 'psp' | 'demo';

/** Everything the checkout page renders, read from the server. */
export interface CheckoutState {
  cart: CheckoutCart;
  options: DeliveryOption[];
  /** False when the platform has no delivery method for the cart's address. */
  deliverable: boolean;
  paymentMode: PaymentMode;
}

/** The Checkout session the browser SDK needs. */
export interface PaymentSessionInfo {
  sessionId: string;
  projectKey: string;
  region: string;
}

export type PlaceOrderFailure =
  | 'EMPTY_CART'
  | 'ADDRESS_MISSING'
  | 'NO_DELIVERY_METHOD'
  | 'LINES_UNAVAILABLE'
  | 'TOTALS_MOVED'
  | 'PAYMENT_REQUIRED'
  | 'PAYMENT_DECLINED'
  | 'DISPENSE_REFUSED'
  | 'COVER_UNRESOLVED'
  | 'FUNDING_CHANGED'
  | 'PLACEMENT_FAILED'
  | 'IN_PROGRESS';

export interface PlacedOrder {
  orderId: string;
  orderNumber: string;
}
