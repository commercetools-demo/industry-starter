import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AccountHeading } from '@/components/account/AccountShell';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { pageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('account.orders');
  return pageMetadata({ locale, path: '/account/orders', title: t('title'), noindex: true });
}

// STUB: workstream S replaces this page with the order list (`order-history`). Until then it shows the empty state so the
// side navigation, the overview tile and the "Orders" link all resolve. The tile count comes from `countOrders()`.
export default async function OrdersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('account.orders');
  return (
    <>
      <AccountHeading title={t('title')} />
      <EmptyState
        title={t('empty')}
        action={
          <ButtonLink href="/prescriptions" variant="outline" size="sm">
            {t('orderFromRx')}
          </ButtonLink>
        }
      />
    </>
  );
}
