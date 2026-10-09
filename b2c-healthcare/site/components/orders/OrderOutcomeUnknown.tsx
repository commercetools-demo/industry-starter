import { useTranslations } from 'next-intl';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

/** Placement outcome unknown: no order was read, so nothing here says the order was placed. */
export function OrderOutcomeUnknown() {
  const t = useTranslations('orders.unknown');
  return (
    <div>
      <div className="mx-auto max-w-160 px-5 py-12 nav:px-8">
        <Card className="grid gap-4" data-order-outcome="unknown">
          <h1 className="font-display text-3xl font-semibold text-navy-900">{t('title')}</h1>
          <p className="text-neutral-600">{t('body')}</p>
          <ButtonLink href="/account/orders" className="justify-self-start">
            {t('check')}
          </ButtonLink>
        </Card>
      </div>
    </div>
  );
}
