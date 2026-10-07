'use client';

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { useRouter } from '@/i18n/routing';

/**
 * The payment may have gone through but no order exists yet (the buyer returned before the Checkout finished, or the order is not readable
 * yet). One retry path: "Check again" re-reads this page. The same order number is reserved for the bundle, so a repeated payment cannot
 * create a second order.
 */
export function PlacementPending({ orderNumber }: { orderNumber: string }): ReactElement {
  const t = useTranslations('confirmation.pending');
  const router = useRouter();
  return (
    <section role="status" aria-labelledby="placement-pending" className="flex flex-col gap-4 rounded-xl border-2 border-border bg-surface p-7">
      <h2 id="placement-pending" className="m-0 font-display text-2xl font-bold">
        {t('title', { orderNumber })}
      </h2>
      <p className="m-0 text-md">{t('body')}</p>
      <div className="flex flex-wrap gap-4">
        <Button onClick={() => router.refresh()}>{t('check')}</Button>
        <Button href="/bundle/checkout?step=review" variant="secondary">
          {t('back')}
        </Button>
      </div>
    </section>
  );
}
