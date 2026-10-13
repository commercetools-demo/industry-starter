// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import type { OrderStatus } from '@/lib/types';

const TONE: Record<OrderStatus, BadgeTone> = {
  placed: 'neutral',
  'ready-for-pickup': 'info',
  shipped: 'info',
  collected: 'success',
  delivered: 'success',
  cancelled: 'danger',
};

/** The order status as a chip (words from `account.status`, mapped by `mapOrderStatus`). */
export function StatusBadge({ status }: { status: OrderStatus }) {
  const t = useTranslations('account.status');
  return <Badge tone={TONE[status]}>{t(status)}</Badge>;
}
