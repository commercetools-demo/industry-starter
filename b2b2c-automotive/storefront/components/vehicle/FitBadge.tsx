// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { ChangeVehicleDialog } from '@/components/vehicle/ChangeVehicleDialog';
import type { FitState } from '@/lib/search/fitment';

// The fit colours are LOCKED: success and danger tints with a glyph in the text, whatever the reseller theme says.
const BASE = 'inline-flex w-fit items-center gap-1 rounded-xs px-2 py-1 font-ui text-xs font-semibold';

/**
 * The fit state of one part (listing cards, workstream L). `fits` "✓ Fits your vehicle", `does-not-fit` "✕ Does not fit",
 * `unknown` "Select your vehicle to check fit" as a button that opens the garage dialog. Compute the state on the server with
 * `getFitState(product, await getActiveVehicle())` from `@/lib/search/fitment`.
 */
export function FitBadge({ state }: { state: FitState }) {
  const t = useTranslations('vehicleFit');
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  if (state === 'fits') {
    return (
      <span className={`${BASE} bg-success-50 text-success-600`}>
        <span aria-hidden="true">✓</span> {t('fits')}
      </span>
    );
  }
  if (state === 'does-not-fit') {
    return (
      <span className={`${BASE} bg-danger-50 text-danger-600`}>
        <span aria-hidden="true">✕</span> {t('doesNotFit')}
      </span>
    );
  }
  return (
    <>
      <button ref={opener} type="button" aria-haspopup="dialog" onClick={() => setOpen(true)} className={`${BASE} bg-surface-subtle text-text-muted underline-offset-2 hover:underline`}>
        {t('unknown')}
      </button>
      <ChangeVehicleDialog open={open} onClose={() => setOpen(false)} returnFocusTo={opener} />
    </>
  );
}
