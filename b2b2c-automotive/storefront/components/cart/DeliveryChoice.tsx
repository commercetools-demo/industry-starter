// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { DeliveryMode, DeliveryOption } from '@/lib/types';
import { formatMoney } from '@/lib/utils';

interface Props {
  options: DeliveryOption[];
  selected: DeliveryMode | null;
  onSelect: (mode: DeliveryMode) => void;
  disabled?: boolean;
}

/**
 * "Pick up · Free" (store, city and time) and "Ship to me · {fee}" ("free over {threshold}" or "Add {amount} more for free shipping").
 * Native radios in a fieldset; the selected option has the brand border and fill. Fee and threshold come from the matching shipping
 * rate, never from literals. No matching method shows a plain notice.
 */
export function DeliveryChoice({ options, selected, onSelect, disabled = false }: Props) {
  const t = useTranslations('cart.delivery');
  const locale = useLocale();
  const money = (m: { centAmount: number; currencyCode: string; fractionDigits: number }) => formatMoney(m.centAmount, m.currencyCode, locale, m.fractionDigits);

  if (options.length === 0) {
    return (
      <p role="status" className="m-0 rounded-sm bg-surface-subtle p-3 font-ui text-sm text-text-muted">
        {t('none')}
      </p>
    );
  }
  return (
    <fieldset className="m-0 grid gap-2 border-0 p-0">
      <legend className="sr-only">{t('title')}</legend>
      {options.map((option) => {
        const isSelected = option.mode === selected;
        const when = option.branch?.pickupPromise === 'today' ? t('pickupToday') : option.branch?.pickupPromise === 'tomorrow' ? t('pickupTomorrow') : t('pickupShipToStore');
        const fee = option.fee.centAmount === 0 ? t('free') : money(option.fee);
        const title = option.mode === 'pickup' ? `${t('pickup')} · ${t('free')}` : `${t('ship')} · ${fee}`;
        const detail =
          option.mode === 'pickup' && option.branch
            ? t('pickupAt', { store: option.branch.name, city: option.branch.city, when })
            : option.remainingForFree
              ? t('addMore', { amount: money(option.remainingForFree) })
              : option.freeAbove
                ? t('freeOver', { threshold: money(option.freeAbove) })
                : null;
        return (
          <label key={option.mode} className={`flex cursor-pointer items-start gap-3 rounded-sm border p-3 ${isSelected ? 'border-border-brand bg-brand-50' : 'border-border bg-surface'}`}>
            <input type="radio" name="delivery" value={option.mode} checked={isSelected} disabled={disabled} onChange={() => onSelect(option.mode)} className="mt-1 size-4 accent-action" />
            <span className="grid gap-1 font-ui text-sm text-text">
              <b className="font-display font-semibold">{title}</b>
              {detail ? <span className="text-xs text-text-muted">{detail}</span> : null}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
