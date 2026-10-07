'use client';

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Chip } from '@/components/ui/Chip';
import { useRouter } from '@/i18n/routing';
import { ordersHref } from '@/lib/account/orders-query';
import { ORDER_STATUS_FILTER_KEYS, type OrderStatusFilter as Filter } from '@/lib/config/account';

/** Status chips of the order list; choosing one goes back to page 1 of that filter (the query string is the state). */
export function OrderStatusFilter({ selected }: { selected: Filter }): ReactElement {
  const t = useTranslations('account');
  const router = useRouter();
  return (
    <div role="group" aria-label={t('orders.filterLabel')} className="flex flex-wrap gap-3">
      {ORDER_STATUS_FILTER_KEYS.map((key) => (
        <Chip key={key} selected={key === selected} onClick={() => router.push(ordersHref(key, 1))}>
          {t(`filter.${key}`)}
        </Chip>
      ))}
    </div>
  );
}
