import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { ContractNote, ContractTable } from '@/components/account/ContractTable';
import { PanelUnavailable } from '@/components/account/PanelUnavailable';
import { Button } from '@/components/ui/Button';
import { deriveContractRows } from '@/lib/account/contract';
import type { Locale } from '@/lib/types';
import { attempt, loadOrders, loadRecurringOrNull, todayUtc } from './load';

export async function ContractPanel({ customerId, locale }: { customerId: string; locale: Locale }): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'account' });
  const rows = await attempt('contract', async () => {
    const [orders, recurring] = await Promise.all([loadOrders(customerId, locale), loadRecurringOrNull(customerId)]);
    return deriveContractRows(orders, recurring, todayUtc());
  });
  if (rows === null) return <PanelUnavailable />;
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-start gap-5">
        <p className="m-0 text-md">{t('contract.empty')}</p>
        <Button href="/shop/phone-plans">{t('recent.browse')}</Button>
      </div>
    );
  }
  return (
    <div>
      <ContractTable rows={rows} />
      <ContractNote />
    </div>
  );
}
