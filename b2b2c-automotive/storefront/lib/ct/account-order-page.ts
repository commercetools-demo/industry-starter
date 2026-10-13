// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// What the order pages of the account need (detail, return, invoice), loaded once: the customer's own order (null for anyone else's), its
// view model, the store, the return eligibility and the returns of the order. A page answers `null` with the 404.
import 'server-only';
import type { Order } from '@commercetools/platform-sdk';
import { getTranslations } from 'next-intl/server';
import { returnEligibility, type ReturnableOrder } from '@/lib/account/returns';
import { getAccountOrder } from '@/lib/ct/account-orders';
import { PICKUP_BRANCH_FIELD } from '@/lib/ct/delivery';
import { getRecurringOrderForOrder } from '@/lib/ct/orders';
import { getShellContext } from '@/lib/ct/shell';
import { mapReturns } from '@/lib/mappers/account';
import { mapOrderView } from '@/lib/mappers/order';
import type { OrderView, ReturnEligibility, ReturnView, ShellContext } from '@/lib/types';

export interface AccountOrderPage {
  order: Order;
  view: OrderView;
  ctx: ShellContext;
  eligibility: ReturnEligibility;
  returns: ReturnView[];
}

export async function loadAccountOrder(store: string, locale: string, customerId: string, orderNumber: string): Promise<AccountOrderPage | null> {
  const order = await getAccountOrder(store, customerId, orderNumber);
  if (!order || order.store?.key !== store) return null;
  const [ctx, recurring, cartT] = await Promise.all([
    getShellContext(store, locale),
    order.lineItems.some((line) => line.recurrenceInfo) ? getRecurringOrderForOrder(order.id) : Promise.resolve(null),
    getTranslations({ locale, namespace: 'cart' }),
  ]);
  if (!ctx) return null;
  const branchKey = order.custom?.fields?.[PICKUP_BRANCH_FIELD] as string | undefined;
  const view = mapOrderView(order, {
    locale,
    branch: ctx.branches.find((b) => b.key === branchKey) ?? null,
    recurring,
    storeName: ctx.settings.name,
    shipDays: ctx.settings.shipDays,
    timezone: ctx.settings.timezone,
    savingFallback: cartT('savingFallback'),
  });
  const eligibility = returnEligibility(order as unknown as ReturnableOrder, { locale, windowDays: ctx.settings.returnWindowDays });
  return { order, view, ctx, eligibility, returns: mapReturns(order, locale) };
}
