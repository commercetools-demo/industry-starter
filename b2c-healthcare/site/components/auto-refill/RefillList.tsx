'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Inputs';
import { ResumeBlocked, useRefillActions } from '@/hooks/use-auto-refill';
import { useRouter } from '@/i18n/routing';
import { formatIsoDate } from '@/lib/format-date';
import { CADENCES, type Cadence, type RefillAction, type RefillState, type RefillView } from '@/lib/refill-types';
import { RefillLastRun } from './RefillLastRun';

const STATE_VARIANT: Record<RefillState, BadgeVariant> = { Active: 'ok', Paused: 'wait', Expired: 'neutral', Canceled: 'neutral', Failed: 'no' };
const day = (iso: string) => iso.slice(0, 10);

function RefillCard({ refill }: { refill: RefillView }) {
  const t = useTranslations('autoRefill');
  const locale = useLocale();
  const router = useRouter();
  const { act, changeCadence } = useRefillActions();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [cadence, setCadence] = useState<Cadence>(refill.cadence === 'other' ? 'monthly' : refill.cadence);

  const live = refill.state === 'Active' || refill.state === 'Paused' || refill.state === 'Failed';

  async function run(action: RefillAction) {
    setBusy(action);
    setMessage(null);
    try {
      await act(refill.id, action);
      setConfirming(false);
      router.refresh();
    } catch (error) {
      if (error instanceof ResumeBlocked) setMessage(t(`resumeBlocked.${error.reason}` as 'resumeBlocked.ceiling'));
      else setMessage(error instanceof Error && error.message === 'BUSY' ? t('busy') : t('failed'));
    } finally {
      setBusy(null);
    }
  }

  async function saveSchedule() {
    setBusy('schedule');
    setMessage(null);
    try {
      await changeCadence(refill.id, cadence);
      router.refresh();
    } catch {
      setMessage(t('failed'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card as="article" className="grid gap-3" data-refill-card data-refill-state={refill.state}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-meta text-base font-bold text-navy-900">{refill.lines.map((l) => l.name).join(', ')}</h2>
          <p className="text-sm text-neutral-600">{t(`cadence.${refill.cadence}`)}</p>
        </div>
        <Badge variant={STATE_VARIANT[refill.state]}>{t(`state.${refill.state}`)}</Badge>
      </div>

      <div className="grid gap-1 text-sm text-navy-900" data-refill-status>
        {refill.state === 'Active' && refill.nextOrderAt ? <p>{refill.skipping ? t('nextSkipping', { date: formatIsoDate(day(refill.nextOrderAt), locale) }) : t('next', { date: formatIsoDate(day(refill.nextOrderAt), locale) })}</p> : null}
        {refill.state === 'Paused' ? <p>{t('pausedNote')}</p> : null}
        {refill.state === 'Canceled' || refill.state === 'Expired' ? <p>{t('canceledNote')}</p> : null}
        {refill.state === 'Failed' ? <p className="text-danger-700">{t('failedNote')}</p> : null}
        <p className="text-neutral-600" data-last-order>
          {refill.lastOrderAt ? (refill.state === 'Active' ? t('last', { date: formatIsoDate(day(refill.lastOrderAt), locale) }) : t('lastWas', { date: formatIsoDate(day(refill.lastOrderAt), locale) })) : t('noLast')}
        </p>
        <p className="text-neutral-600" data-price-mode={refill.priceMode}>
          {refill.priceMode === 'Dynamic' ? t('priceDynamic') : t('priceFixed')}
        </p>
      </div>

      {refill.lastRun ? <RefillLastRun run={refill.lastRun} /> : null}

      {live ? (
        <div className="grid gap-3 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {refill.state === 'Active' ? (
              <>
                <Button variant="outline" size="sm" busy={busy === 'pause'} onClick={() => void run('pause')}>
                  {t('pause')}
                </Button>
                <Button variant="outline" size="sm" busy={busy === 'skip'} disabled={refill.skipping} onClick={() => void run('skip')}>
                  {t('skip')}
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" busy={busy === 'resume'} onClick={() => void run('resume')}>
                {t('resume')}
              </Button>
            )}
            {confirming ? (
              <>
                <span className="text-sm text-navy-900">{t('cancelConfirm')}</span>
                <Button variant="navy" size="sm" busy={busy === 'cancel'} onClick={() => void run('cancel')}>
                  {t('cancelYes')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
                  {t('keep')}
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
                {t('cancel')}
              </Button>
            )}
          </div>
          {refill.state !== 'Failed' ? (
            <div className="flex flex-wrap items-end gap-2.5">
              <Select label={t('scheduleLabel')} value={cadence} onChange={(e) => setCadence(e.target.value as Cadence)} fieldClassName="min-w-48">
                {CADENCES.map((c) => (
                  <option key={c} value={c}>
                    {t(`cadence.${c}`)}
                  </option>
                ))}
              </Select>
              <Button size="sm" busy={busy === 'schedule'} disabled={cadence === refill.cadence} onClick={() => void saveSchedule()}>
                {t('scheduleSave')}
              </Button>
              <p className="basis-full text-sm text-neutral-600">{t('scheduleNote')}</p>
            </div>
          ) : null}
        </div>
      ) : null}
      {message ? (
        <p role="alert" className="text-sm text-danger-700">
          {message}
        </p>
      ) : null}
    </Card>
  );
}

/** The customer's auto-refills, newest first. `refills: null` means the read failed. */
export function RefillList({ refills }: { refills: RefillView[] | null }) {
  const t = useTranslations('autoRefill');
  if (refills === null) {
    return (
      <p role="status" className="text-danger-700">
        {t('loadFailed')}
      </p>
    );
  }
  if (refills.length === 0) {
    return (
      <Card className="grid gap-1 py-6 text-center" data-refill-empty>
        <h2 className="font-display text-xl font-semibold text-navy-900">{t('empty')}</h2>
        <p className="text-neutral-600">{t('emptyHint')}</p>
      </Card>
    );
  }
  return (
    <div className="grid gap-4" data-refill-list>
      {refills.map((refill) => (
        <RefillCard key={refill.id} refill={refill} />
      ))}
    </div>
  );
}
