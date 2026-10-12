// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { useId, type RefObject } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PlateVinTabs } from '@/components/vehicle/PlateVinTabs';
import { VehicleList } from '@/components/vehicle/VehicleList';
import { useGarage } from '@/hooks/useGarage';

interface ChangeVehicleDialogProps {
  open: boolean;
  onClose: () => void;
  /** Element that gets focus back on close; defaults to the opener. */
  returnFocusTo?: RefObject<HTMLElement | null>;
}

/**
 * "Your vehicles": the garage list (set active, remove) and a way to add another vehicle (selectors, plus Plate and VIN when enabled).
 * Adding a vehicle closes the dialog. Focus is trapped by the native dialog (`Modal` of the shell) and returns to the opener.
 */
export function ChangeVehicleDialog({ open, onClose, returnFocusTo }: ChangeVehicleDialogProps) {
  const t = useTranslations('vehicleGarage');
  const titleId = useId();
  const { vehicles, isFull } = useGarage();
  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} returnFocusTo={returnFocusTo} className="overflow-y-auto">
      <div className="grid gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-display text-xl text-text-strong">
            {t('dialogTitle')}
          </h2>
          <Button variant="link" onClick={onClose}>
            {t('close')}
          </Button>
        </div>
        {vehicles.length ? <VehicleList /> : null}
        <section aria-labelledby={`${titleId}-add`} className="grid gap-3">
          <h3 id={`${titleId}-add`} className="font-ui text-xs font-bold uppercase tracking-label text-text-muted">
            {t('add')}
          </h3>
          {isFull ? (
            <p role="status" className="rounded-xs bg-warning-50 px-3 py-2 font-ui text-sm text-text-body">
              {t('full')}
            </p>
          ) : null}
          <PlateVinTabs onAdded={onClose} />
        </section>
      </div>
    </Modal>
  );
}
