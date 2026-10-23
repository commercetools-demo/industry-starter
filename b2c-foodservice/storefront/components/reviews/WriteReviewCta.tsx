'use client';

import { useTranslations } from 'next-intl';
import { useReviewDate } from '@/components/reviews/ReviewItem';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import { signInHref } from '@/lib/routes';

export type CtaState = 'loading' | 'guest' | 'write' | 'reviewed';

export interface WriteReviewCtaProps {
  state: CtaState;
  /** Product page path without the locale, for the return trip after sign-in, for example `/p/<slug>/<sku>`. */
  returnPath: string;
  open: boolean;
  controlsId: string;
  onToggle: () => void;
  /** ISO date of the customer's own review, when known. */
  reviewedAt?: string;
}

/**
 * Guest: a sign-in prompt that returns to `#write-review`. Signed in and not reviewed: "Write a review". Reviewed: the date
 * of the review and "Edit your review" (one review per product and customer).
 */
export default function WriteReviewCta({ state, returnPath, open, controlsId, onToggle, reviewedAt }: WriteReviewCtaProps) {
  const t = useTranslations('reviews.cta');
  const formatDate = useReviewDate();
  if (state === 'loading') return <div className="min-h-11" aria-hidden="true" />;
  if (state === 'guest') {
    return (
      <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] text-ink-2">
        <span>{t('signIn')}</span>
        <ButtonLink variant="ghost" href={signInHref(`${returnPath}#write-review`)}>
          {t('signInLink')}
        </ButtonLink>
      </p>
    );
  }
  if (state === 'reviewed') {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="m-0 text-[14px] text-ink-2">
          {reviewedAt ? t('reviewed', { date: formatDate(reviewedAt) }) : t('reviewedNoDate')}
        </p>
        <Button variant="ghost" aria-expanded={open} aria-controls={controlsId} onClick={onToggle}>
          {t('edit')}
        </Button>
      </div>
    );
  }
  return (
    <Button aria-expanded={open} aria-controls={controlsId} onClick={onToggle}>
      {t('write')}
    </Button>
  );
}
