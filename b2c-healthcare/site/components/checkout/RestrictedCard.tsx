'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Inputs';
import { formatMoney } from '@/lib/utils';
import type { RestrictedChangeResult } from '@/hooks/use-checkout';
import type { TenderView } from '@/lib/types';

export interface RestrictedCardProps {
  tender: TenderView;
  onChoose: (on: boolean) => Promise<RestrictedChangeResult>;
}

/**
 * The restricted instrument ("Health account card (demo)"): offered only when something in the basket qualifies, capped at
 * the eligible subtotal; the card pays the rest. When nothing qualifies it is not available and the reason is stated.
 * The choice and every amount belong to the server: the checkbox sends the choice and the answer replaces the state.
 */
export function RestrictedCard({ tender, onChoose }: RestrictedCardProps) {
  const t = useTranslations('funding.tender');
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const { restricted } = tender;
  const money = (m: { centAmount: number; currencyCode: string }) => formatMoney(m.centAmount, m.currencyCode, locale);

  async function toggle(on: boolean) {
    setBusy(true);
    setFailed(false);
    const result = await onChoose(on);
    if (!result.ok && result.reason === 'failed') setFailed(true);
    setBusy(false);
  }

  return (
    <Card as="section" aria-labelledby="checkout-restricted-title" className="grid gap-3" data-checkout-card="restricted" data-restricted={restricted.available ? 'available' : 'unavailable'}>
      <h2 id="checkout-restricted-title" className="font-display text-xl font-semibold text-navy-900">
        {t('restrictedTitle')}
      </h2>
      {restricted.available ? (
        <>
          <Checkbox label={t('restrictedUse')} checked={restricted.chosen} disabled={busy} onChange={(event) => void toggle(event.target.checked)} />
          <p className="text-sm text-neutral-600">{t('restrictedWouldPay', { amount: money(restricted.applies) })}</p>
        </>
      ) : (
        <p className="text-sm text-neutral-600" data-restricted-reason={restricted.reason}>
          {t('restrictedUnavailable')}
        </p>
      )}
      {failed ? (
        <p role="alert" className="text-sm font-medium text-danger-700">
          {t('restrictedFailed')}
        </p>
      ) : null}
    </Card>
  );
}
