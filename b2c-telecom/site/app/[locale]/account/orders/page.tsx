import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { OrdersTable } from '@/components/account/OrdersTable';
import { OrderStatusFilter } from '@/components/account/OrderStatusFilter';
import { Pagination } from '@/components/account/Pagination';
import { PanelUnavailable } from '@/components/account/PanelUnavailable';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { parsePage, parseStatus } from '@/lib/account/orders-query';
import { requireCustomerPage } from '@/lib/auth/guard';
import { firstParam, type RawSearchParams } from '@/lib/auth/search-params';
import { ORDERS_PAGE_SIZE } from '@/lib/config/account';
import { isLocale } from '@/lib/config/markets';
import { getCustomerOrders } from '@/lib/ct/orders';
import { mapOrderListItem } from '@/lib/mappers/order';
import type { OrderListItem } from '@/lib/types';

// Session-specific: read on every request, never cached, never indexed.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });
  return { title: t('orders.title'), robots: { index: false, follow: false } };
}

export default async function OrdersPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const { customer } = await requireCustomerPage(locale, '/account/orders');
  const t = await getTranslations({ locale, namespace: 'account' });
  const query = await searchParams;
  const status = parseStatus(firstParam(query.status));
  let page = parsePage(firstParam(query.page));

  // Only the signed-in customer's id is ever queried; the page and filter come from the query string, the customer from the session.
  let read: { items: OrderListItem[]; total: number } | null = null;
  try {
    let result = await getCustomerOrders(customer.id, locale, { status, page });
    if (result.orders.length === 0 && result.total > 0 && page > 1) {
      page = 1; // a page beyond the end reads as the first page
      result = await getCustomerOrders(customer.id, locale, { status, page });
    }
    read = { items: result.orders.map(mapOrderListItem), total: result.total };
  } catch (error) {
    console.error('[account] orders unavailable', error instanceof Error ? error.name : 'unknown');
  }
  const pages = read ? Math.max(1, Math.ceil(read.total / ORDERS_PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: t('home'), href: '/' }, { label: t('title'), href: '/account' }, { label: t('orders.title') }]} />
        <h1 className="m-0 font-display text-4xl font-bold tracking-ui">{t('orders.title')}</h1>
      </header>
      <OrderStatusFilter selected={status} />
      {read === null ? (
        <PanelUnavailable />
      ) : read.items.length === 0 ? (
        <div className="flex flex-col items-start gap-5">
          <p className="m-0 text-md">{status === 'all' ? t('orders.empty') : t('orders.emptyFilter')}</p>
          {status === 'all' ? <Button href="/shop/phone-plans">{t('orders.browse')}</Button> : <Button href="/account/orders" variant="secondary">{t('orders.showAll')}</Button>}
        </div>
      ) : (
        <>
          <OrdersTable orders={read.items} />
          <Pagination status={status} page={page} pages={pages} />
        </>
      )}
    </div>
  );
}
