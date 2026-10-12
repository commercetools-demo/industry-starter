// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';

export const QUANTITY_MIN = 1;
export const QUANTITY_MAX = 99;

/** Clamps to 1..99; anything that is not a whole number (empty, 0, text) becomes 1. */
export const clampQuantity = (value: number): number => (Number.isFinite(value) ? Math.min(QUANTITY_MAX, Math.max(QUANTITY_MIN, Math.trunc(value))) : QUANTITY_MIN);

interface Props {
  value: number;
  onChange: (value: number) => void;
}

/**
 * Quantity control (workstream M, reused by N): "−" and "+" buttons of at least 44 px and a numeric input (min 1, max 99). Typing
 * is free; an empty field or 0 snaps back to 1 when the field loses focus. The parent owns `value`, so the number survives a
 * vehicle or store change on the page.
 */
export function QuantityStepper({ value, onChange }: Props) {
  const t = useTranslations('pdp');
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);
  const commit = (next: number) => {
    setDraft(null);
    onChange(clampQuantity(next));
  };
  const button = 'flex min-h-7 w-7 items-center justify-center bg-surface font-display text-xl text-text hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-60';
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">
        {t('quantity')}
      </label>
      <div className="flex items-center overflow-hidden rounded-sm border border-border-strong bg-surface">
        <button type="button" className={button} aria-label={t('decrease')} disabled={value <= QUANTITY_MIN} onClick={() => commit(value - 1)}>
          <span aria-hidden="true">−</span>
        </button>
        <input
          id={id}
          name="quantity"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={shown}
          onChange={(event) => {
            setDraft(event.target.value);
            const n = Number(event.target.value);
            if (event.target.value !== '' && Number.isInteger(n) && n >= QUANTITY_MIN) onChange(clampQuantity(n));
          }}
          onBlur={() => commit(Number(shown))}
          className="min-h-7 w-7 border-x border-border-strong bg-surface text-center font-display text-md font-semibold text-text"
        />
        <button type="button" className={button} aria-label={t('increase')} disabled={value >= QUANTITY_MAX} onClick={() => commit(value + 1)}>
          <span aria-hidden="true">+</span>
        </button>
      </div>
    </div>
  );
}
