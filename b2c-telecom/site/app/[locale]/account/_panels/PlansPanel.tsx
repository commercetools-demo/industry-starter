import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { PanelUnavailable } from '@/components/account/PanelUnavailable';
import { PlanLabels } from '@/components/account/PlanLabels';
import { deriveActivePlans } from '@/lib/account/contract';
import type { Locale } from '@/lib/types';
import { attempt, loadOrders, loadRecurringOrNull, todayUtc } from './load';

export async function PlansPanel({ customerId, locale }: { customerId: string; locale: Locale }): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'account' });
  const plans = await attempt('plans', async () => {
    const [orders, recurring] = await Promise.all([loadOrders(customerId, locale), loadRecurringOrNull(customerId)]);
    return deriveActivePlans(orders, recurring, todayUtc());
  });
  if (plans === null) return <PanelUnavailable />;
  if (plans.length === 0) return <p className="m-0 text-md">{t('plans.empty')}</p>;
  return <PlanLabels plans={plans} />;
}
