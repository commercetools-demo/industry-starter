'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import PanelState from '@/components/account/PanelState';
import OrderFilters from '@/components/account/orders/OrderFilters';
import OrderList from '@/components/account/orders/OrderList';
import { useReorder } from '@/components/account/orders/useReorder';
import ButtonLink from '@/components/ui/ButtonLink';
import { ORDERS_PAGE_SIZE, useOrders } from '@/hooks/useOrders';
import { usePathname, useRouter } from '@/i18n/routing';
import { marketForLocale } from '@/lib/utils';
import type { OrderFilter } from '@/lib/types';

const FILTERS: readonly OrderFilter[] = ['all', 'in-progress', 'ready', 'completed'];

/** `?filter=&page=` to a safe filter and a 1-based page. Anything unknown falls back to the defaults. */
export function parseOrdersQuery(params: { get(name: string): string | null }): { filter: OrderFilter; page: number } {
  const f = params.get('filter') as OrderFilter | null;
  const p = Number(params.get('page'));
  return {
    filter: f && FILTERS.includes(f) ? f : 'all',
    page: Number.isInteger(p) && p >= 1 && p <= 10000 ? p : 1,
  };
}

/** The Orders tab: filter chips, cards, paging. State lives in the query string so it survives a reload. */
export default function OrdersTab({ onReorder, reorderingId }: { onReorder?: (id: string) => void; reorderingId?: string | null } = {}) {
  const own = useReorder();
  const t = useTranslations('account.orders');
  const tTabs = useTranslations('account.tabs');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { filter, page } = parseOrdersQuery(params);
  const { data, isLoading, isError, mutate } = useOrders(filter, page);
  const collection = marketForLocale(locale).collection;

  const go = (next: { filter: OrderFilter; page: number }) => {
    const q = new URLSearchParams();
    if (next.filter !== 'all') q.set('filter', next.filter);
    if (next.page > 1) q.set('page', String(next.page));
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / ORDERS_PAGE_SIZE)) : 1;
  return (
    <section aria-labelledby="orders-heading">
      <h2 id="orders-heading" className="m-0 mb-[18px] font-display text-[22px] font-bold text-ink">
        {t('title')}
      </h2>
      <OrderFilters value={filter} collection={collection} onChange={(f) => go({ filter: f, page: 1 })} />
      <PanelState
        panel={tTabs('orders')}
        isLoading={isLoading && !data}
        isError={isError && !data}
        isEmpty={Boolean(data) && data!.orders.length === 0}
        onRetry={() => void mutate()}
        empty={
          filter === 'all' ? (
            <>
              <p className="m-0 mb-4 text-[14.5px] text-ink-2">{t('empty')}</p>
              <ButtonLink href="/shop">{t('emptyCta')}</ButtonLink>
            </>
          ) : (
            <p className="m-0 text-[14.5px] text-ink-2">{t('emptyFiltered')}</p>
          )
        }
      >
        {data ? (
          <OrderList
            orders={data.orders}
            page={page}
            pages={pages}
            onPage={(p) => go({ filter, page: p })}
            onReorder={onReorder ?? ((id) => void own.reorder(id))}
            reorderingId={reorderingId ?? own.pendingId}
          />
        ) : null}
      </PanelState>
      {own.dialog}
    </section>
  );
}
