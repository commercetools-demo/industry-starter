// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { buttonClass } from '@/components/ui/Button';
import { ChangeVehicleDialog } from '@/components/vehicle/ChangeVehicleDialog';
import { PlateVinTabs } from '@/components/vehicle/PlateVinTabs';
import { VehicleChip } from '@/components/vehicle/VehicleChip';
import { useGarage } from '@/hooks/useGarage';

/**
 * Listing bar (workstream L): "MY GARAGE", the active vehicle chip and "Change vehicle". With no vehicle it reads "Select your vehicle"
 * and the selectors sit in a collapsed row (native `details`) so a shopper can pick one without leaving the listing.
 */
export function GarageBar() {
  const t = useTranslations('vehicleGarage');
  const { active } = useGarage();
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  return (
    <div className="grid gap-3 rounded-md border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-ui text-xs font-bold uppercase tracking-label text-text-subtle">{t('title')}</span>
        {active ? (
          <>
            <VehicleChip label={active.label} />
            <button ref={opener} type="button" className={buttonClass('link')} onClick={() => setOpen(true)} aria-haspopup="dialog">
              {t('change')}
            </button>
          </>
        ) : (
          <details className="min-w-0 flex-1">
            <summary className="min-h-7 cursor-pointer font-utility text-sm font-medium text-text-link">{t('select')}</summary>
            <div className="pt-3">
              <PlateVinTabs layout="row" />
            </div>
          </details>
        )}
      </div>
      <ChangeVehicleDialog open={open} onClose={() => setOpen(false)} returnFocusTo={opener} />
    </div>
  );
}
