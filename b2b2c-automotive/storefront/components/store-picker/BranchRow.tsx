// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDistance, formatTime } from '@/lib/store/format';
import type { BranchView } from '@/lib/types';

interface Props {
  branch: BranchView;
  distanceKm?: number;
  focused: boolean;
  /** The branch the shopper shops at now. */
  current: boolean;
  busy: boolean;
  optionId: string;
  onFocus: () => void;
  onChoose: () => void;
}

/** One branch: name, distance, address, hours state and pickup option. Only the focused row has the choose button. */
export function BranchRow({ branch, distanceKm, focused, current, busy, optionId, onFocus, onChoose }: Props) {
  const t = useTranslations('storePicker');
  const locale = useLocale();
  const { hoursState } = branch;
  const hours = hoursState.open
    ? t('hoursOpenUntil', { time: formatTime(hoursState.closesAt, locale) })
    : hoursState.opensAt
      ? t('hoursClosedOpens', { time: formatTime(hoursState.opensAt, locale) })
      : t('hoursClosed');
  const pickup = branch.pickup === 'today' ? t('pickupToday') : branch.pickup === 'tomorrow' ? t('pickupTomorrow') : t('shipToStore');
  return (
    <div role="group" aria-label={branch.name} className={`rounded-md border bg-surface ${focused ? 'border-border-brand' : 'border-border'}`}>
      <div id={optionId} role="option" aria-selected={focused} onClick={onFocus} className="flex cursor-pointer flex-col gap-1 p-3">
        <div className="flex items-start justify-between gap-3">
          <span className="font-display text-sm font-medium text-text">{branch.name}</span>
          {distanceKm !== undefined ? <span className="shrink-0 font-ui text-xs text-text-muted">{formatDistance(distanceKm, locale)}</span> : null}
        </div>
        <span className="font-ui text-xs text-text-muted">
          {branch.address.street}, {branch.address.postalCode} {branch.address.city}
        </span>
        <span className="flex flex-wrap items-center gap-2 font-ui text-xs">
          <span className={hoursState.open ? 'text-success-600' : 'text-danger-600'}>{hours}</span>
          <span className="text-text-muted">{pickup}</span>
          {current ? <Badge tone="info">{t('current')}</Badge> : null}
        </span>
      </div>
      {focused ? (
        <div className="px-3 pb-3">
          <Button onClick={onChoose} disabled={busy} className="w-full">
            {t('choose')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
