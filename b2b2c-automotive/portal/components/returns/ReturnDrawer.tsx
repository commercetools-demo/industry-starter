'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Chip } from '@/components/portal/Chip';
import { Dialog } from '@/components/portal/Dialog';
import { FormField } from '@/components/portal/FormField';
import { buttonPrimary, buttonSecondary, errorNote, hintClass, infoNote, inputClass, successNote } from '@/components/portal/kit';
import { useToast } from '@/context/ToastContext';
import { returnApi, useReturn } from '@/hooks/vApi';
import type { ReturnStatus } from '@/lib/contracts/return-item';
import { money } from '@/lib/v-format';
import { returnsErrorKey } from './errors';
import { ReturnActions } from './ReturnActions';
import { StatusChip } from './StatusChip';

const textareaClass =
  'min-h-3200 w-full rounded-300 border border-border bg-bg-surface px-300 py-250 text-body-2 font-medium text-text placeholder:text-text-disabled focus-visible:outline-2 focus-visible:outline-border-active';

/** Parses "12,50" or "12.50" into cents; null for anything that is not a positive amount. */
export function parseAmount(text: string): number | null {
  const n = Number(text.trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 && /^\d+([.,]\d{1,2})?$/.test(text.trim()) ? Math.round(n * 100) : null;
}

/** Return detail drawer (V-13): facts, the lifecycle actions, the refund dialog and the reject dialog. */
export function ReturnDrawer({ storeKey, number, canProcess, onClose, onChanged }: { storeKey: string; number: string | null; canProcess: boolean; onClose: () => void; onChanged: () => void }) {
  const t = useTranslations('returns');
  const locale = useLocale();
  const { toast } = useToast();
  const { data, error, mutate } = useReturn(storeKey, number, locale);
  const [dialog, setDialog] = useState<'refund' | 'reject' | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const fail = (result: { status: number; code?: string }) => setProblem(t(returnsErrorKey(result, (k) => t.has(k)) as 'errors.generic'));
  const done = () => {
    void mutate();
    onChanged();
  };

  async function move(to: ReturnStatus) {
    if (!number) return;
    setBusy(true);
    setProblem('');
    setNote('');
    const result = await returnApi.transition(storeKey, number, { to });
    setBusy(false);
    if (!result.ok) return fail(result);
    toast(t('moved', { number, status: t(`status.${to}`) }));
    done();
  }

  async function refund(event: FormEvent) {
    event.preventDefault();
    if (!number) return;
    const cents = parseAmount(amount);
    if (cents === null) return setProblem(t('refundDialog.invalidAmount'));
    setBusy(true);
    setProblem('');
    const result = await returnApi.transition(storeKey, number, { to: 'refunded', refundCents: cents });
    setBusy(false);
    if (!result.ok) return fail(result);
    setDialog(null);
    setNote(result.data?.refund?.noPayment ? t('refundDialog.noPayment') : t('refundDialog.requested'));
    toast(result.data?.refund?.noPayment ? t('refundDialog.noPayment') : t('refundDialog.requested'));
    done();
  }

  async function reject(event: FormEvent) {
    event.preventDefault();
    if (!number) return;
    if (!reason.trim()) return setProblem(t('rejectDialog.required'));
    setBusy(true);
    setProblem('');
    const result = await returnApi.transition(storeKey, number, { to: 'rejected', reason: reason.trim() });
    setBusy(false);
    if (!result.ok) return fail(result);
    setDialog(null);
    toast(t('moved', { number, status: t('status.rejected') }));
    done();
  }

  const openRefund = () => {
    setProblem('');
    setAmount(data?.maxRefundCents ? (data.maxRefundCents / 100).toFixed(2) : '');
    setDialog('refund');
  };
  const openReject = () => {
    setProblem('');
    setReason('');
    setDialog('reject');
  };
  const closeDialog = () => {
    setDialog(null);
    setProblem('');
  };

  return (
    <>
      <Dialog
        open={number !== null && dialog === null}
        variant="drawer"
        title={number ?? ''}
        onClose={onClose}
        footer={
          <button type="button" className={buttonSecondary} onClick={onClose}>
            {t('detail.close')}
          </button>
        }
      >
        {error ? (
          <p role="alert" className={errorNote}>
            {t('detail.error')}
          </p>
        ) : !data ? (
          <p role="status" className={infoNote}>
            {t('detail.loading')}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-200">
              <StatusChip status={data.status} refundState={data.refundState} />
              {data.reason === 'wrong-fit' ? <Chip tone="warning">{t('wrongFit.chip')}</Chip> : null}
            </div>
            <dl className="grid grid-cols-1 gap-250 text-body-2">
              <div>
                <dt className="font-semibold text-text-subdued">{t('detail.customer')}</dt>
                <dd>{data.customer}</dd>
              </div>
              <div>
                <dt className="font-semibold text-text-subdued">{t('detail.order')}</dt>
                <dd>{data.orderNumber}</dd>
              </div>
              <div>
                <dt className="font-semibold text-text-subdued">{t('detail.tracking')}</dt>
                <dd>{data.tracking}</dd>
              </div>
              <div>
                <dt className="font-semibold text-text-subdued">{t('detail.reason')}</dt>
                <dd>{t(`reasons.${data.reason}` as 'reasons.other')}</dd>
              </div>
              {data.comment ? (
                <div>
                  <dt className="font-semibold text-text-subdued">{t('detail.comment')}</dt>
                  <dd>{data.comment}</dd>
                </div>
              ) : null}
              <div>
                <dt className="font-semibold text-text-subdued">{t('detail.items')}</dt>
                <dd>
                  <ul>
                    {data.lines.map((l) => (
                      <li key={l.returnItemId}>{`${l.quantity}x ${l.name}`}</li>
                    ))}
                  </ul>
                </dd>
              </div>
              {data.refundCents !== null && data.status === 'refunded' ? (
                <div>
                  <dt className="font-semibold text-text-subdued">{t('detail.refunded')}</dt>
                  <dd>{money(data.refundCents, data.currency, locale)}</dd>
                </div>
              ) : null}
              {data.rejectReason ? (
                <div>
                  <dt className="font-semibold text-text-subdued">{t('detail.rejectReason')}</dt>
                  <dd>{data.rejectReason}</dd>
                </div>
              ) : null}
            </dl>
            {data.fitting ? (
              <section aria-label={t('wrongFit.chip')} className="flex flex-col gap-100 rounded-300 bg-bg-surface-subdued p-300 text-body-2">
                {data.fitting.vehicle ? (
                  <>
                    <p>
                      <span className="font-semibold">{t('wrongFit.vehicle')}: </span>
                      {data.fitting.vehicle}
                    </p>
                    {data.fitting.fit ? (
                      <p>
                        <span className="font-semibold">{t('wrongFit.fit')}: </span>
                        {t(`wrongFit.${data.fitting.fit}` as 'wrongFit.fits')}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p>{t('wrongFit.notRecorded')}</p>
                )}
              </section>
            ) : null}
            {data.status === 'inspected' && data.maxRefundCents !== null ? <p className={hintClass}>{t('detail.maxRefund', { amount: money(data.maxRefundCents, data.currency, locale) })}</p> : null}
            {canProcess ? <ReturnActions status={data.status} refundState={data.refundState} busy={busy} onMove={(to) => void move(to)} onRefund={openRefund} onReject={openReject} /> : null}
            {note ? <p role="status" className={successNote}>{note}</p> : null}
            {problem && dialog === null ? (
              <p role="alert" className={errorNote}>
                {problem}
              </p>
            ) : null}
          </>
        )}
      </Dialog>

      <Dialog
        open={dialog === 'refund'}
        title={t('refundDialog.title', { number: number ?? '' })}
        onClose={closeDialog}
        footer={
          <>
            <button type="button" className={buttonSecondary} onClick={closeDialog}>
              {t('refundDialog.cancel')}
            </button>
            <button type="submit" form="refund-form" className={buttonPrimary} disabled={busy}>
              {t('refundDialog.submit')}
            </button>
          </>
        }
      >
        <form id="refund-form" onSubmit={refund} noValidate className="flex flex-col gap-300">
          <FormField id="refund-amount" label={t('refundDialog.amount')} hint={t('refundDialog.hint')}>
            <input id="refund-amount" className={inputClass} inputMode="decimal" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </FormField>
          {problem ? (
            <p role="alert" className={errorNote}>
              {problem}
            </p>
          ) : null}
        </form>
      </Dialog>

      <Dialog
        open={dialog === 'reject'}
        title={t('rejectDialog.title', { number: number ?? '' })}
        onClose={closeDialog}
        footer={
          <>
            <button type="button" className={buttonSecondary} onClick={closeDialog}>
              {t('rejectDialog.cancel')}
            </button>
            <button type="submit" form="reject-form" className={buttonPrimary} disabled={busy}>
              {t('rejectDialog.submit')}
            </button>
          </>
        }
      >
        <form id="reject-form" onSubmit={reject} noValidate className="flex flex-col gap-300">
          <FormField id="reject-reason" label={t('rejectDialog.reason')}>
            <textarea id="reject-reason" className={textareaClass} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </FormField>
          {problem ? (
            <p role="alert" className={errorNote}>
              {problem}
            </p>
          ) : null}
        </form>
      </Dialog>
    </>
  );
}
