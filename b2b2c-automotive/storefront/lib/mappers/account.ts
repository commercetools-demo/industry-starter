// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// commercetools resources to the account area models (workstream Q). Pure. Nothing here carries a password, a token value or a custom
// field other than the ones the account area shows.
import type { Address, Customer, Order, PaymentMethod, RecurrencePolicy, RecurringOrder } from '@commercetools/platform-sdk';
import { isReturnReason, isReturnStatus } from '@/lib/contracts/return-item';
import { mapOrderStatus } from '@/lib/mappers/order';
import { mapMoney } from '@/lib/mappers/money';
import type { AccountAddress, AccountProfile, OrderListItem, PaymentMethodView, ReturnView, SubscriptionStatus, SubscriptionView } from '@/lib/types';
import { getLocalizedString } from '@/lib/utils';

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

export function mapProfile(customer: Customer): AccountProfile {
  const fields = customer.custom?.fields ?? {};
  return {
    email: customer.email,
    firstName: text(customer.firstName),
    lastName: text(customer.lastName),
    mobile: text(fields.mobile),
    marketingConsent: fields.marketingConsent === true,
  };
}

export function mapAddress(address: Address, defaultId: string | undefined | null): AccountAddress {
  return {
    id: address.id ?? '',
    firstName: text(address.firstName),
    lastName: text(address.lastName),
    streetName: text(address.streetName),
    streetNumber: text(address.streetNumber),
    postalCode: text(address.postalCode),
    city: text(address.city),
    country: address.country,
    phone: text(address.phone) ?? text(address.mobile),
    isDefault: Boolean(address.id) && address.id === defaultId,
  };
}

export const mapAddresses = (customer: Customer): AccountAddress[] => (customer.addresses ?? []).map((a) => mapAddress(a, customer.defaultShippingAddressId));

export function mapOrderListItem(order: Order): OrderListItem {
  return {
    number: order.orderNumber ?? '',
    createdAt: order.createdAt,
    status: mapOrderStatus(order),
    total: mapMoney(order.taxedPrice?.totalGross ?? order.totalPrice),
    itemCount: order.lineItems.reduce((sum, line) => sum + line.quantity, 0),
  };
}

/** One entry per return number (the portal groups the items the same way); newest first. */
export function mapReturns(order: Order, locale: string): ReturnView[] {
  const groups = new Map<string, ReturnView>();
  (order.returnInfo ?? []).forEach((info, index) => {
    for (const item of info.items) {
      const lineItemId = (item as { lineItemId?: string }).lineItemId;
      if (!lineItemId) continue;
      const fields = item.custom?.fields ?? {};
      const returnNumber = text(fields.returnNumber) ?? `RET-${order.orderNumber ?? order.id}-${index + 1}`;
      const line = order.lineItems.find((l) => l.id === lineItemId);
      const status = isReturnStatus(fields.status) ? fields.status : item.shipmentState === 'Returned' ? 'received' : 'requested';
      const view = groups.get(returnNumber) ?? {
        returnNumber,
        tracking: info.returnTrackingId ?? '',
        orderNumber: order.orderNumber ?? '',
        requestedAt: info.returnDate ?? item.createdAt ?? null,
        status,
        reason: isReturnReason(fields.reason) ? fields.reason : null,
        items: [],
      };
      view.items.push({ lineItemId, name: line ? getLocalizedString(line.name, locale) : '', quantity: item.quantity });
      groups.set(returnNumber, view);
    }
  });
  return [...groups.values()].sort((a, b) => (b.requestedAt ?? '').localeCompare(a.requestedAt ?? ''));
}

/** Tokenised data only: id, a label, the last four digits and expiry when the connector stored them as custom fields. */
export function mapPaymentMethod(method: PaymentMethod, locale: string): PaymentMethodView {
  const fields = method.custom?.fields ?? {};
  const name = getLocalizedString(method.name, locale);
  const brand = text(fields.brand) ?? text(fields.cardBrand);
  const last4 = text(fields.last4) ?? text(fields.cardLast4);
  const month = fields.expiryMonth ?? fields.expMonth;
  const year = fields.expiryYear ?? fields.expYear;
  return {
    id: method.id,
    label: [brand, name].filter(Boolean)[0] ?? text(method.method) ?? text(method.paymentInterface) ?? '',
    last4: last4 && /^\d{4}$/.test(last4) ? last4 : null,
    expiry: month && year ? `${String(month).padStart(2, '0')}/${String(year).slice(-2)}` : null,
    isDefault: method.default,
  };
}

export interface PolicyDetail {
  id: string;
  key: string;
  label: string;
  schedule: RecurrencePolicy['schedule'];
}

const STATUS: Record<RecurringOrder['recurringOrderState'], SubscriptionStatus> = { Active: 'active', Paused: 'paused', Canceled: 'canceled', Expired: 'expired', Failed: 'failed' };

type LineLike = Order['lineItems'][number];
const sameSchedule = (a: RecurrencePolicy['schedule'], b: RecurringOrder['schedule']): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * A recurring order for the account list. Lines come from the order itself when it carries them, else from the expanded origin order;
 * `nextOrderAt` is the API's own date; the frequency is the name of the recurrence policy of the lines, or of the policy with the same schedule.
 */
export function mapSubscription(ro: RecurringOrder, policies: PolicyDetail[], locale: string): SubscriptionView {
  const direct = (ro as unknown as { lineItems?: LineLike[] }).lineItems;
  const origin = (ro.originOrder as { obj?: Order } | undefined)?.obj;
  const lines = direct && direct.length > 0 ? direct : (origin?.lineItems ?? []);
  const policyId = lines.map((l) => l.recurrenceInfo?.recurrencePolicy?.id).find((id): id is string => Boolean(id));
  const policy = policies.find((p) => p.id === policyId) ?? policies.find((p) => sameSchedule(p.schedule, ro.schedule));
  const skip = ro.skipConfiguration;
  return {
    id: ro.id,
    status: STATUS[ro.recurringOrderState] ?? 'active',
    frequency: policy?.label ?? '',
    policyKey: policy?.key ?? null,
    nextOrderAt: ro.nextOrderAt ?? null,
    skipPending: skip ? Math.max(0, skip.totalToSkip - skip.skipped) : 0,
    orderNumber: origin?.orderNumber ?? null,
    lines: lines.map((l) => ({ name: getLocalizedString(l.name, locale), quantity: l.quantity, imageUrl: l.variant?.images?.[0]?.url ?? null })),
  };
}
