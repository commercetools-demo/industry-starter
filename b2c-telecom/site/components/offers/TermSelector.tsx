'use client';

import { useId, type ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { cx } from '@/lib/cx';
import { formatMoney } from '@/lib/format';
import { termKey, type TermOption } from '@/lib/listing/cardData';
import type { Locale } from '@/lib/types';

type TermSelectorProps = {
  terms: TermOption[];
  /** SKU of the chosen term. */
  value: string;
  onChange: (sku: string) => void;
  /** True while the plan is in the bundle: the term of a placed line is not changed from the card (Planner default). */
  locked?: boolean;
};

/** Contract term as pill radios ("Month-to-month · $49.99"). Native radios, so arrow keys and the group semantics come from the browser. */
export function TermSelector({ terms, value, onChange, locked = false }: TermSelectorProps): ReactElement {
  const t = useTranslations('offers');
  const unavailable = useTranslations('plp.price')('unavailable');
  const locale = useLocale() as Locale;
  const name = useId();
  return (
    <div role="radiogroup" aria-label={t('term.label')} title={locked ? t('term.locked') : undefined} className="flex flex-wrap gap-3">
      {terms.map((term) => {
        const disabled = locked || term.price === null;
        return (
          <label key={term.sku} className={cx('relative inline-flex', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
            <input
              type="radio"
              name={name}
              value={term.sku}
              checked={term.sku === value}
              disabled={disabled}
              onChange={() => onChange(term.sku)}
              className="peer sr-only"
            />
            <span
              className={cx(
                'inline-flex min-h-11 items-center rounded-pill border-2 border-border bg-surface px-5 py-3 font-display text-sm font-semibold text-text',
                'peer-checked:border-action peer-checked:bg-pink-50 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-action',
                disabled && 'opacity-60',
              )}
            >
              {t(`term.${termKey(term.termMonths)}`)} · {term.price ? formatMoney(term.price, locale) : unavailable}
            </span>
          </label>
        );
      })}
    </div>
  );
}
