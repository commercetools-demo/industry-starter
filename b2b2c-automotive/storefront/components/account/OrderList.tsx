// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Panel, StateMessage } from '@/components/account/Panel';
import { StatusBadge } from '@/components/account/StatusBadge';
import { buttonClass } from '@/components/ui/Button';
import { Link } from '@/i18n/routing';
import { formatDate } from '@/lib/account/format';
import type { OrderListPage } from '@/lib/types';
import { formatMoney } from '@/lib/utils';

/** The shopper's orders, newest first: number (link), date, status chip, units and total (money of the order itself), with previous and next links. */
export function OrderList({ store, list, timeZone }: { store: string; list: OrderListPage; timeZone?: string }) {
  const t = useTranslations('account.orders');
  const locale = useLocale();
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const base = `/${store}/account/orders`;
  const href = (page: number) => (page <= 1 ? base : `${base}?page=${page}`);

  if (list.items.length === 0) {
    return (
      <StateMessage
        kind="empty"
        title={t('empty')}
        hint={<p className="m-0 font-ui text-sm text-text-body">{t('emptyHint')}</p>}
        action={
          <Link href={`/${store}/parts`} className={buttonClass('primary')}>
            {t('emptyCta')}
          </Link>
        }
      />
    );
  }
  return (
    <Panel>
      <ul aria-label={t('listLabel')} className="m-0 grid list-none gap-3 p-0">
        {list.items.map((order) => (
          <li key={order.number} className="grid gap-2 rounded-sm border border-border p-4 min-[43.75rem]:grid-cols-[1fr_auto_auto] min-[43.75rem]:items-center min-[43.75rem]:gap-5">
            <div className="grid gap-1">
              <Link href={`${base}/${order.number}`} aria-label={t('view', { number: order.number })} className="font-display text-md font-semibold text-text-link underline-offset-2 hover:underline">
                {order.number}
              </Link>
              <span className="font-ui text-sm text-text-muted">
                {t('date')} {formatDate(order.createdAt, locale, timeZone)} · {t('items', { count: order.itemCount })}
              </span>
            </div>
            <StatusBadge status={order.status} />
            <span className="font-ui text-md font-semibold text-text">{formatMoney(order.total.centAmount, order.total.currencyCode, locale, order.total.fractionDigits)}</span>
          </li>
        ))}
      </ul>
      {pages > 1 ? (
        <nav aria-label={t('pagination')} className="flex flex-wrap items-center justify-between gap-3">
          {list.page > 1 ? (
            <Link href={href(list.page - 1)} rel="prev" className={buttonClass('secondary')}>
              {t('previous')}
            </Link>
          ) : (
            <span />
          )}
          <span className="font-ui text-sm text-text-muted">{t('pageOf', { page: list.page, pages })}</span>
          {list.page < pages ? (
            <Link href={href(list.page + 1)} rel="next" className={buttonClass('secondary')}>
              {t('next')}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </Panel>
  );
}
