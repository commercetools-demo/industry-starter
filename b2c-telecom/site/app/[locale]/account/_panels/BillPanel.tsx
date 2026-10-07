import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { PanelUnavailable } from '@/components/account/PanelUnavailable';
import { SummaryCard } from '@/components/account/SummaryCards';
import { deriveContractRows, deriveMonthlyBill, nextBillDate } from '@/lib/account/contract';
import { formatDate } from '@/lib/account/format';
import { formatMoneyExact } from '@/lib/format';
import { marketFromLocale } from '@/lib/config/markets';
import type { Locale } from '@/lib/types';
import { attempt, loadOrders, loadRecurringOrNull, todayUtc } from './load';

/** MONTHLY BILL: the sum of the current prices of the contract rows, and the next bill date of the platform's recurring orders. */
export async function BillPanel({ customerId, locale }: { customerId: string; locale: Locale }): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'account' });
  const data = await attempt('monthly bill', async () => {
    const [orders, recurring] = await Promise.all([loadOrders(customerId, locale), loadRecurringOrNull(customerId)]);
    const rows = deriveContractRows(orders, recurring, todayUtc());
    const next = recurring ? nextBillDate(recurring) : null;
    return {
      amount: formatMoneyExact(deriveMonthlyBill(rows, marketFromLocale(locale).currency), locale),
      note: recurring === null ? t('nextBillUnavailable') : next ? t('nextBill', { date: formatDate(next, locale) }) : t('noBills'),
    };
  });
  return (
    <SummaryCard label={t('card.bill')}>
      {data ? (
        <>
          <p className="m-0 font-display text-4xl font-bold">{data.amount}</p>
          <p className="m-0 text-md text-text-muted">{data.note}</p>
        </>
      ) : (
        <PanelUnavailable />
      )}
    </SummaryCard>
  );
}
