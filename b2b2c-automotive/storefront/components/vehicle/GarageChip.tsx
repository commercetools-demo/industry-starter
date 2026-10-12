// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { buttonClass } from '@/components/ui/Button';
import { ChangeVehicleDialog } from '@/components/vehicle/ChangeVehicleDialog';
import { VehicleChip } from '@/components/vehicle/VehicleChip';
import { useGarage } from '@/hooks/useGarage';

/**
 * Header slot of the shell (workstream I imports it, no props): the active vehicle as a chip with "Change", or "Select your vehicle"
 * when the garage is empty. Both open `ChangeVehicleDialog` (garage list, add a vehicle). Needs `GarageProvider` above it.
 */
export function GarageChip() {
  const t = useTranslations('vehicleFinder');
  const tg = useTranslations('vehicleGarage');
  const { active } = useGarage();
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  return (
    <div className="flex min-w-0 items-center gap-2">
      {active ? <VehicleChip label={active.label} /> : null}
      <button ref={opener} type="button" className={buttonClass('link')} onClick={() => setOpen(true)} aria-haspopup="dialog">
        {active ? t('change') : tg('select')}
      </button>
      <ChangeVehicleDialog open={open} onClose={() => setOpen(false)} returnFocusTo={opener} />
    </div>
  );
}
