import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/Button';

// Rendered with HTTP 404 for an unknown order number AND for another customer's order: the two are indistinguishable (no existence leak).
export default async function OrderNotFound() {
  const t = await getTranslations('account');
  return (
    <section className="flex max-w-2xl flex-col items-start gap-5 py-5">
      <h1 className="m-0 font-display text-4xl font-bold tracking-ui">{t('order.notFound')}</h1>
      <p className="m-0 text-lg text-text-muted">{t('order.notFoundBody')}</p>
      <Button href="/account/orders">{t('order.allOrders')}</Button>
    </section>
  );
}
