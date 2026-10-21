import { useTranslations } from 'next-intl';
import ButtonLink from '@/components/ui/ButtonLink';
import Card from '@/components/ui/Card';

/** Shown for an unknown AND a foreign order number: the same card, no order data. */
export default function OrderNotFound() {
  const t = useTranslations('account.orders');
  return (
    <Card data-testid="order-not-found" role="alert">
      <h2 className="m-0 mb-2 font-display text-[22px] font-bold text-ink">{t('notFound')}</h2>
      <p className="m-0 mb-4 text-[14.5px] text-ink-2">{t('notFoundHelp')}</p>
      <ButtonLink variant="ghost" href="/account/orders">
        {t('backToOrders')}
      </ButtonLink>
    </Card>
  );
}
