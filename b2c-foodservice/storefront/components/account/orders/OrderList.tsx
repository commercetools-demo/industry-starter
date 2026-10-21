'use client';

import { useTranslations } from 'next-intl';
import OrderCard from '@/components/account/orders/OrderCard';
import Button from '@/components/ui/Button';
import type { OrderListItem } from '@/lib/types';

/** Order cards with Previous and Next (disabled at the ends). `page` is 1-based. */
export default function OrderList({
  orders,
  page,
  pages,
  onPage,
  onReorder,
  reorderingId,
}: {
  orders: OrderListItem[];
  page: number;
  pages: number;
  onPage: (page: number) => void;
  onReorder?: (id: string) => void;
  reorderingId?: string | null;
}) {
  const t = useTranslations('account.orders');
  return (
    <>
      <div>
        {orders.map((o) => (
          <OrderCard key={o.id} order={o} onReorder={onReorder} reordering={reorderingId === o.id} />
        ))}
      </div>
      {pages > 1 ? (
        <nav aria-label={t('pagination')} className="mt-6 flex items-center justify-between gap-3">
          <Button variant="ghost" disabled={page <= 1} aria-label={t('prev')} onClick={() => onPage(page - 1)}>
            {t('prev')}
          </Button>
          <span className="text-[13px] text-ink-3">{t('page', { page, pages })}</span>
          <Button variant="ghost" disabled={page >= pages} aria-label={t('next')} onClick={() => onPage(page + 1)}>
            {t('next')}
          </Button>
        </nav>
      ) : null}
    </>
  );
}
