/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { setRequestLocale } from 'next-intl/server';
import { OrderDetail } from '@/components/account/OrderDetail';

/** Order detail. Client-fetched through `/api/account/orders/[orderId]`, which enforces ownership (404 for another customer's order). */
export default async function OrderPage({ params }: { params: Promise<{ locale: string; orderId: string }> }) {
  const { locale, orderId } = await params;
  setRequestLocale(locale);
  return <OrderDetail orderId={orderId} />;
}
