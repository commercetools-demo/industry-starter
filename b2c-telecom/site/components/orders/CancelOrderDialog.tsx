'use client';

import { useId, useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Field, Textarea } from '@/components/ui/Field';
import { FOCUS_RING_ON_DARK } from '@/components/ui/focus';
import { SpinnerIcon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { AccountApiError } from '@/hooks/accountRequest';
import { useOrderActions } from '@/hooks/useOrderActions';
import { useRouter } from '@/i18n/routing';
import { CANCEL_NOTE_MAX, CANCEL_REASONS } from '@/lib/config/postPurchase';
import { cx } from '@/lib/cx';
import type { CancelBlock } from '@/lib/orders/postPurchaseRules';
import type { CancelReason } from '@/lib/types';
import { ModalDialog } from './ModalDialog';

export interface EtfRow {
  lineId: string;
  name: string;
  /** The early-termination fee text exactly as stored on the order's label. */
  fee: string;
}

type Failure = { kind: 'blocked'; block: CancelBlock } | { kind: 'failed' } | null;

const BLOCKS: readonly CancelBlock[] = ['SERVICE_STARTED', 'NO_START_DATE', 'EQUIPMENT_SHIPPED', 'HAS_RETURN'];
const isBlock = (value: unknown): value is CancelBlock => typeof value === 'string' && (BLOCKS as readonly string[]).includes(value);

/**
 * "Cancel order": a button and the confirmation dialog. The server decides again (eligibility, ownership); this only asks for the reason,
 * shows the early-termination fee text stored on the order (never computed) and reports the answer. Safe to retry: cancelling twice is a no-op.
 */
export function CancelOrderDialog({ orderNumber, etfRows }: { orderNumber: string; etfRows: EtfRow[] }): ReactElement {
  const t = useTranslations('orders.cancel');
  const router = useRouter();
  const toast = useToast();
  const { cancel } = useOrderActions();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<CancelReason | null>(null);
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure>(null);
  const titleId = useId();
  const groupId = useId();

  const trimmed = note.trim();
  const tooLong = note.length > CANCEL_NOTE_MAX;
  const valid = reason !== null && !tooLong && (reason !== 'other' || trimmed !== '');
  const blocked = failure?.kind === 'blocked';

  function close(): void {
    if (pending) return;
    setOpen(false);
  }

  async function submit(): Promise<void> {
    if (!valid || reason === null || pending) return;
    setPending(true);
    setFailure(null);
    try {
      await cancel(orderNumber, { reason, ...(trimmed ? { note: trimmed } : {}) });
      setOpen(false);
      setPending(false);
      toast.show({ message: t('done') });
      router.refresh();
    } catch (error) {
      setPending(false);
      const block = error instanceof AccountApiError && error.code === 'NOT_CANCELLABLE' ? error.details?.block : undefined;
      setFailure(isBlock(block) ? { kind: 'blocked', block } : { kind: 'failed' });
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setReason(null);
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
            {t('title', { orderNumber })}
          </h2>
          <p className="m-0 text-md">{t('intro')}</p>

          <fieldset className="m-0 flex flex-col gap-3 border-0 p-0" aria-labelledby={groupId}>
            <legend id={groupId} className="mb-3 p-0 font-display text-sm font-semibold tracking-ui">
              {t('why')}
            </legend>
            {CANCEL_REASONS.map((value) => (
              <label key={value} className="flex min-h-11 items-center gap-3 text-md">
                <input type="radio" name="cancel-reason" value={value} checked={reason === value} onChange={() => setReason(value)} className="size-5 accent-action" />
                {t(`reason.${value}`)}
              </label>
            ))}
          </fieldset>

          <Field label={reason === 'other' ? t('noteRequired') : t('note')}>
            <Textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} aria-describedby={`${titleId}-count`} />
          </Field>
          <p id={`${titleId}-count`} className={cx('m-0 -mt-3 text-sm', tooLong ? 'text-danger' : 'text-text-muted')}>
            {t('noteCount', { count: note.length, max: CANCEL_NOTE_MAX })}
          </p>

          <section aria-labelledby={`${titleId}-etf`} className="flex flex-col gap-2 rounded-lg border border-border p-5">
            <h3 id={`${titleId}-etf`} className="m-0 font-display text-md font-semibold">
              {t('etf.title')}
            </h3>
            {etfRows.length > 0 ? (
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-md">
                {etfRows.map((row) => (
                  <li key={row.lineId}>{t('etf.line', { name: row.name, fee: row.fee })}</li>
                ))}
              </ul>
            ) : null}
            <p className="m-0 text-sm text-text-muted">{t('etf.note')}</p>
          </section>

          {failure ? (
            <p role="alert" className="m-0 text-md text-danger">
              {failure.kind === 'blocked' ? t(`block.${failure.block}`) : t('failed')}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {blocked ? (
              <Button type="button" onClick={close} block>
                {t('close')}
              </Button>
            ) : (
              <>
                <Button type="button" variant="ghost" onClick={close} disabled={pending}>
                  {t('keep')}
                </Button>
                <button
                  type="submit"
                  disabled={!valid || pending}
                  aria-busy={pending || undefined}
                  className={cx(
                    'inline-flex min-h-11 items-center justify-center gap-3 rounded-pill bg-danger px-6 font-cta text-md font-extrabold text-text-on-pink disabled:cursor-not-allowed disabled:opacity-50',
                    FOCUS_RING_ON_DARK,
                  )}
                >
                  {pending ? <SpinnerIcon className="motion-safe:animate-spin" /> : null}
                  {t('confirm')}
                </button>
              </>
            )}
          </div>
        </form>
      </ModalDialog>
    </>
  );
}
