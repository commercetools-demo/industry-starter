'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Dialog } from '@/components/portal/Dialog';
import { FormField } from '@/components/portal/FormField';
import { buttonPrimary, buttonSecondary, errorNote, hintClass, inputClass, selectClass } from '@/components/portal/kit';
import { returnApi } from '@/hooks/vApi';
import { RETURN_REASONS, RETURN_WINDOW_DAYS } from '@/lib/contracts/return-item';
import { shortDate } from '@/lib/v-format';
import type { OrderForReturn } from '@/lib/v-types';
import { returnsErrorKey } from './errors';

const textareaClass =
  'min-h-3200 w-full rounded-300 border border-border bg-bg-surface px-300 py-250 text-body-2 font-medium text-text placeholder:text-text-disabled focus-visible:outline-2 focus-visible:outline-border-active';

/** "Record a return": order number, the order's lines with quantities, reason and comment; shows the 30 day window and the delivery date. */
export function RecordReturnDialog({ open, storeKey, onClose, onCreated }: { open: boolean; storeKey: string; onClose: () => void; onCreated: (result: { returnNumber: string; tracking: string }) => void }) {
  const t = useTranslations('returns');
  const locale = useLocale();
  const [orderNumber, setOrderNumber] = useState('');
  const [order, setOrder] = useState<OrderForReturn | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<string>(RETURN_REASONS[0]);
  const [comment, setComment] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setOrderNumber('');
    setOrder(null);
    setQuantities({});
    setComment('');
    setProblem('');
  };
  const close = () => {
    reset();
    onClose();
  };

  async function lookup() {
    setProblem('');
    setOrder(null);
    const result = await returnApi.lookupOrder(storeKey, orderNumber.trim());
    if (!result.ok || !result.data) return setProblem(t(returnsErrorKey(result, (k) => t.has(k)) as 'errors.generic'));
    setOrder(result.data);
    setQuantities({});
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!order) return;
    const items = Object.entries(quantities)
      .filter(([, q]) => q > 0)
      .map(([lineItemId, quantity]) => ({ lineItemId, quantity }));
    if (items.length === 0) return setProblem(t('record.noLines'));
    setBusy(true);
    const result = await returnApi.create(storeKey, { orderNumber: order.orderNumber, items, reason, ...(comment.trim() ? { comment: comment.trim() } : {}) });
    setBusy(false);
    if (!result.ok || !result.data) return setProblem(t(returnsErrorKey(result, (k) => t.has(k)) as 'errors.generic'));
    reset();
    onCreated(result.data);
  }

  const blocked = order !== null && (order.deliveredAt === null || !order.windowOpen);

  return (
    <Dialog
      open={open}
      title={t('record.title')}
      onClose={close}
      footer={
        <>
          <button type="button" className={buttonSecondary} onClick={close}>
            {t('record.cancel')}
          </button>
          <button type="submit" form="record-return-form" className={buttonPrimary} disabled={busy || !order || blocked}>
            {t('record.submit')}
          </button>
        </>
      }
    >
      <form id="record-return-form" onSubmit={submit} noValidate className="flex flex-col gap-400">
        <p className={hintClass}>{t('record.window', { days: RETURN_WINDOW_DAYS })}</p>
        <div className="flex items-end gap-200">
          <div className="flex-1">
            <FormField id="return-order" label={t('record.order')}>
              <input id="return-order" className={inputClass} value={orderNumber} autoComplete="off" onChange={(e) => setOrderNumber(e.target.value)} />
            </FormField>
          </div>
          <button type="button" className={buttonSecondary} disabled={!orderNumber.trim()} onClick={() => void lookup()}>
            {t('record.lookup')}
          </button>
        </div>
        {order ? (
          <>
            <p className="text-body-2 font-semibold text-text">{order.deliveredAt ? t('record.deliveredOn', { date: shortDate(order.deliveredAt, locale) }) : t('record.notDelivered')}</p>
            {order.deliveredAt && !order.windowOpen ? <p className={errorNote}>{t('record.closed')}</p> : null}
            <fieldset className="flex flex-col gap-200" disabled={blocked}>
              <legend className="text-body-2 font-semibold text-text">{t('record.lines')}</legend>
              {order.lines.map((line) => (
                <div key={line.lineItemId} className="flex items-center justify-between gap-300">
                  <label htmlFor={`qty-${line.lineItemId}`} className="text-body-2 text-text">
                    {line.name}
                    <span className="block text-caption-1 text-text-subdued">{t('record.available', { count: line.available })}</span>
                  </label>
                  <input
                    id={`qty-${line.lineItemId}`}
                    aria-label={t('record.quantity', { name: line.name })}
                    type="number"
                    min={0}
                    max={line.available}
                    className={`${inputClass} max-w-1600`}
                    value={quantities[line.lineItemId] ?? 0}
                    disabled={line.available === 0}
                    onChange={(e) => setQuantities({ ...quantities, [line.lineItemId]: Math.max(0, Math.min(line.available, Number(e.target.value) || 0)) })}
                  />
                </div>
              ))}
            </fieldset>
            <FormField id="return-reason" label={t('record.reason')}>
              <select id="return-reason" className={selectClass} value={reason} onChange={(e) => setReason(e.target.value)}>
                {RETURN_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`reasons.${r}`)}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="return-comment" label={t('record.comment')}>
              <textarea id="return-comment" className={textareaClass} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
            </FormField>
          </>
        ) : null}
        {problem ? (
          <p role="alert" className={errorNote}>
            {problem}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
