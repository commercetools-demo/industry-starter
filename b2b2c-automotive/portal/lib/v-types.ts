// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Shapes of workstream V (customers, subscriptions, returns, reviews) shared by the seller routes, the services and the screens.
// No server imports: client components import these types with `import type`.
import type { ReturnReason, ReturnStatus } from '@/lib/contracts/return-item';

export type CustomerType = 'Registered' | 'Guest';
export type CustomerTab = 'all' | 'registered' | 'guests';

export interface CustomerRow {
  /** Null for a guest (guests have no customer record). */
  id: string | null;
  name: string;
  /** Always masked in lists. */
  email: string;
  type: CustomerType;
  orders: number;
  lifetimeCents: number;
  currency: string;
  lastOrderAt: string | null;
}

export interface CustomerKpis {
  registered: number;
  guests: number;
  /** Customers with 2+ orders divided by customers with 1+ orders, in percent with one decimal. */
  repeatRate: number;
}

export interface CustomerList {
  rows: CustomerRow[];
  total: number;
  kpis: CustomerKpis;
  /** True when the store has more records than the screen reads at once. */
  truncated: boolean;
}

export interface GarageVehicleView {
  id: string;
  label: string;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  createdAt: string;
  totalCents: number;
  currency: string;
  state: string;
  deliveredAt: string | null;
}

export interface CustomerNote {
  text: string;
  by: string;
  at: string;
}

export interface CustomerDetail {
  id: string;
  name: string;
  /** Full for an Admin, masked for any other role. */
  email: string;
  mobile?: string;
  createdAt: string;
  marketingConsent: boolean | null;
  marketingConsentAt: string | null;
  orders: OrderSummary[];
  garage: GarageVehicleView[];
  subscriptions: SubscriptionRow[];
  returns: ReturnRow[];
  notes: CustomerNote[];
}

export type SubscriptionStatus = 'Active' | 'Paused' | 'Canceled';
export type SubscriptionAction = 'pause' | 'resume' | 'cancel' | 'skip';

export interface SubscriptionRow {
  id: string;
  customerId: string | null;
  customer: string;
  items: { quantity: number; name: string }[];
  /** Locale-neutral interval: unit plus value, or the day of the month. */
  interval: { kind: 'standard'; value: number; unit: 'Days' | 'Weeks' | 'Months' } | { kind: 'dayOfMonth'; day: number };
  status: SubscriptionStatus;
  /** The commercetools state (Active, Paused, Canceled, Expired, Failed); the row actions follow it. */
  state: string;
  /** True for Expired and Failed, which show as Canceled with a "Needs attention" chip. */
  needsAttention: boolean;
  valueCents: number;
  currency: string;
  monthlyCents: number;
  nextOrderAt: string | null;
  skipsRemaining: number;
}

export interface SubscriptionList {
  rows: SubscriptionRow[];
  kpis: { monthlyCents: number; currency: string; active: number; paused: number; canceled: number };
  renewals: SubscriptionRow[];
}

export interface SubscriptionAuditEntry {
  action: SubscriptionAction;
  by: string;
  at: string;
  from: string;
  to: string;
}

export type RefundState = 'none' | 'pending' | 'failed';

export interface ReturnLineView {
  returnItemId: string;
  lineItemId: string;
  name: string;
  quantity: number;
}

export interface ReturnRow {
  returnNumber: string;
  orderNumber: string;
  customer: string;
  items: { quantity: number; name: string }[];
  tracking: string;
  status: ReturnStatus;
  reason: ReturnReason | string;
  refundState: RefundState;
  refundCents: number | null;
  rejectReason: string | null;
  createdAt: string;
  /** For the customer detail filter only. */
  customerId: string | null;
}

export interface ReturnDetail extends ReturnRow {
  lines: ReturnLineView[];
  currency: string;
  /** Largest refund the portal accepts now (paid share of the returned lines minus earlier refunds), or null without a payment. */
  maxRefundCents: number | null;
  hasPayment: boolean;
  comment: string | null;
  /** Wrong fit: the vehicle and fit result recorded on the order lines at purchase. */
  fitting: { vehicle: string | null; fit: string | null } | null;
}

export interface ReturnList {
  rows: ReturnRow[];
  kpis: { open: number; returnRatePercent: number; refundedThisMonthCents: number; currency: string };
}

export interface OrderForReturn {
  orderNumber: string;
  deliveredAt: string | null;
  windowOpen: boolean;
  lines: { lineItemId: string; name: string; purchased: number; returned: number; available: number }[];
}

export type ReviewTab = 'latest' | 'highest' | 'lowest';
export type ReviewVisibility = 'published' | 'hidden';

export interface ReviewRow {
  id: string;
  productId: string;
  productName: string;
  rating: number;
  title: string;
  text: string;
  author: string;
  createdAt: string;
  visibility: ReviewVisibility;
  reply: { text: string; at: string | null; by: string | null } | null;
}

export interface ReviewList {
  rows: ReviewRow[];
  kpis: { average: number; thisMonth: number; unanswered: number };
}

export interface ShopAsHandoff {
  action: string;
  token: string;
}
