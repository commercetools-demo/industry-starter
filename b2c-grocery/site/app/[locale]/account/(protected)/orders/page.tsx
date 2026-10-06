import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DetailsCard } from '@/components/account/DetailsCard';
import { OrdersList } from '@/components/account/OrdersList';
import { parsePage } from '@/lib/orders-paging';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account.orders' });
  return { title: t('title') };
}

/** All orders, 10 per page (`?page=N`). The Details card is the rail with Orders marked active. */
export default async function OrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'account.orders' });
  const { page } = await searchParams;
  return (
    <div className="page py-[calc(var(--space-8)*1.2)] px-(--space-4) tablet:px-(--space-8)">
      <h1 className="mb-(--space-6) text-[52px]">{t('title')}</h1>
      <div className="grid items-start gap-[42px] desktop:grid-cols-[1.6fr_1fr]">
        <div className="order-2 desktop:order-1">
          <OrdersList page={parsePage(typeof page === 'string' ? page : undefined)} />
        </div>
        <aside className="order-1 desktop:order-2">
          <DetailsCard current="orders" />
        </aside>
      </div>
    </div>
  );
}
