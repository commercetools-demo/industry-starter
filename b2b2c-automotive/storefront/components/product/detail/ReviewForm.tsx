// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { useId, useState, type FormEvent } from 'react';
import { buttonClass } from '@/components/ui/Button';
import { INPUT_CLASS, Field } from '@/components/ui/Field';
import { useSubmitReview } from '@/hooks/useSubmitReview';
import { Link, useRouter } from '@/i18n/routing';

export type ReviewFormState = 'signed-out' | 'eligible' | 'not-purchased' | 'already-reviewed';

interface Props {
  productId: string;
  state: ReviewFormState;
  store: string;
}

/**
 * Minimal review form (workstream M, W04): signed-in customers who bought the part write one review (rating, title, text); it is
 * published at once and the page re-reads the list. Everyone else gets one line that says why there is no form.
 */
export function ReviewForm({ productId, state, store }: Props) {
  const t = useTranslations('pdp');
  const router = useRouter();
  const { submit, isSubmitting, error } = useSubmitReview();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [missing, setMissing] = useState(false);
  const [done, setDone] = useState(false);
  const ratingName = useId();
  const textId = useId();

  if (state === 'signed-out') {
    return (
      <p className="m-0 font-ui text-sm text-text-muted">
        <Link href={`/${store}/account`} className="text-text-link underline underline-offset-2">
          {t('reviewSignIn')}
        </Link>
      </p>
    );
  }
  if (state === 'not-purchased') return <p className="m-0 font-ui text-sm text-text-muted">{t('reviewNotPurchased')}</p>;
  if (state === 'already-reviewed' || done) return <p role="status" className="m-0 font-ui text-sm text-text-muted">{done ? t('reviewThanks') : t('reviewAlready')}</p>;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (rating < 1 || !title.trim() || !text.trim()) {
      setMissing(true);
      return;
    }
    setMissing(false);
    if (await submit({ productId, rating, title: title.trim(), text: text.trim() })) {
      setDone(true);
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-prose gap-3">
      <h3 className="m-0 font-display text-md font-semibold text-text">{t('writeReview')}</h3>
      <fieldset className="m-0 flex flex-wrap items-center gap-2 border-0 p-0">
        <legend className="mb-1 p-0 font-ui text-xs font-bold uppercase tracking-label text-text-muted">{t('reviewRating')}</legend>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={`flex min-h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-sm border px-3 font-ui text-sm ${rating === n ? 'border-border-brand bg-surface-brand-subtle text-text' : 'border-border-strong bg-surface text-text-muted'}`}>
            <input type="radio" name={ratingName} value={n} checked={rating === n} onChange={() => setRating(n)} className="sr-only" />
            <span aria-hidden="true">★</span>
            <span>{t('starsLabel', { rating: n })}</span>
          </label>
        ))}
      </fieldset>
      <Field label={t('reviewTitle')} value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} />
      <div className="flex flex-col gap-1">
        <label htmlFor={textId} className="font-ui text-xs font-bold uppercase tracking-label text-text-muted">
          {t('reviewText')}
        </label>
        <textarea id={textId} rows={4} maxLength={1000} value={text} onChange={(event) => setText(event.target.value)} className={`${INPUT_CLASS} py-2`} />
      </div>
      {missing ? (
        <p role="alert" className="m-0 font-ui text-sm text-danger-600">
          {t('reviewMissing')}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="m-0 font-ui text-sm text-danger-600">
          {error === 'not-purchased' ? t('reviewNotPurchased') : error === 'already-reviewed' ? t('reviewAlready') : t('reviewFailed')}
        </p>
      ) : null}
      <button type="submit" disabled={isSubmitting} className={buttonClass('primary', 'w-fit')}>
        {isSubmitting ? t('adding') : t('submitReview')}
      </button>
    </form>
  );
}
