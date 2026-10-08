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
