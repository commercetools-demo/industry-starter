/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { KpiTile, StateTabs, TableCard } from '@/components/customers/shared';
import { buttonPrimary, errorNote, infoNote, tdClass, thClass } from '@/components/portal/kit';
import { useToast } from '@/context/ToastContext';
import { useViewer } from '@/context/ViewerContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useReturns } from '@/hooks/vApi';
import { money } from '@/lib/v-format';
import { RecordReturnDialog } from './RecordReturnDialog';
import { ReturnDrawer } from './ReturnDrawer';
import { StatusChip } from './StatusChip';

/** Returns (V-13): tabs Open and Closed, KPIs, the table, "Record a return" and the detail drawer. */
export function ReturnsPage() {
  const t = useTranslations('returns');
  const locale = useLocale();
  const { toast } = useToast();
  const { storeKey } = useViewer();
  const { can } = usePermissions();
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const { data, error, mutate } = useReturns(storeKey, tab, locale);
  const [selected, setSelected] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);

  return (
    <div className="flex flex-col gap-400">
      <div className="grid grid-cols-1 gap-300 sm:grid-cols-3">
        <KpiTile id="open" label={t('kpis.open')} value={data ? new Intl.NumberFormat(locale).format(data.kpis.open) : '-'} />
        <KpiTile id="rate" label={t('kpis.rate')} value={data ? `${new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(data.kpis.returnRatePercent)} %` : '-'} note={t('kpis.rateNote')} />
        <KpiTile id="refunded" label={t('kpis.refunded')} value={data ? money(data.kpis.refundedThisMonthCents, data.kpis.currency, locale) : '-'} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-300">
        <StateTabs ariaLabel={t('tabsLabel')} value={tab} onChange={setTab} tabs={(['open', 'closed'] as const).map((id) => ({ id, label: t(`tabs.${id}`) }))} />
        {can('returns.process') ? (
          <button type="button" className={buttonPrimary} onClick={() => setRecording(true)}>
            {t('record.button')}
          </button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className={errorNote}>
          {t('error')}
        </p>
      ) : !data ? (
        <p role="status" className={infoNote}>
          {t('loading')}
        </p>
      ) : data.rows.length === 0 ? (
        <p className={infoNote}>{t('empty')}</p>
      ) : (
        <TableCard>
          <table className="w-full min-w-[calc(var(--space-6400)*2)] border-collapse">
            <caption className="sr-only">{t('title')}</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className={thClass}>{t('columns.number')}</th>
                <th scope="col" className={thClass}>{t('columns.order')}</th>
                <th scope="col" className={thClass}>{t('columns.customer')}</th>
                <th scope="col" className={thClass}>{t('columns.items')}</th>
                <th scope="col" className={thClass}>{t('columns.tracking')}</th>
                <th scope="col" className={thClass}>{t('columns.status')}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.returnNumber} className="border-b border-border last:border-b-0" data-testid={`return-${row.returnNumber}`}>
                  <td className={tdClass}>
                    <button type="button" aria-label={t('open', { number: row.returnNumber })} className="font-semibold text-text underline focus-visible:outline-2 focus-visible:outline-border-active" onClick={() => setSelected(row.returnNumber)}>
                      {row.returnNumber}
                    </button>
                  </td>
                  <td className={tdClass}>{row.orderNumber}</td>
                  <td className={tdClass}>{row.customer}</td>
                  <td className={tdClass}>{row.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}</td>
                  <td className={tdClass}>{row.tracking}</td>
                  <td className={tdClass}>
                    <StatusChip status={row.status} refundState={row.refundState} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      )}

      <RecordReturnDialog
        open={recording}
        storeKey={storeKey}
        onClose={() => setRecording(false)}
        onCreated={(result) => {
          setRecording(false);
          toast(t('record.created', { number: result.returnNumber, tracking: result.tracking }));
          void mutate();
        }}
      />
      <ReturnDrawer storeKey={storeKey} number={selected} canProcess={can('returns.process')} onClose={() => setSelected(null)} onChanged={() => void mutate()} />
    </div>
  );
}
