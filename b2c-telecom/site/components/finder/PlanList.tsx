/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useRef, type KeyboardEvent, type ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { cx } from '@/lib/cx';
import { formatMoney } from '@/lib/format';
import type { OfferItem } from '@/lib/offers-api/views';
import type { Locale } from '@/lib/types';
import { FOCUS_RING } from '@/components/ui/focus';

type PlanListProps = {
  plans: OfferItem[];
  selectedKey: string | null;
  onSelect: (plan: OfferItem) => void;
};

/** The plans of the family as one single-choice group (radio semantics via aria-pressed buttons would read as toggles, so real radios). */
export function PlanList({ plans, selectedKey, onSelect }: PlanListProps): ReactElement {
  const t = useTranslations('finder');
  const to = useTranslations('offers');
  const locale = useLocale() as Locale;
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  // Radio-group keyboard: one tab stop (the selected plan), arrows move the selection and the focus.
  function onKeyDown(event: KeyboardEvent, index: number): void {
    const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const target = (index + step + plans.length) % plans.length;
    const next = plans[target];
    if (!next) return;
    onSelect(next);
    buttons.current[target]?.focus();
  }

  return (
    <ul role="radiogroup" aria-label={t('plans.label')} className="m-0 flex list-none flex-col gap-3 p-0">
      {plans.map((plan, index) => {
        const selected = plan.key === selectedKey;
        const monthly = plan.price.recurring;
        return (
          <li key={plan.key}>
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              ref={(node) => {
                buttons.current[index] = node;
              }}
              onKeyDown={(event) => onKeyDown(event, index)}
              onClick={() => onSelect(plan)}
              className={cx('flex w-full flex-col gap-1 rounded-lg border-2 bg-surface p-4 text-left', selected ? 'border-action' : 'border-neutral-300 hover:border-neutral-500', FOCUS_RING)}
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-display text-md font-bold">{plan.name}</span>
                {monthly ? (
                  <span className="whitespace-nowrap font-display text-md font-semibold">
                    {formatMoney(monthly, locale)}
                    {to('perMonth')}
                  </span>
                ) : null}
              </span>
              {plan.badge ? <span className="text-sm text-text-muted">{to('mostPopular')}</span> : null}
              {plan.firstMonthFree && monthly ? <span className="text-sm text-action">{to('firstMonthFree', { price: formatMoney(monthly, locale) })}</span> : null}
              {plan.termMonths !== null ? <span className="text-sm text-text-muted">{plan.termMonths === 0 ? to('validity.month-to-month') : to(`validity.${plan.termMonths}-months`)}</span> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
