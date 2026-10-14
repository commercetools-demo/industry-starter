'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { KpiTile, StateTabs } from '@/components/customers/shared';
import { REPLY_LIMIT } from '@/components/customers/limits';
import { Chip } from '@/components/portal/Chip';
import { Dialog } from '@/components/portal/Dialog';
import { FormField } from '@/components/portal/FormField';
import { buttonPrimary, buttonSecondary, buttonSmall, errorNote, infoNote } from '@/components/portal/kit';
import { useToast } from '@/context/ToastContext';
import { useViewer } from '@/context/ViewerContext';
import { usePermissions } from '@/hooks/usePermissions';
import { reviewApi, useReviews } from '@/hooks/vApi';
import { oneDecimal, shortDate } from '@/lib/v-format';
import type { ReviewRow, ReviewTab } from '@/lib/v-types';

const textareaClass =
  'min-h-3200 w-full rounded-300 border border-border-input bg-bg-surface px-300 py-250 text-body-2 font-medium text-text placeholder:text-text-disabled focus-visible:outline-2 focus-visible:outline-border-active';

/** Reviews (V-16): tabs Latest, Highest and Lowest, KPIs, a public reply and show or hide. */
export function ReviewsPage() {
  const t = useTranslations('reviews');
  const locale = useLocale();
  const { toast } = useToast();
  const { storeKey } = useViewer();
  const { can } = usePermissions();
  const [tab, setTab] = useState<ReviewTab>('latest');
  const { data, error, mutate } = useReviews(storeKey, tab, locale);
  const [replying, setReplying] = useState<ReviewRow | null>(null);
  const [text, setText] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const moderate = can('reviews.moderate');

  const fail = (status: number, code?: string) => setProblem(status === 403 ? t('errors.forbidden') : code === 'REPLY_INVALID' ? t('errors.REPLY_INVALID') : t('errors.generic'));

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!replying) return;
    setBusy(true);
    setProblem('');
    const result = await reviewApi.reply(storeKey, replying.id, text);
    setBusy(false);
    if (!result.ok) return fail(result.status, result.code);
    setReplying(null);
    toast(t('reply.posted'));
    void mutate();
  }

  async function toggle(review: ReviewRow) {
    const next = review.visibility === 'hidden' ? 'published' : 'hidden';
    const result = await reviewApi.setVisibility(storeKey, review.id, next);
    if (!result.ok) return fail(result.status, result.code);
    toast(next === 'hidden' ? t('hidden') : t('shown'));
    void mutate();
  }

  return (
    <div className="flex flex-col gap-400">
      <div className="grid grid-cols-1 gap-300 sm:grid-cols-3">
        <KpiTile id="average" label={t('kpis.average')} value={data ? oneDecimal(data.kpis.average, locale) : '-'} />
        <KpiTile id="month" label={t('kpis.month')} value={data ? new Intl.NumberFormat(locale).format(data.kpis.thisMonth) : '-'} />
        <KpiTile id="unanswered" label={t('kpis.unanswered')} value={data ? new Intl.NumberFormat(locale).format(data.kpis.unanswered) : '-'} />
      </div>
      <StateTabs ariaLabel={t('tabsLabel')} value={tab} onChange={setTab} tabs={(['latest', 'highest', 'lowest'] as const).map((id) => ({ id, label: t(`tabs.${id}`) }))} />
      {problem && !replying ? (
        <p role="alert" className={errorNote}>
          {problem}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className={errorNote}>
          {t('error')}
        </p>
      ) : !data ? (
        <p role="status" className={infoNote}>
          {t('loading')}
        </p>
      ) : data.rows.length === 0 ? (
        <p className={infoNote}>{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-300">
          {data.rows.map((review) => (
            <li key={review.id} data-testid={`review-${review.id}`} className="flex flex-col gap-200 rounded-200 bg-bg-surface p-500 shadow-card">
              <div className="flex flex-wrap items-center gap-200">
                <p className="text-title-1 font-semibold text-text">{review.productName}</p>
                <Chip tone={review.rating >= 4 ? 'success' : review.rating >= 3 ? 'neutral' : 'warning'}>{t('stars', { rating: review.rating })}</Chip>
                {review.visibility === 'hidden' ? <Chip tone="critical">{t('hiddenChip')}</Chip> : null}
              </div>
              {review.title ? <p className="text-body-2 font-semibold text-text">{review.title}</p> : null}
              <p className="text-body-2 text-text">{review.text}</p>
              <p className="text-caption-1 text-text-subdued">{t('by', { author: review.author, date: shortDate(review.createdAt, locale) })}</p>
              {review.reply ? (
                <div className="rounded-300 bg-bg-surface-subdued p-300 text-body-2">
                  <p className="font-semibold text-text-subdued">{review.reply.by ? t('reply.from', { store: review.reply.by }) : null}</p>
                  <p className="text-text">{review.reply.text}</p>
                </div>
              ) : null}
              {moderate ? (
                <div className="flex flex-wrap gap-200">
                  <button
                    type="button"
                    className={buttonSmall}
                    onClick={() => {
                      setReplying(review);
                      setText(review.reply?.text ?? '');
                      setProblem('');
                    }}
                  >
                    {review.reply ? t('reply.edit') : t('reply.button')}
                  </button>
                  <button type="button" className={buttonSmall} onClick={() => void toggle(review)}>
                    {review.visibility === 'hidden' ? t('show') : t('hide')}
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={replying !== null}
        title={t('reply.title', { product: replying?.productName ?? '' })}
        onClose={() => setReplying(null)}
        footer={
          <>
            <button type="button" className={buttonSecondary} onClick={() => setReplying(null)}>
              {t('reply.cancel')}
            </button>
            <button type="submit" form="review-reply-form" className={buttonPrimary} disabled={busy || !text.trim()}>
              {t('reply.submit')}
            </button>
          </>
        }
      >
        <form id="review-reply-form" onSubmit={send} noValidate className="flex flex-col gap-300">
          <FormField id="review-reply" label={t('reply.label')} hint={t('reply.hint')}>
            <textarea id="review-reply" className={textareaClass} maxLength={REPLY_LIMIT} value={text} onChange={(e) => setText(e.target.value)} />
          </FormField>
          {problem ? (
            <p role="alert" className={errorNote}>
              {problem}
            </p>
          ) : null}
        </form>
      </Dialog>
    </div>
  );
}
