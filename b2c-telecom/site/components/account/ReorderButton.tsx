'use client';

import { useEffect, useId, useRef, useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useReorder } from '@/hooks/useReorder';
import { useRouter } from '@/i18n/routing';

/**
 * "Buy again". The server copies the order into a new bundle; lines that could not be reused are listed in a dialog before the buyer
 * is taken to My bundle (nothing is dropped silently). A complete copy goes straight there with a confirmation toast.
 */
export function ReorderButton({ orderNumber }: { orderNumber: string }): ReactElement {
  const t = useTranslations('account');
  const router = useRouter();
  const toast = useToast();
  const { reorder } = useReorder();
  const [pending, setPending] = useState(false);
  const [missing, setMissing] = useState<string[] | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (missing !== null && !element.open) {
      if (typeof element.showModal === 'function') element.showModal();
      else element.setAttribute('open', '');
    }
  }, [missing]);

  async function onClick(): Promise<void> {
    setPending(true);
    try {
      const result = await reorder(orderNumber);
      if (result.unavailable.length > 0) {
        setMissing(result.unavailable.map((item) => item.name));
        setPending(false);
        return;
      }
      toast.show({ message: t('reorder.done') });
      router.push('/bundle');
    } catch {
      toast.show({ message: t('reorder.error'), tone: 'error' });
      setPending(false);
    }
  }

  return (
    <>
      <Button variant="secondary" loading={pending} onClick={onClick} data-print="hide">
        {pending ? t('reorder.pending') : t('order.buyAgain')}
      </Button>
      <dialog ref={dialog} aria-labelledby={titleId} className="m-auto w-full max-w-md rounded-xl border border-border bg-surface p-7 text-text backdrop:bg-overlay">
        <h2 id={titleId} className="m-0 mb-3 font-display text-2xl font-bold">
          {t('reorder.unavailableTitle')}
        </h2>
        <p className="m-0 mb-6 text-md">{t('reorder.unavailable', { names: (missing ?? []).join(', ') })}</p>
        <div className="flex justify-end">
          <Button
            onClick={() => {
              if (typeof dialog.current?.close === 'function') dialog.current.close();
              router.push('/bundle');
            }}
          >
            {t('reorder.continue')}
          </Button>
        </div>
      </dialog>
    </>
  );
}
