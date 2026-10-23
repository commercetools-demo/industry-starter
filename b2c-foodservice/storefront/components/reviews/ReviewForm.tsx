'use client';

import { useTranslations } from 'next-intl';
import { useId, useRef, useState, type FormEvent } from 'react';
import FieldCounter from '@/components/reviews/FieldCounter';
import StarInput from '@/components/reviews/StarInput';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { ReviewApiError, useReviewActions } from '@/hooks/useReviewActions';
import { TEXT_MAX, TITLE_MAX } from '@/lib/reviews/validate';
import type { MyReviewView } from '@/lib/types';

export interface ReviewFormProps {
  productId: string;
  customerId: string;
  /** "Maya O." as it will be posted. */
  authorName: string;
  /** Present: edit this review (PATCH). Absent: write a new one (POST). */
  existing?: Pick<MyReviewView, 'id' | 'rating' | 'title' | 'text'>;
  onSaved: (kind: 'created' | 'edited', review: MyReviewView) => void;
  onCancel: () => void;
  /** The server says this customer already reviewed the product; the id of that review when known. */
  onAlreadyReviewed?: (reviewId: string | null) => void;
  /** A line shown above the fields (for example the "already reviewed" hint). */
  notice?: string;
  /** Render without the surrounding card (inside a Modal). */
  bare?: boolean;
}

type Status = 'idle' | 'submitting' | 'error' | 'rateLimited';
type FieldKey = 'rating' | 'title' | 'text';

/**
 * The review form: star rating (required), optional title (80) and text (2000), the same component for writing and for
 * editing. Nothing is sent without a rating: the error shows beside the control and focus moves to it. On any failure
 * the entries stay.
 */
export default function ReviewForm({ productId, customerId, authorName, existing, onSaved, onCancel, onAlreadyReviewed, notice, bare }: ReviewFormProps) {
  const t = useTranslations('reviews');
  const actions = useReviewActions(customerId);
  const uid = useId();
  const ratingLabelId = `${uid}-rating-label`;
  const ratingErrorId = `${uid}-rating-error`;
  const titleId = `${uid}-title`;
  const textId = `${uid}-text`;
  const ratingRef = useRef<HTMLDivElement>(null);

  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [text, setText] = useState(existing?.text ?? '');
  const [status, setStatus] = useState<Status>('idle');
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const editing = Boolean(existing);

  const focusRating = () => {
    const stop = ratingRef.current?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]');
    stop?.focus();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === 'submitting') return;
    if (!rating) {
      setErrors({ rating: 'rating_required' });
      focusRating();
      return;
    }
    setErrors({});
    setStatus('submitting');
    try {
      const body = { rating, title: title.trim(), text: text.trim() };
      if (existing) {
        const review = await actions.update(existing.id, body, productId);
        onSaved('edited', review);
      } else {
        const review = await actions.create(productId, {
          rating,
          ...(body.title ? { title: body.title } : {}),
          ...(body.text ? { text: body.text } : {}),
        });
        onSaved('created', review);
      }
      setStatus('idle');
    } catch (err) {
      if (err instanceof ReviewApiError && err.code === 'already_reviewed') {
        setStatus('idle');
        onAlreadyReviewed?.(err.extra.reviewId ?? null);
        return;
      }
      if (err instanceof ReviewApiError && err.code === 'rate_limited') {
        setStatus('rateLimited');
        return;
      }
      if (err instanceof ReviewApiError && err.code === 'validation_failed' && err.extra.fields) {
        setErrors(err.extra.fields as Partial<Record<FieldKey, string>>);
        setStatus('idle');
        if (err.extra.fields.rating) focusRating();
        return;
      }
      setStatus('error');
    }
  };

  const fieldError = (key: FieldKey): string | undefined => {
    const code = errors[key];
    if (!code) return undefined;
    return t.has(`errors.${code}`) ? t(`errors.${code}`) : t('form.error');
  };
  const submitting = status === 'submitting';

  const body = (
    <form onSubmit={submit} noValidate aria-busy={submitting || undefined}>
      {!bare ? <h3 className="m-0 mb-4 font-display text-[18px] font-semibold text-ink">{editing ? t('form.editTitle') : t('form.title')}</h3> : null}
      {notice ? <p className="mb-4 mt-0 text-[14px] text-ink-2" role="status">{notice}</p> : null}

      <div className="mb-4">
        <p id={ratingLabelId} className="mb-1 mt-0 text-[12.5px] font-semibold tracking-[0.02em] text-ink-2">{t('form.rating')}</p>
        <div className="flex flex-wrap items-center gap-x-3">
          <StarInput
            ref={ratingRef}
            value={rating}
            onChange={(n) => {
              setRating(n);
              setErrors((prev) => ({ ...prev, rating: undefined }));
            }}
            labelId={ratingLabelId}
            invalid={Boolean(errors.rating)}
            {...(errors.rating ? { describedBy: ratingErrorId } : {})}
          />
          {errors.rating ? (
            <p id={ratingErrorId} className="m-0 text-[12.5px] font-medium text-danger-text">{t('form.ratingError')}</p>
          ) : null}
        </div>
      </div>

      <Field label={t('form.reviewTitle')} htmlFor={titleId} {...(fieldError('title') ? { error: fieldError('title') } : {})}>
        <Input
          id={titleId}
          value={title}
          maxLength={TITLE_MAX}
          onChange={(e) => setTitle(e.target.value)}
          invalid={Boolean(errors.title)}
          aria-describedby={`${titleId}-count${errors.title ? ` ${titleId}-error` : ''}`}
        />
        <FieldCounter id={`${titleId}-count`} value={title} max={TITLE_MAX} />
      </Field>

      <Field label={t('form.text')} htmlFor={textId} {...(fieldError('text') ? { error: fieldError('text') } : {})}>
        <Textarea
          id={textId}
          rows={5}
          value={text}
          maxLength={TEXT_MAX}
          onChange={(e) => setText(e.target.value)}
          invalid={Boolean(errors.text)}
          aria-describedby={`${textId}-count${errors.text ? ` ${textId}-error` : ''}`}
        />
        <FieldCounter id={`${textId}-count`} value={text} max={TEXT_MAX} />
      </Field>

      <p className="mb-4 mt-0 text-[13px] text-ink-3">{t('form.postedAs', { name: authorName })}</p>

      {status === 'error' || status === 'rateLimited' ? (
        <p role="alert" className="mb-4 mt-0 text-[13.5px] font-medium text-danger-text">
          {status === 'rateLimited' ? t('form.rateLimited') : t('form.error')}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={submitting}>
          {editing ? t('form.save') : t('form.submit')}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          {t('form.cancel')}
        </Button>
      </div>
    </form>
  );

  return bare ? body : <Card className="p-6">{body}</Card>;
}
