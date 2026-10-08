'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useOrderActions } from '@/hooks/use-orders';
import { Button } from '@/components/ui/Button';
import { useRouter } from '@/i18n/routing';
import { HttpError } from '@/lib/http';

/**
 * Cancel an order that has not been packed. Two steps (a button, then a plain-language confirmation) because it
 * gives back a prescription refill and releases the payment. The server decides if it is still allowed.
 */
export function CancelOrder({ orderId }: { orderId: string }) {
  const t = useTranslations('orders.cancel');
  const router = useRouter();
  const { cancel } = useOrderActions();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<'failed' | 'tooLate' | null>(null);

  async function confirm() {
    setBusy(true);
    setProblem(null);
    try {
      await cancel(orderId);
      setAsking(false);
      router.refresh();
    } catch (error) {
      setProblem(error instanceof HttpError && error.status === 409 ? 'tooLate' : 'failed');
      if (error instanceof HttpError && error.status === 409) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2.5" data-cancel-order>
      {asking ? (
        <div className="grid gap-2.5" role="group" aria-label={t('action')}>
          <p className="text-sm text-navy-900">{t('confirm')}</p>
          <div className="flex flex-wrap gap-2.5">
            <Button variant="navy" size="sm" busy={busy} onClick={() => void confirm()}>
              {t('yes')}
            </Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => setAsking(false)}>
              {t('keep')}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="justify-self-start" onClick={() => setAsking(true)}>
          {t('action')}
        </Button>
      )}
      {problem ? (
        <p role="alert" className="text-sm text-danger-700">
          {t(problem)}
        </p>
      ) : null}
    </div>
  );
}
