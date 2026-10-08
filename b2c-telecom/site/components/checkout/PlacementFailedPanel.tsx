'use client';

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';

type Props = { onReview: () => void };

/** The hosted Checkout could not place the order at the last moment. Recoverable: nothing was placed, the bundle is intact, a retry reuses the same order number. */
export function PlacementFailedPanel({ onReview }: Props): ReactElement {
  const t = useTranslations('checkout.placementFailed');
  return (
    <section role="alert" aria-labelledby="placement-failed" className="flex flex-col gap-4 rounded-xl border-2 border-danger bg-surface p-6">
      <h2 id="placement-failed" className="m-0 font-display text-xl font-bold">
        {t('title')}
      </h2>
      <p className="m-0 text-md">{t('body')}</p>
      <div className="flex flex-wrap gap-4">
        <Button onClick={onReview}>{t('review')}</Button>
        <Button href="/bundle" variant="secondary">
          {t('bundle')}
        </Button>
      </div>
    </section>
  );
}
