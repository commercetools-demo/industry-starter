// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { VehicleChip } from '@/components/vehicle/VehicleChip';
import { useGarage } from '@/hooks/useGarage';

/** The garage as a list (up to five): the active vehicle is marked, the others offer "Set active"; every vehicle offers "Remove". */
export function VehicleList({ allowRemoveLast = true }: { allowRemoveLast?: boolean }) {
  const t = useTranslations('vehicleGarage');
  const te = useTranslations('vehicleErrors');
  const { vehicles, active, setActive, remove } = useGarage();
  const [failed, setFailed] = useState(false);

  async function run(action: () => Promise<void>) {
    setFailed(false);
    try {
      await action();
    } catch {
      setFailed(true);
    }
  }

  if (!vehicles.length) return <p className="font-ui text-sm text-text-muted">{t('empty')}</p>;
  return (
    <div className="grid gap-2">
      <ul aria-label={t('list')} className="grid gap-2">
        {vehicles.map((v) => {
          const isActive = v.id === active?.id;
          return (
            <li key={v.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
              <VehicleChip label={v.label} />
              {isActive ? <span className="font-ui text-xs font-bold uppercase tracking-label text-text-muted">{t('active')}</span> : null}
              <span className="ml-auto flex items-center gap-1">
                {!isActive ? (
                  <Button variant="link" aria-label={t('setActiveLabel', { vehicle: v.label })} onClick={() => run(() => setActive(v.id))}>
                    {t('setActive')}
                  </Button>
                ) : null}
                {allowRemoveLast || vehicles.length > 1 ? (
                  <Button variant="link" aria-label={t('removeLabel', { vehicle: v.label })} onClick={() => run(() => remove(v.id))}>
                    {t('remove')}
                  </Button>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
      {failed ? (
        <p role="alert" className="font-ui text-sm text-danger-600">
          {te('save')}
        </p>
      ) : null}
    </div>
  );
}
