'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { buttonDanger, buttonPrimary, buttonSecondary, buttonSmall } from '@/components/portal/kit';
import { Dialog } from '@/components/portal/Dialog';
import { actionTarget } from '@/lib/subscriptions/model';
import type { SubscriptionAction, SubscriptionRow } from '@/lib/v-types';

/**
 * Row actions of a subscription: Pause or Resume (never both), Skip next and Cancel (with a confirmation). An action the state does not
 * allow is disabled with its reason as text linked by `aria-describedby`; the outcome is announced in a `role="status"` region.
 * `onRun` performs the call and resolves to an error text, or null on success.
 */
export function SubscriptionActions({
  row,
  onRun,
  onAudit,
}: {
  row: Pick<SubscriptionRow, 'id' | 'state' | 'status' | 'skipsRemaining'>;
  onRun: (action: SubscriptionAction) => Promise<string | null>;
  onAudit?: () => void;
}) {
  const t = useTranslations('subscriptions');
  const base = useId();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState('');
  const [announce, setAnnounce] = useState('');

  const paused = row.state === 'Paused';
  const toggle: SubscriptionAction = paused ? 'resume' : 'pause';
  const final = actionTarget(row.state, 'cancel') === null;

  const reason = (action: SubscriptionAction): string | null => {
    if (actionTarget(row.state, action) !== null) {
      if (action === 'skip' && row.skipsRemaining > 0) return t('reasons.skipPending');
      return null;
    }
    if (final) return t('reasons.final');
    if (action === 'skip') return t('reasons.skipNotActive');
    return t('reasons.notAllowed');
  };

  async function run(action: SubscriptionAction) {
    setBusy(true);
    setProblem('');
    setAnnounce('');
    const error = await onRun(action);
    setBusy(false);
    setConfirming(false);
    if (error) setProblem(error);
    else setAnnounce(t(`toasts.${action}`));
  }

  const item = (action: SubscriptionAction, label: string, className: string, onClick: () => void) => {
    const why = reason(action);
    const id = `${base}-${action}`;
    return (
      <li className="flex max-w-3200 flex-col items-start gap-100">
        <button type="button" className={className} disabled={busy || why !== null} aria-describedby={why ? id : undefined} onClick={onClick}>
          {label}
        </button>
        {why ? (
          <span id={id} className="text-caption-1 font-medium text-text-subdued">
            {why}
          </span>
        ) : null}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-150">
      <ul className="flex flex-wrap items-start gap-200" aria-label={t('actions.label')}>
        {item(toggle, t(`actions.${toggle}`), buttonSmall, () => void run(toggle))}
        {item('skip', t('actions.skip'), buttonSmall, () => void run('skip'))}
        {item('cancel', t('actions.cancel'), buttonDanger, () => setConfirming(true))}
      </ul>
      {onAudit ? (
        <button type="button" className={buttonSmall} onClick={onAudit}>
          {t('actions.audit')}
        </button>
      ) : null}
      <p role="status" aria-live="polite" className="text-caption-1 font-semibold text-text">
        {problem || announce}
      </p>
      <Dialog
        open={confirming}
        title={t('confirm.title')}
        onClose={() => setConfirming(false)}
        footer={
          <>
            <button type="button" className={buttonSecondary} onClick={() => setConfirming(false)}>
              {t('confirm.keep')}
            </button>
            <button type="button" className={buttonPrimary} disabled={busy} onClick={() => void run('cancel')}>
              {t('confirm.confirm')}
            </button>
          </>
        }
      >
        <p>{t('confirm.body')}</p>
      </Dialog>
    </div>
  );
}
