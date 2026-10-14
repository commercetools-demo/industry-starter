// App types of workstream W (marketing, e-mail, bundles, local products, import, brand partnership). Pure: the screens and
// `hooks/marketingApi.ts` import these, never lib/ct; the server modules in lib/ct/seller produce them.
import type { EmailTemplate, TemplateKey, Locale } from '@/lib/email/defaults';
import type { Rule } from '@/lib/marketing/audience';
import type { ValidationResult } from '@/lib/import/validate';

type Localized = Record<'de-DE' | 'en-US', string>;

// ---- Marketing ----
export interface Campaign {
  key: string;
  name: Localized;
  /** Share of the advertising spend Malva funds, 0 to 1. */
  fundingShare: number;
  caption: Localized;
  code: string;
  channels: string[];
  startsAt: string;
  endsAt: string;
  eligibleSkus: string[];
  /** The discount in permyriad (800 = 8 %), fixed by the campaign object, never by the client. */
  permyriad: number;
  demo?: boolean;
}

export type ClaimStatus = 'none' | 'submitted' | 'approved' | 'rejected';

export interface ClaimInput {
  amountCents: number;
  invoiceReference: string;
  note: string;
}

export interface CampaignView extends Campaign {
  ended: boolean;
  /** First five eligible products and how many more there are. */
  eligible: { sku: string; name: Localized | Record<string, string> }[];
  eligibleMore: number;
  claim: { status: ClaimStatus; amountCents?: number; invoiceReference?: string };
  /** The store's own draft or live discount for the campaign. */
  discount: { id: string; key: string; isActive: boolean; code: string } | null;
}

// ---- E-mail (stored, never sent) ----
export type EventState = 'stored-not-sent' | 'not-set-up';
export interface TemplateView extends EmailTemplate {
  key: TemplateKey;
  /** False when the store never saved the template: the default text is shown. */
  stored: boolean;
}
export interface EventView {
  id: 'order-placed' | 'order-shipped' | 'order-delivered';
  template: TemplateKey | null;
  state: EventState;
}
export interface Preview {
  subject: Record<Locale, string>;
  html: Record<Locale, string>;
}
export interface Brand {
  /** `#rrggbb`, always sanitised. */
  primary: string;
  logoUrl: string | null;
  storeName: string;
}
export type CampaignStatus = 'Draft' | 'Ready';
export interface EmailCampaignView {
  id: string;
  name: string;
  templateKey: TemplateKey;
  rule: Rule;
  status: CampaignStatus;
  recipientCount: number | null;
  openRate: null;
  createdAt: string;
  /** The rule in words. */
  ruleText: string;
}
export interface Suggestion {
  rule: Rule;
  text: string;
  /** Customers the rule would reach: matching AND consented. */
  count: number;
}
export type SuggestResult = ({ ok: true } & Suggestion) | { ok: false; hint: string; categories: string[] };

// ---- Bundles ----
export interface BundleComponentView {
  sku: string;
  name: Record<string, string>;
  qty: number;
  retailCents: number | null;
  assigned: boolean;
}
export interface BundleView {
  key: string;
  productId: string;
  sku: string;
  name: Record<string, string>;
  discountPercent: number;
  components: BundleComponentView[];
  componentsCents: number;
  bundleCents: number | null;
  savingCents: number | null;
  status: 'Live' | 'Draft';
  /** The first component that is not assigned: the bundle is hidden in the storefront while this is set. */
  unavailableSku: string | null;
}
export interface BundleInput {
  name: string;
  discountPercent: number;
  components: { sku: string; qty: number }[];
}
export interface ComponentOption {
  sku: string;
  name: Record<string, string>;
  retailCents: number;
}

// ---- Local products and import ----
export interface VehicleOption {
  fitmentKey: string;
  label: string;
}
export interface LocalProductResult {
  key: string;
  sku: string;
  productId: string;
  status: 'live' | 'pending';
}
export type LocalStatus = 'Live' | 'Awaiting review' | 'Rejected';
export interface LocalProductRow {
  key: string;
  sku: string;
  name: Record<string, string>;
  priceCents: number | null;
  status: LocalStatus;
  /** The claimed vehicles, from the review record (empty for a product without a claim). */
  claimedVehicles: string[];
}
/** The rows the client may see: no item list (it holds the whole file), only counts, mapping and issues. */
export type ValidationReport = Omit<ValidationResult, 'items'>;
export interface CommitResult {
  imported: number;
  failed: { sku: string; error: string }[];
  /** Rows the validation skipped (errors); they were never sent. */
  skipped: number;
  containers: string[];
}

// ---- Brand partnership ----
export interface PartnershipFlag {
  kind: 'fitment-claim';
  part: { key: string; sku: string; name: Record<string, string> };
  /** The vehicles the seller claims; empty when Malva holds no record (the seeded pending part). */
  claimedVehicles: string[];
  fixHref: string;
}
export interface Partnership {
  rules: { id: 'fitment' | 'price'; state: 'Enforced' | 'Informational' }[];
  kpis: { compliance: { score: number | null; checked: number; flags: number }; claimsPending: number };
  flags: PartnershipFlag[];
}
