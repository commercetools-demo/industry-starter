'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Inputs';
import { useRefillActions } from '@/hooks/use-auto-refill';
import { Link } from '@/i18n/routing';
import { HttpError } from '@/lib/http';
import { CADENCES, type Cadence } from '@/lib/refill-types';

/**
 * "Auto-refill this order" on an order card: a cadence and one button. The server reads the order's prescription lines,
 * re-checks each one now and names what it could not include (the answer is the same sentence the auto-refill page shows).
 */
export function OrderAutoRefill({ orderId }: { orderId: string }) {
  const t = useTranslations('autoRefill.orderCard');
  const tc = useTranslations('autoRefill.cadence');
  const ts = useTranslations('autoRefill.setup');
  const { enableOrder } = useRefillActions();
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      await enableOrder(orderId, cadence);
      setDone(true);
    } catch (e) {
      setError(e instanceof HttpError && e.message ? e.message : t('failed'));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p role="status" className="text-sm text-navy-900" data-auto-refill-done>
        {t('done')}{' '}
        <Link href="/account/auto-refill" className="text-text-link">
          {t('view')}
        </Link>
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-end gap-2.5" data-order-auto-refill>
      <Select label={ts('howOften')} value={cadence} onChange={(e) => setCadence(e.target.value as Cadence)} fieldClassName="min-w-48">
        {CADENCES.map((c) => (
          <option key={c} value={c}>
            {tc(c)}
          </option>
        ))}
      </Select>
      <Button variant="outline" size="sm" busy={busy} onClick={() => void enable()}>
        {busy ? t('busy') : t('button')}
      </Button>
      {error ? (
        <p role="alert" className="basis-full text-sm text-danger-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
