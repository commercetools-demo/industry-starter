'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useDateLabel } from './format';

/** "Cancel this subscription?" Focus starts on Keep. States when the last order was (or that none exists yet). */
export default function CancelDialog({
  open, lastOrderDate, busy, onKeep, onConfirm,
}: {
  open: boolean;
  lastOrderDate: string | null;
  busy: boolean;
  onKeep: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations('subscription.dialog');
  const date = useDateLabel();
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) body.current?.querySelector<HTMLElement>('[data-keep]')?.focus();
  }, [open]);
  return (
    <Modal open={open} onClose={onKeep} title={t('cancel.title')}>
      <div ref={body}>
      <p className="m-0 mb-5 text-[14.5px] text-ink-2" data-testid="cancel-text">
        {lastOrderDate ? t('cancel.textLast', { date: date(lastOrderDate) }) : t('cancel.textNone')}
      </p>
      <div className="flex flex-wrap gap-3 max-[519px]:flex-col">
        <Button data-keep variant="ink" onClick={onKeep} className="max-[519px]:min-h-11">
          {t('keep')}
        </Button>
        <Button variant="ghost" loading={busy} onClick={onConfirm} className="max-[519px]:min-h-11">
          {t('confirmCancel')}
        </Button>
      </div>
      </div>
    </Modal>
  );
}
