'use client';

import { useId, useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Field, Select, Textarea } from '@/components/ui/Field';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { useToast } from '@/components/ui/Toast';
import { AccountApiError } from '@/hooks/accountRequest';
import { useOrderActions } from '@/hooks/useOrderActions';
import { useRouter } from '@/i18n/routing';
import { RETURN_NOTE_MAX, RETURN_REASONS } from '@/lib/config/postPurchase';
import { cx } from '@/lib/cx';
import type { ReturnableLine } from '@/lib/orders/postPurchaseRules';
import type { ReturnReason } from '@/lib/types';
import { ModalDialog } from './ModalDialog';

type Failure = 'quantity' | 'unavailable' | 'failed';

const failureOf = (error: unknown): Failure => {
  if (!(error instanceof AccountApiError)) return 'failed';
  if (error.code === 'QUANTITY_TOO_HIGH' || error.code === 'INVALID_ITEMS') return 'quantity';
  if (error.code === 'WINDOW_CLOSED' || error.code === 'NO_RETURNABLE_LINES' || error.code === 'ORDER_CANCELLED') return 'unavailable';
  return 'failed';
};

/** "Return a device": a button and the dialog that records the request on the order. Nothing is shipped or refunded by it (D-040). */
export function ReturnRequestDialog({ orderNumber, lines }: { orderNumber: string; lines: ReturnableLine[] }): ReactElement {
  const t = useTranslations('orders.return');
  const router = useRouter();
  const toast = useToast();
  const { requestReturn } = useOrderActions();
  const [open, setOpen] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<ReturnReason | ''>('');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const titleId = useId();

  const items = lines.flatMap((line) => ((quantities[line.lineItemId] ?? 0) > 0 ? [{ lineItemId: line.lineItemId, quantity: quantities[line.lineItemId] as number }] : []));
  const trimmed = note.trim();
  const tooLong = note.length > RETURN_NOTE_MAX;
  const valid = items.length > 0 && reason !== '' && !tooLong && (reason !== 'other' || trimmed !== '');

  function close(): void {
    if (!pending) setOpen(false);
  }

  async function submit(): Promise<void> {
    if (!valid || pending) return;
    setPending(true);
    setFailure(null);
    try {
      await requestReturn(orderNumber, { items, reason, ...(trimmed ? { note: trimmed } : {}) });
      setOpen(false);
      setPending(false);
      toast.show({ message: t('done') });
      router.refresh();
    } catch (error) {
      setPending(false);
      setFailure(failureOf(error));
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setQuantities({});
          setReason('');
          setNote('');
          setFailure(null);
          setOpen(true);
        }}
      >
        {t('button')}
      </Button>
      <ModalDialog open={open} onClose={close} labelledBy={titleId}>
        <form
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <h2 id={titleId} className="m-0 font-display text-2xl font-bold tracking-ui">
            {t('title')}
          </h2>

          <ul className="m-0 flex list-none flex-col gap-5 p-0">
            {lines.map((line) => {
              const value = quantities[line.lineItemId] ?? 0;
              return (
                <li key={line.lineItemId} className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="font-display text-md font-semibold">{line.name}</span>
                    <span className="text-sm text-text-muted">{t('quantityOf', { quantity: line.quantityAvailable, ordered: line.quantityOrdered })}</span>
                  </div>
                  <QuantityStepper
                    value={value}
                    min={0}
                    max={line.quantityAvailable}
                    onChange={(next) => setQuantities((current) => ({ ...current, [line.lineItemId]: next }))}
                    decreaseLabel={t('decrease', { name: line.name })}
                    increaseLabel={t('increase', { name: line.name })}
                    valueLabel={`${t('quantity')}: ${line.name}`}
                  />
                </li>
              );
            })}
          </ul>

          <Field label={t('reasonLabel')}>
            <Select value={reason} onChange={(event) => setReason(event.target.value as ReturnReason | '')}>
              <option value="" disabled>
                {t('reasonLabel')}
              </option>
              {RETURN_REASONS.map((value) => (
                <option key={value} value={value}>
                  {t(`reason.${value}`)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={reason === 'other' ? t('noteRequired') : t('note')}>
            <Textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} className={cx(tooLong && 'border-danger')} />
          </Field>

          <p className="m-0 text-sm text-text-muted">{t('notice')}</p>

          {failure ? (
            <p role="alert" className="m-0 text-md text-danger">
              {failure === 'quantity' ? t('error.quantity') : failure === 'unavailable' ? t('error.unavailable') : t('failed')}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={close} disabled={pending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={!valid} loading={pending}>
              {t('submit')}
            </Button>
          </div>
        </form>
      </ModalDialog>
    </>
  );
}
