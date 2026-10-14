// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { PageTitle, Panel } from '@/components/account/Panel';
import { PickupReadyNotice, type PickupReady } from '@/components/account/PickupReadyNotice';
import { StatusBadge } from '@/components/account/StatusBadge';
import { buttonClass } from '@/components/ui/Button';
import { ChangeVehicleDialog } from '@/components/vehicle/ChangeVehicleDialog';
import { VehicleChip } from '@/components/vehicle/VehicleChip';
import { useGarage } from '@/hooks/useGarage';
import { Link } from '@/i18n/routing';
import { formatDate } from '@/lib/account/format';
import type { OrderStatus } from '@/lib/types';

interface Props {
  store: string;
  firstName: string | null;
  latest: { number: string; createdAt: string; status: OrderStatus } | null;
  /** Orders in the `ready-for-pickup` state (state key), newest first. */
  ready: PickupReady[];
  timeZone: string;
}

/** The account home: pickup-ready notice(s) on top, greeting, the active vehicle with a change link, the latest order's status and quick links. */
export function OverviewPanel({ store, firstName, latest, ready, timeZone }: Props) {
  const t = useTranslations('account.overview');
  const locale = useLocale();
  const { active } = useGarage();
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const base = `/${store}/account`;

  return (
    <div className="grid gap-5">
      <PageTitle>{firstName ? t('greeting', { name: firstName }) : t('greetingPlain')}</PageTitle>
      {ready.map((r) => (
        <PickupReadyNotice key={r.orderNumber} ready={r} store={store} />
      ))}
      <div className="grid gap-5 min-[64rem]:grid-cols-2">
        <Panel title={t('vehicleTitle')} titleId="overview-vehicle">
          {active ? <VehicleChip label={active.label} /> : <p className="m-0 font-ui text-sm text-text-muted">{t('vehicleNone')}</p>}
          <div>
            <button ref={opener} type="button" onClick={() => setOpen(true)} className={buttonClass('secondary')}>
              {active ? t('vehicleChange') : t('vehicleChoose')}
            </button>
          </div>
          <ChangeVehicleDialog open={open} onClose={() => setOpen(false)} returnFocusTo={opener} />
        </Panel>
        <Panel title={t('latestTitle')} titleId="overview-latest">
          {latest ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={latest.status} />
                <span className="font-ui text-sm text-text-body">{t('latestLine', { number: latest.number, date: formatDate(latest.createdAt, locale, timeZone) })}</span>
              </div>
              <div>
                <Link href={`${base}/orders/${latest.number}`} className={buttonClass('secondary')}>
                  {t('latestView')}
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="m-0 font-ui text-sm text-text-muted">{t('latestNone')}</p>
              <div>
                <Link href={`/${store}/parts`} className={buttonClass('secondary')}>
                  {t('startShopping')}
                </Link>
              </div>
            </>
          )}
        </Panel>
      </div>
      <Panel title={t('quickLinks')} titleId="overview-links">
        <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
          {(['orders', 'garage', 'addresses'] as const).map((key) => (
            <li key={key}>
              <TopLink href={`${base}/${key}`} label={key} />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function TopLink({ href, label }: { href: string; label: 'orders' | 'garage' | 'addresses' }) {
  const tm = useTranslations('account.menu');
  return (
    <Link href={href} className={buttonClass('secondary')}>
      {tm(label)}
    </Link>
  );
}
