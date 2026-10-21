'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import ReviewForm from '@/components/reviews/ReviewForm';
import ReviewListPanel from '@/components/reviews/ReviewListPanel';
import WriteReviewCta, { type CtaState } from '@/components/reviews/WriteReviewCta';
import { useAccount } from '@/hooks/useAccount';
import { useMyReviews } from '@/hooks/useMyReviews';
import { useReviews } from '@/hooks/useReviews';
import { authorName } from '@/lib/reviews/validate';
import type { RatingStats, ReviewSort } from '@/lib/types';

export interface ReviewsSectionProps {
  productId: string;
  productSlug: string;
  sku: string;
  productName: string;
  /** The product's statistics (H's `RatingSummary` shows them above); not read here, the list has its own numbers. */
  stats: RatingStats | null;
}

type Mode = 'closed' | 'create' | 'edit';

/**
 * Mount point of workstream M on the product page: the call to action, the inline form, the sort select and the list.
 * Renders below H's `RatingSummary` and has no `<main>` or H2 of its own (the summary section owns the heading).
 */
export default function ReviewsSection({ productId, productSlug, sku }: ReviewsSectionProps) {
  const t = useTranslations('reviews');
  const formId = useId();
  const { customer } = useAccount();
  const [sort, setSort] = useState<ReviewSort>('newest');
  const list = useReviews(productId, sort);
  const my = useMyReviews();
  // null: the shopper has not chosen yet, so the sign-in return trip (`#write-review`) may open the form once.
  const [chosen, setChosen] = useState<Mode | null>(null);
  const [notice, setNotice] = useState('');
  const [hint, setHint] = useState('');
  const [wantsForm] = useState(() => typeof window !== 'undefined' && window.location.hash === '#write-review');

  const mineId = list.mine?.id ?? null;
  const mineFull = mineId ? my.reviews.find((r) => r.id === mineId) : undefined;
  const ctaState: CtaState = customer === undefined ? 'loading' : customer === null ? 'guest' : mineId ? 'reviewed' : 'write';
  const autoOpen = wantsForm && Boolean(customer) && !list.isLoading && !mineId;
  const mode: Mode = chosen ?? (autoOpen ? 'create' : 'closed');
  const setMode = (m: Mode) => setChosen(m);

  const scrolled = useRef(false);
  useEffect(() => {
    if (chosen === null && autoOpen && !scrolled.current) {
      scrolled.current = true;
      document.getElementById('write-review')?.scrollIntoView?.();
    }
  }, [autoOpen, chosen]);

  const toggle = () => {
    setNotice('');
    setHint('');
    setMode(mode === 'closed' ? (mineId ? 'edit' : 'create') : 'closed');
  };

  const showForm = Boolean(customer) && mode !== 'closed' && (mode === 'create' || mineFull);
  const returnPath = `/p/${encodeURIComponent(productSlug)}/${encodeURIComponent(sku)}`;

  return (
    <section id="reviews-list" aria-label={t('title')} data-product-id={productId} className="scroll-mt-28 pb-8">
      <div id="write-review" className="mb-5 scroll-mt-28">
        <WriteReviewCta
          state={ctaState}
          returnPath={returnPath}
          open={mode !== 'closed'}
          controlsId={formId}
          onToggle={toggle}
          {...(mineFull ? { reviewedAt: mineFull.createdAt } : {})}
        />
        {notice ? <p role="status" className="mb-0 mt-3 text-[14px] font-medium text-ink">{notice}</p> : null}
        {showForm && customer ? (
          <div id={formId} className="mt-4">
            <ReviewForm
              key={mode === 'edit' ? `edit-${mineFull?.id}` : 'create'}
              productId={productId}
              customerId={customer.id}
              authorName={authorName(customer.firstName, customer.lastName)}
              {...(mode === 'edit' && mineFull ? { existing: mineFull } : {})}
              {...(hint ? { notice: hint } : {})}
              onCancel={() => setMode('closed')}
              onSaved={(kind) => {
                setMode('closed');
                setHint('');
                setNotice(kind === 'created' ? t('form.published') : t('form.edited'));
              }}
              onAlreadyReviewed={() => {
                setHint(t('form.alreadyReviewed'));
                setMode('edit');
                void Promise.all([list.mutate(), my.mutate()]);
              }}
            />
          </div>
        ) : null}
      </div>
      <ReviewListPanel list={list} sort={sort} onSortChange={setSort} />
    </section>
  );
}
