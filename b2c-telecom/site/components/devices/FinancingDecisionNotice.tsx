'use client';

import { useState, type ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { useDeviceActions } from '@/hooks/useDeviceActions';
import { formatMoneyExact } from '@/lib/format';
import type { FinancingDecision, Locale } from '@/lib/types';
import { useDeviceErrorText } from './useDeviceError';

type FinancingDecisionNoticeProps = {
  decision: FinancingDecision;
  /** The financed device lines of the bundle, each with a button to pay it in full instead. */
  lines: { id: string; name: string }[];
  /** Called after a line was switched to pay in full, so the checkout can ask for a new decision. */
  onChanged?: () => void;
};

/**
 * Shown by the checkout (workstream U) when the financing decision is `declined` (undrawn: Junior design choice, D-068): the reason in
 * words and, for every financed line, "Pay in full instead". Approved and sign-in-required decisions render nothing (U continues or
 * redirects to sign in).
 */
export function FinancingDecisionNotice({ decision, lines, onChanged }: FinancingDecisionNoticeProps): ReactElement | null {
  const t = useTranslations('devices');
  const locale = useLocale() as Locale;
  const { changeAcquisition } = useDeviceActions();
  const errorText = useDeviceErrorText('');
  const [busyLine, setBusyLine] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (decision.outcome !== 'declined') return null;

  const reason = decision.reason === 'amount-over-limit' ? t('financing.amountOverLimit', { limit: formatMoneyExact(decision.limit, locale) }) : t('financing.customerDeclined');

  const payInFull = async (lineId: string): Promise<void> => {
    setBusyLine(lineId);
    setError(null);
    try {
      await changeAcquisition(lineId, { mode: 'outright', termMonths: 0 });
      onChanged?.();
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusyLine(null);
    }
  };

  return (
    <section role="alert" aria-labelledby="financing-declined-title" className="flex flex-col gap-4 rounded-xl border-2 border-danger bg-surface p-6">
      <h2 id="financing-declined-title" className="m-0 font-display text-xl font-bold">
        {t('financing.declinedTitle')}
      </h2>
      <p className="m-0 text-md">{reason}</p>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {lines.map((line) => (
          <li key={line.id} className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-display text-md font-semibold">{line.name}</span>
            <Button variant="secondary" size="sm" loading={busyLine === line.id} disabled={busyLine !== null} aria-label={`${t('financing.payInFull')}: ${line.name}`} onClick={() => void payInFull(line.id)}>
              {t('financing.payInFull')}
            </Button>
          </li>
        ))}
      </ul>
      {error ? (
        <p className="m-0 text-sm font-semibold text-danger">{error}</p>
      ) : null}
    </section>
  );
}
