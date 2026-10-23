'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useId } from 'react';
import { usePdp } from '@/components/pdp/pdp-state';
import { Select } from '@/components/ui/Field';
import { formatInterval } from '@/lib/product/interval';
import { formatMoney } from '@/lib/utils';

/**
 * Subscribe block (workstream H, 3.8): interval select of the policies that have a recurring price for the selected
 * variant (a policy without a price is never offered), the recurring price per delivery with the one-time price for
 * comparison, and the skip-or-cancel line.
 */
export default function SubscribeBlock() {
  const t = useTranslations('pdp');
  const tSub = useTranslations('subscription');
  const locale = useLocale();
  const { preview, policies, policyId, setPolicyId } = usePdp();
  const selectId = useId();
  const chosen = policies.find((p) => p.policy.id === policyId) ?? policies[0];
  if (!chosen) return null;
  const fmt = (m: { centAmount: number; currencyCode: string }) => formatMoney(m.centAmount, m.currencyCode, locale);
  const oneTime = preview.price ? (preview.price.discounted ?? preview.price.value) : undefined;
  return (
    <div className="flex flex-col gap-2 rounded-card border border-line bg-surface px-4 py-3.5" data-testid="subscribe-block">
      <label htmlFor={selectId} className="text-[13px] font-semibold text-ink">
        {t('subscribe.interval')}
      </label>
      <Select id={selectId} value={chosen.policy.id} onChange={(e) => setPolicyId(e.target.value)}>
        {policies.map((p) => (
          <option key={p.policy.id} value={p.policy.id}>
            {formatInterval(p.policy.schedule, t)}
          </option>
        ))}
      </Select>
      <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-[14px] font-semibold text-ink">
        <span data-testid="subscribe-price">{t('subscribe.price', { amount: fmt(chosen.price.value) })}</span>
        {oneTime && oneTime.centAmount !== chosen.price.value.centAmount ? (
          <s className="text-[13px] font-normal text-ink-3">{t('subscribe.oneTime', { amount: fmt(oneTime) })}</s>
        ) : null}
      </p>
      <p className="m-0 text-[12.5px] text-ink-2" data-testid="subscribe-price-lock">{tSub('priceLock')}</p>
      <p className="m-0 text-[12.5px] text-ink-3">{t('subscribe.skipCancel')}</p>
    </div>
  );
}
