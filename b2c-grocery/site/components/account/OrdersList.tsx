'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { useOrders } from '@/hooks/useOrders';
import { OrdersTable } from './OrdersTable';

/**
 * The customer's orders (client-fetched). `preview` limits the rows and adds an "All orders" link when there are more
 * (dashboard); without it the list shows a full page with Previous/Next links (`/account/orders?page=N`).
 */
export function OrdersList({ page = 1, preview }: { page?: number; preview?: number }) {
  const t = useTranslations('account.orders');
  const tAccount = useTranslations('account');
  const { orders, total, pageSize, error, isLoading, mutate } = useOrders(page);

  if (isLoading && orders.length === 0) {
    return (
      <p aria-busy="true" className="m-0 text-[15px] text-text/60">
        {t('loadingRows')}
      </p>
    );
  }
  if (error && orders.length === 0) {
    return (
      <div role="alert" className="flex flex-col items-start gap-(--space-3)">
        <p className="m-0 text-[15px]">{tAccount('loadFailed')}</p>
        <Button variant="secondary" onClick={() => void mutate()}>
          {tAccount('retry')}
        </Button>
      </div>
    );
  }
  if (orders.length === 0) {
    if (page > 1 && total > 0) {
      // Out-of-range page: send the shopper back to the first one instead of an empty table.
      return (
        <Button href="/account/orders" variant="secondary">
          {t('viewAll')}
        </Button>
      );
    }
    return (
      <div className="flex flex-col items-start gap-(--space-3)">
        <p className="m-0 text-[17px] text-text/60">{t('empty')}</p>
        <Button href="/shop">{t('browse')}</Button>
      </div>
    );
  }

  const shown = preview ? orders.slice(0, preview) : orders;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-col gap-(--space-4)">
      <OrdersTable orders={shown} />
      {preview ? (
        total > shown.length ? (
          <div>
            <Button href="/account/orders" variant="ghost">
              {t('viewAll')}
            </Button>
          </div>
        ) : null
      ) : pages > 1 ? (
        <nav aria-label={t('pagination')} className="flex items-center justify-between gap-(--space-3)">
          {page > 1 ? (
            <Button href={page - 1 === 1 ? '/account/orders' : `/account/orders?page=${page - 1}`} variant="ghost">
              {t('previous')}
            </Button>
          ) : (
            <span />
          )}
          <span className="text-[13px] text-text/60">{t('pageOf', { page, pages })}</span>
          {page < pages ? (
            <Button href={`/account/orders?page=${page + 1}`} variant="ghost">
              {t('next')}
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
