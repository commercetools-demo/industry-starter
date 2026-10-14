// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useId } from 'react';
import { Select } from '@/components/ui/Select';
import type { PolicyOption, ProductDetail } from '@/lib/types';
import { formatMoney } from '@/lib/utils';

export type PurchaseMode = 'one-time' | 'subscribe';

interface Props {
  mode: PurchaseMode;
  onModeChange: (mode: PurchaseMode) => void;
  policies: PolicyOption[];
  /** The chosen recurrence policy key (the parent falls back to the first policy). */
  policyKey: string | undefined;
  onPolicyChange: (key: string) => void;
  price: ProductDetail['price'];
}

/**
 * "One-time purchase" or "Subscribe and save" with a "Deliver every" frequency from the seeded recurrence policies (D13).
 * Controlled: `PdpBuyBox` owns `mode` and `policyKey` next to the quantity, so a vehicle or store change keeps the choice.
 */
export function PurchaseModeChoice({ mode, onModeChange, policies, policyKey, onPolicyChange, price }: Props) {
  const t = useTranslations('pdp');
  const locale = useLocale();
  const name = useId();
  const radio = (checked: boolean) =>
    `flex min-h-7 cursor-pointer items-center gap-3 rounded-sm border px-4 py-2 font-display text-sm text-text ${checked ? 'border-border-brand bg-surface-brand-subtle' : 'border-border bg-surface'}`;
  return (
    <fieldset className="m-0 grid gap-2 border-0 p-0">
      <legend className="mb-1 p-0 font-ui text-xs font-bold uppercase tracking-label text-text-muted">{t('purchaseMode')}</legend>
      <label className={radio(mode === 'one-time')}>
        <input type="radio" className="accent-action" name={name} value="one-time" checked={mode === 'one-time'} onChange={() => onModeChange('one-time')} />
        {t('oneTime')}
      </label>
      <label className={radio(mode === 'subscribe')}>
        <input type="radio" className="accent-action" name={name} value="subscribe" checked={mode === 'subscribe'} onChange={() => onModeChange('subscribe')} />
        {t('subscribe')}
      </label>
      {mode === 'subscribe' ? (
        <div className="grid gap-2 pl-1">
          <Select label={t('deliverEvery')} value={policyKey ?? ''} onChange={(event) => onPolicyChange(event.target.value)}>
            {policies.map((policy) => (
              <option key={policy.key} value={policy.key}>
                {policy.label}
              </option>
            ))}
          </Select>
          {price ? <p className="m-0 font-ui text-sm text-text-body">{t('subscribePrice', { price: formatMoney(price.centAmount, price.currencyCode, locale, price.fractionDigits) })}</p> : null}
          <p className="m-0 font-ui text-xs text-text-muted">{t('subscribeNote')}</p>
        </div>
      ) : null}
    </fieldset>
  );
}
