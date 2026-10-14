// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { useId, useState, type FormEvent } from 'react';
import { buttonClass } from '@/components/ui/Button';
import { INPUT_CLASS } from '@/components/ui/Field';
import type { PromoCodeState, PromoReason } from '@/lib/types';

interface Props {
  /** The codes on the cart. */
  codes: PromoCodeState[];
  /** The code just typed when commercetools refused it (it is not on the cart): shown as Not applied with the reason. */
  rejected?: PromoCodeState | null;
  onApply: (code: string) => Promise<void> | void;
  onRemove: (id: string) => Promise<void> | void;
}

const REASON_KEY: Record<PromoReason, 'reasonDoesNotMatch' | 'reasonNotActive' | 'reasonNotValid' | 'reasonMaxReached' | 'reasonStoppedByPrevious'> = {
  'does-not-match': 'reasonDoesNotMatch',
  'not-active': 'reasonNotActive',
  'not-valid': 'reasonNotValid',
  'max-reached': 'reasonMaxReached',
  'stopped-by-previous': 'reasonStoppedByPrevious',
};

/** Promo code field with the state of each code (Applied or Not applied with the reason, and Remove). Results are announced through `role="status"`. */
export function PromoCodeForm({ codes, rejected = null, onApply, onRemove }: Props) {
  const t = useTranslations('cart.promo');
  const inputId = useId();
  const [value, setValue] = useState('');
  const [pending, setPending] = useState(false);
  const [dismissed, setDismissed] = useState<PromoCodeState | null>(null);
  const shownRejected = rejected && rejected !== dismissed && !codes.some((c) => c.code.toLowerCase() === rejected.code.toLowerCase()) ? rejected : null;
  const rows = [...codes, ...(shownRejected ? [shownRejected] : [])];

  async function submit(event: FormEvent) {
    event.preventDefault();
    const code = value.trim();
    if (!code || pending) return;
    setPending(true);
    try {
      await onApply(code);
      setValue('');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-2">
      <form onSubmit={submit} className="flex flex-wrap gap-2">
        <label htmlFor={inputId} className="sr-only">
          {t('label')}
        </label>
        <input id={inputId} name="code" value={value} onChange={(event) => setValue(event.target.value)} placeholder={t('placeholder')} autoComplete="off" autoCapitalize="characters" spellCheck={false} className={`${INPUT_CLASS} min-w-[9rem] flex-1`} />
        <button type="submit" disabled={pending || value.trim() === ''} className={buttonClass('secondary')}>
          {pending ? t('applying') : t('apply')}
        </button>
      </form>
      <div role="status">
        {rows.length > 0 ? (
          <ul className="m-0 grid list-none gap-2 p-0">
        {rows.map((row) => (
          <li key={`${row.id}:${row.code}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 font-ui text-sm">
            <span className={`inline-flex items-center gap-1 rounded-xs px-2 py-1 text-xs font-bold ${row.state === 'applied' ? 'bg-success-50 text-success-600' : 'bg-danger-50 text-danger-600'}`}>
              <span aria-hidden="true">{row.state === 'applied' ? '✓' : '✕'}</span> {row.state === 'applied' ? t('applied') : t('notApplied')}
            </span>
            <span className="font-display font-semibold text-text">{row.code}</span>
            {row.reason ? <span className="text-text-muted">{t(REASON_KEY[row.reason])}</span> : null}
            <button
              type="button"
              aria-label={t('removeLabel', { code: row.code })}
              onClick={() => (row.id ? onRemove(row.id) : setDismissed(row))}
              className="min-h-7 font-utility text-sm text-text-link underline-offset-2 hover:underline"
            >
              {t('remove')}
            </button>
          </li>
        ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
