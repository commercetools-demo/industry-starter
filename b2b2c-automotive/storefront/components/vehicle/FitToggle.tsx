// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { useGarage } from '@/hooks/useGarage';
import { usePathname, useRouter } from '@/i18n/routing';

/**
 * "Fits my vehicle" filter (workstream L), rendered only while a vehicle is active. On by default; turning it off writes `fit=0`
 * to the address, turning it on removes `fit`. Other parameters (brand, sort, category) are kept; `page` is dropped because the
 * result set changes. The address never carries the vehicle (D8): a shared link is judged against the opener's garage.
 */
export function FitToggle() {
  const t = useTranslations('vehicleFit');
  const id = useId();
  const { active } = useGarage();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  if (!active) return null;
  const on = params.get('fit') !== '0';

  function toggle() {
    const next = new URLSearchParams(params.toString());
    if (on) next.set('fit', '0');
    else next.delete('fit');
    next.delete('page');
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <label htmlFor={id} className="flex min-h-7 cursor-pointer items-center gap-3 font-ui text-sm text-text">
      <input id={id} type="checkbox" checked={on} onChange={toggle} className="size-5 accent-action" />
      {t('toggle')}
    </label>
  );
}
