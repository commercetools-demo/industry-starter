import { setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import OrdersTab from '@/components/account/orders/OrdersTab';
import { requireCustomerPage } from '@/lib/auth/require-customer';

export const dynamic = 'force-dynamic';

/** Account, Orders tab. The query string (`?filter=&page=`) is read on the client. */
export default async function AccountOrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCustomerPage('/account/orders');
  return (
    <Suspense fallback={null}>
      <OrdersTab />
    </Suspense>
  );
}
