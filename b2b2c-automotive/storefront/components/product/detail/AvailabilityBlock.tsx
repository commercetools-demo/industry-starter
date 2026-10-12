// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { useStorePicker } from '@/context/StorePickerContext';
import type { PickupOption } from '@/lib/types';

export interface PdpBranch {
  name: string;
  address: { street: string; postalCode: string; city: string };
  pickup: PickupOption;
}

export interface AvailabilityBlockProps {
  /** The selected branch; null for a store without branches. */
  branch: PdpBranch | null;
  /** More than one branch: "Change store" is offered. */
  canChangeStore: boolean;
  inStock: boolean;
  shipDays: { min: number; max: number };
}

/**
 * Stock at the selected branch with its address, the pickup promise, "Change store" and the delivery line (workstream M, M-R2).
 * The server passes branch and stock as props; after the store picker changes the branch the page re-renders (`router.refresh()`)
 * and the new props arrive without a reload.
 */
export function AvailabilityBlock({ branch, canChangeStore, inStock, shipDays }: AvailabilityBlockProps) {
  const t = useTranslations('pdp');
  const picker = useStorePicker();
  const pickupText = !branch ? null : !inStock || branch.pickup === 'ship-to-store' ? t('shipToStore') : branch.pickup === 'today' ? t('pickupToday') : t('pickupTomorrow');
  return (
    <section aria-label={t('availability')} className="grid rounded-md border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="grid gap-1">
          <p className={`m-0 font-display text-sm font-semibold ${inStock ? 'text-success-600' : 'text-accent-700'}`}>
            {branch ? (inStock ? t('inStockAt', { branch: branch.name }) : t('notInStockAt', { branch: branch.name })) : inStock ? t('inStock') : t('notInStock')}
          </p>
          {branch ? (
            <p className="m-0 font-ui text-sm text-text-muted">
              {branch.address.street}, {branch.address.postalCode} {branch.address.city}
            </p>
          ) : null}
          {pickupText ? <p className="m-0 font-ui text-sm text-text-body">{pickupText}</p> : null}
        </div>
        {canChangeStore ? (
          <Button variant="link" onClick={picker.open}>
            {t('changeStore')}
          </Button>
        ) : null}
      </div>
      <p className="m-0 px-4 py-3 font-ui text-sm text-text-muted">{t('deliveryLine', { min: shipDays.min, max: shipDays.max })}</p>
    </section>
  );
}
