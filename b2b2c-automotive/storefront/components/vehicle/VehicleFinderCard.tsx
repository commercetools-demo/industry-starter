// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { buttonClass } from '@/components/ui/Button';
import { ChangeVehicleDialog } from '@/components/vehicle/ChangeVehicleDialog';
import { PlateVinTabs } from '@/components/vehicle/PlateVinTabs';
import { PILL_PRIMARY } from '@/components/vehicle/styles';
import { VehicleChip } from '@/components/vehicle/VehicleChip';
import { VehicleList } from '@/components/vehicle/VehicleList';
import { useGarage } from '@/hooks/useGarage';
import { Link } from '@/i18n/routing';

/**
 * "Find parts for your vehicle" card of the home page (workstream K embeds it, for example in the hero block).
 * Empty garage: the selectors (Plate and VIN tabs when enabled). With a vehicle: the chip, "Change", a "Shop parts that fit" button
 * linking to `partsHref`, and, from two vehicles on, the garage list with "Set active" and "Remove".
 * `partsHref` is a locale-less path (the locale prefix is added), for example `/${store}/parts`.
 */
export function VehicleFinderCard({ partsHref }: { partsHref: string }) {
  const t = useTranslations('vehicleFinder');
  const { active, vehicles, error, isLoading } = useGarage();
  const te = useTranslations('vehicleErrors');
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);

  return (
    <section aria-labelledby="vehicle-finder-title" className="grid gap-3 rounded-md bg-surface p-5 text-text">
      <h2 id="vehicle-finder-title" className="font-ui text-md font-semibold text-text-strong">
        {t('title')}
      </h2>
      {error && !isLoading && !active ? (
        <p role="alert" className="font-ui text-sm text-danger-600">
          {te('garage')}
        </p>
      ) : null}
      {active ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-ui text-xs font-bold uppercase tracking-label text-text-subtle">{t('yourVehicle')}</span>
            <VehicleChip label={active.label} />
            <button ref={opener} type="button" className={buttonClass('link')} onClick={() => setOpen(true)} aria-haspopup="dialog">
              {t('change')}
            </button>
          </div>
          <Link href={partsHref} className={PILL_PRIMARY}>
            {t('shopFit')}
          </Link>
          {vehicles.length > 1 ? <VehicleList allowRemoveLast={false} /> : null}
          <ChangeVehicleDialog open={open} onClose={() => setOpen(false)} returnFocusTo={opener} />
        </>
      ) : (
        <PlateVinTabs />
      )}
    </section>
  );
}
