// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { buttonClass } from '@/components/ui/Button';
import { ChangeVehicleDialog } from '@/components/vehicle/ChangeVehicleDialog';
import { useGarage } from '@/hooks/useGarage';
import { Link } from '@/i18n/routing';
import { getFitState } from '@/lib/search/fitment';
import type { FitmentProduct } from '@/lib/types';

interface FitBannerProps {
  /** The part's range keys and universal flag (mapped from `fitment-keys` and `universal-fit`). */
  product: FitmentProduct;
  /** Locale-less path of the listing of fitting alternatives, for example `/${store}/parts?fit=1&category=brakes`. */
  alternativesHref: string;
}

/**
 * Product page banner (workstream M): "✓ Fits your 2016 Volkswagen Golf · 2.0 TDI", or a danger banner with "View fitting
 * alternatives", or "Select your vehicle to check fit" without a vehicle. The fit state is computed in the browser from the part's
 * keys and the garage's active vehicle (`getFitState`), so changing the vehicle updates the banner in place: no navigation and no
 * remount of sibling state such as the quantity input. Colours are locked tokens.
 */
export function FitBanner({ product, alternativesHref }: FitBannerProps) {
  const t = useTranslations('vehicleFit');
  const tg = useTranslations('vehicleGarage');
  const { active } = useGarage();
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const state = getFitState(product, active);
  const tone = state === 'fits' ? 'bg-success-50 text-success-600' : state === 'does-not-fit' ? 'bg-danger-50 text-danger-600' : 'bg-surface-subtle text-text-muted';

  return (
    <>
    <div role="status" className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-sm px-4 py-3 font-ui text-sm font-semibold ${tone}`}>
      {state === 'fits' && active ? (
        <span>
          <span aria-hidden="true">✓</span> {t('bannerFits', { vehicle: active.label })}
        </span>
      ) : null}
      {state === 'does-not-fit' && active ? (
        <>
          <span>
            <span aria-hidden="true">✕</span> {t('bannerNo', { vehicle: active.label })}
          </span>
          <Link href={alternativesHref} className="inline-flex min-h-6 items-center font-utility underline underline-offset-2">
            {t('alternatives')}
          </Link>
        </>
      ) : null}
      {state === 'unknown' ? <span>{t('unknown')}</span> : null}
      <button ref={opener} type="button" aria-haspopup="dialog" onClick={() => setOpen(true)} className={`${buttonClass('link')} ml-auto text-text-link`}>
        {state === 'unknown' ? tg('select') : tg('change')}
      </button>
    </div>
    <ChangeVehicleDialog open={open} onClose={() => setOpen(false)} returnFocusTo={opener} />
    </>
  );
}
