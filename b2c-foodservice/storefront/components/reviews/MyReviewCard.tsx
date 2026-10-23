'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Stars, useReviewDate } from '@/components/reviews/ReviewItem';
import Button from '@/components/ui/Button';
import { Link } from '@/i18n/routing';
import type { MyReviewView } from '@/lib/types';

const CLAMP_AT = 180;

/**
 * One of the customer's own reviews in the account. Every review is published, so there is no state tag. The text is
 * clamped to three lines with "Show more"; edit and delete are real buttons.
 */
export default function MyReviewCard({
  review,
  onEdit,
  onDelete,
}: {
  review: MyReviewView;
  onEdit: (review: MyReviewView) => void;
  onDelete: (review: MyReviewView) => void;
}) {
  const t = useTranslations('reviews');
  const formatDate = useReviewDate();
  const [expanded, setExpanded] = useState(false);
  const { product } = review;
  const long = (review.text?.length ?? 0) > CLAMP_AT;
  const href = product?.slug && product.sku ? `/p/${encodeURIComponent(product.slug)}/${encodeURIComponent(product.sku)}` : null;

  return (
    <li className="flex gap-4 border-b border-line py-5 first:pt-0 last:border-b-0" data-testid="my-review">
      <div className="relative h-[62px] w-[52px] shrink-0 overflow-hidden rounded-field bg-canvas-2">
        {product?.imageUrl ? <Image src={product.imageUrl} alt="" fill sizes="52px" className="object-cover" /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="m-0 font-display text-[15px] font-semibold text-ink">
          {href && product ? (
            <Link href={href} className="text-ink underline-offset-2 hover:underline">{product.name}</Link>
          ) : (
            <span className="text-ink-2">{product?.name ?? t('mine.unavailable')}</span>
          )}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Stars rating={review.rating} />
          <time dateTime={review.createdAt} className="text-[12.5px] text-ink-3">{formatDate(review.createdAt)}</time>
        </div>
        {review.title ? <p className="mb-0 mt-2 font-display text-[15px] font-semibold text-ink [overflow-wrap:anywhere]">{review.title}</p> : null}
        {review.text ? (
          <>
            <p className={`mb-0 mt-1.5 whitespace-pre-line text-[14.5px] leading-[1.55] text-ink [overflow-wrap:anywhere] ${expanded ? '' : 'line-clamp-3'}`}>
              {review.text}
            </p>
            {long ? (
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpanded((v) => !v)}
                className="mt-1 min-h-11 border-0 bg-transparent p-0 text-[13px] font-semibold text-ink underline"
              >
                {expanded ? t('mine.showLess') : t('mine.showMore')}
              </button>
            ) : null}
          </>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-3">
          <Button variant="ghost" onClick={() => onEdit(review)}>{t('mine.edit')}</Button>
          <Button variant="ghost" onClick={() => onDelete(review)}>{t('mine.delete')}</Button>
        </div>
      </div>
    </li>
  );
}
