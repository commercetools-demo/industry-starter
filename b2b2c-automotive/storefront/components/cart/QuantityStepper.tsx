// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { QUANTITY_MAX, QUANTITY_MIN } from '@/components/product/detail/QuantityStepper';

interface Props {
  value: number;
  /** The part name, for the labels ("Decrease quantity of {name}"). */
  name: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}

/**
 * Quantity control of a cart line: "−" and "+" buttons of at least 44 px around the number. The minimum is 1 (Remove takes a line out);
 * the maximum is the one of the product page. Every press asks for exactly one new value; the cart answers with the stock rules.
 */
export function QuantityStepper({ value, name, onChange, disabled = false }: Props) {
  const t = useTranslations('cart');
  const button = 'flex min-h-7 w-7 items-center justify-center bg-surface font-display text-xl text-text hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-60';
  return (
    <div role="group" aria-label={t('quantityLabel', { name })} className="flex items-center overflow-hidden rounded-sm border border-border-input bg-surface">
      <button type="button" className={button} aria-label={t('decrease', { name })} disabled={disabled || value <= QUANTITY_MIN} onClick={() => onChange(value - 1)}>
        <span aria-hidden="true">−</span>
      </button>
      <output className="flex min-h-7 min-w-7 items-center justify-center border-x border-border-input px-2 font-display text-md font-semibold text-text">{value}</output>
      <button type="button" className={button} aria-label={t('increase', { name })} disabled={disabled || value >= QUANTITY_MAX} onClick={() => onChange(value + 1)}>
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}
