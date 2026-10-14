/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useLocale, useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';
import { greetingKey } from '@/lib/dashboard/greeting';

/** Greeting (server clock in Europe/Berlin) and the subtitle "{store} · {region} · {currency}". No action: the dashboard has none. */
export function DashboardHeader({ now, name, store, region, currency }: { now: Date; name: string; store: string; region: string; currency: string }) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  let regionName = region;
  try {
    regionName = region ? (new Intl.DisplayNames([locale], { type: 'region' }).of(region) ?? region) : '';
  } catch {
    regionName = region;
  }
  const subtitle = [store, regionName, currency].filter(Boolean).join(' · ');
  return <PageHeader title={t(`greeting.${greetingKey(now)}`, { name })} subtitle={subtitle} />;
}
