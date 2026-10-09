'use client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { LiveRegion } from '@/components/ui/LiveRegion';
import { Button } from '@/components/ui/Button';
import { Link, useRouter } from '@/i18n/routing';
import { useQuoteList } from '@/hooks/useQuoteList';
import { ROUTES } from '@/lib/site';

/**
 * "Add to quote list" island. Contract with workstream P:
 *   POST /api/quote-list/lines   body { serviceId: string, frequency?: string, note?: string }   -> QuoteList
 * Until that route exists the API answers 404 with no JSON error message; this component then falls back to the
 * request-a-quote form with the service preselected (`?service=<slug>`), so the control always does something useful.
 * A real API failure (JSON `{ error }`) is shown inline instead.
 */
export function AddToQuoteList({ serviceId, slug, frequencies = [] }: { serviceId: string; slug: string; frequencies?: string[] }) {
  const t = useTranslations('serviceDetail');
  const router = useRouter();
  const { list, update } = useQuoteList();
  const [frequency, setFrequency] = useState('');
  const [status, setStatus] = useState<'idle' | 'adding' | 'error'>('idle');
  const added = list.lines.some((line) => line.serviceId === serviceId);

  async function add() {
    if (added || status === 'adding') return;
    setStatus('adding');
    try {
      await update('POST', '/api/quote-list/lines', { serviceId, ...(frequency ? { frequency } : {}) });
      setStatus('idle');
    } catch (error) {
      if (error instanceof Error && error.message === 'Request failed') {
        setStatus('idle');
        router.push(`${ROUTES.quote}?service=${encodeURIComponent(slug)}`);
      } else setStatus('error');
    }
  }

  return (
    <div className="pdp-add" data-testid="add-to-quote-list">
      {frequencies.length > 1 && !added ? (
        <div className="f" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor={`freq-${serviceId}`} style={{ fontWeight: 500, fontSize: 14 }}>{t('frequency')}</label>
          <select id={`freq-${serviceId}`} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            <option value="">{t('frequencyNone')}</option>
            {frequencies.map((f) => <option key={f} value={f}>{t.has(`frequencies.${f}`) ? t(`frequencies.${f}`) : f}</option>)}
          </select>
        </div>
      ) : null}
      {added ? (
        <p role="status" data-testid="quote-list-added"><b>{t('added')}</b> <Link href={ROUTES.quoteList}>{t('viewList')}</Link></p>
      ) : (
        <Button variant="outline" onClick={add} aria-disabled={status === 'adding' || undefined}>{status === 'adding' ? t('adding') : t('addToList')}</Button>
      )}
      <LiveRegion assertive>{status === 'error' ? t('addError') : null}</LiveRegion>
      {status === 'error' ? <p className="em" aria-hidden="true">{t('addError')}</p> : null}
    </div>
  );
}
