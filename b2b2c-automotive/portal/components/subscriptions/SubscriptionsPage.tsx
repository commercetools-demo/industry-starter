'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { KpiTile, StateTabs, TableCard } from '@/components/customers/shared';
import { Chip } from '@/components/portal/Chip';
import { Dialog } from '@/components/portal/Dialog';
import { buttonSecondary, errorNote, infoNote, tdClass, thClass } from '@/components/portal/kit';
import { useToast } from '@/context/ToastContext';
import { useViewer } from '@/context/ViewerContext';
import { subscriptionApi, useSubscriptionAudit, useSubscriptions } from '@/hooks/vApi';
import { money, shortDate } from '@/lib/v-format';
import type { SubscriptionAction, SubscriptionRow, SubscriptionStatus } from '@/lib/v-types';
import { SubscriptionActions } from './SubscriptionActions';

const TONE = { Active: 'success', Paused: 'warning', Canceled: 'neutral' } as const;

export function SubscriptionsPage() {
  const t = useTranslations('subscriptions');
  const locale = useLocale();
  const { toast } = useToast();
  const { storeKey } = useViewer();
  const { data, error, mutate } = useSubscriptions(storeKey, locale);
  const [tab, setTab] = useState<'active' | 'paused' | 'canceled'>('active');
  const [auditId, setAuditId] = useState<string | null>(null);
  const audit = useSubscriptionAudit(storeKey, auditId);

  const interval = (row: SubscriptionRow): string =>
    row.interval.kind === 'dayOfMonth' ? t('interval.dayOfMonth', { day: row.interval.day }) : t(`interval.${row.interval.unit.toLowerCase() as 'days' | 'weeks' | 'months'}`, { count: row.interval.value });

  const run = (row: SubscriptionRow) => async (action: SubscriptionAction): Promise<string | null> => {
    const result = await subscriptionApi.run(storeKey, row.id, action);
    if (result.ok) {
      toast(t(`toasts.${action}`));
      void mutate();
      return null;
    }
    void mutate();
    if (result.status === 403) return t('errors.forbidden');
    if (result.code === 'NOT_ACTIVE') return t('errors.notActive');
    if (result.code === 'BUSY') return t('errors.busy');
    if (result.code === 'INVALID_TRANSITION' || result.code === 'SKIP_PENDING') return t('errors.invalid');
    return t('errors.generic');
  };

  const wanted: SubscriptionStatus = tab === 'active' ? 'Active' : tab === 'paused' ? 'Paused' : 'Canceled';
  const rows = (data?.rows ?? []).filter((r) => r.status === wanted);
  const number = (n: number) => new Intl.NumberFormat(locale).format(n);

  return (
    <div className="flex flex-col gap-400">
      <div className="grid grid-cols-2 gap-300 lg:grid-cols-4">
        <KpiTile id="monthly" label={t('kpis.monthly')} value={data ? money(data.kpis.monthlyCents, data.kpis.currency, locale) : '-'} />
        <KpiTile id="active" label={t('kpis.active')} value={data ? number(data.kpis.active) : '-'} />
        <KpiTile id="paused" label={t('kpis.paused')} value={data ? number(data.kpis.paused) : '-'} />
        <KpiTile id="canceled" label={t('kpis.canceled')} value={data ? number(data.kpis.canceled) : '-'} />
      </div>

      <section aria-label={t('renewals.title')} className="flex flex-col gap-200 rounded-200 bg-bg-surface p-400 shadow-card">
        <h2 className="text-title-1 font-semibold text-text">{t('renewals.title')}</h2>
        {data && data.renewals.length > 0 ? (
          <ul className="flex flex-col gap-150 text-body-2">
            {data.renewals.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-200">
                <span className="font-semibold">{shortDate(r.nextOrderAt, locale)}</span>
                <span>{r.customer}</span>
                <span className="text-text-subdued">{r.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body-2 text-text-subdued">{t('renewals.empty')}</p>
        )}
      </section>

      <StateTabs
        ariaLabel={t('tabsLabel')}
        value={tab}
        onChange={setTab}
        tabs={(['active', 'paused', 'canceled'] as const).map((id) => ({ id, label: t(`tabs.${id}`) }))}
      />

      {error ? (
        <p role="alert" className={errorNote}>
          {t('error')}
        </p>
      ) : !data ? (
        <p role="status" className={infoNote}>
          {t('loading')}
        </p>
      ) : rows.length === 0 ? (
        <p className={infoNote}>{t('empty')}</p>
      ) : (
        <TableCard>
          <table className="w-full min-w-[calc(var(--space-6400)*3)] border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className={thClass}>{t('columns.customer')}</th>
                <th className={thClass}>{t('columns.items')}</th>
                <th className={thClass}>{t('columns.interval')}</th>
                <th className={thClass}>{t('columns.next')}</th>
                <th className={`${thClass} text-right`}>{t('columns.value')}</th>
                <th className={thClass}>{t('columns.status')}</th>
                <th className={thClass}>{t('columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border align-top last:border-b-0" data-testid={`subscription-${row.id}`}>
                  <td className={`${tdClass} font-semibold`}>{row.customer}</td>
                  <td className={tdClass}>{row.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}</td>
                  <td className={tdClass}>{interval(row)}</td>
                  <td className={tdClass}>{row.nextOrderAt ? shortDate(row.nextOrderAt, locale) : t('noRenewal')}</td>
                  <td className={`${tdClass} text-right`}>{money(row.valueCents, row.currency, locale)}</td>
                  <td className={tdClass}>
                    <span className="inline-flex flex-wrap items-center gap-100">
                      <Chip tone={TONE[row.status]}>{t(`status.${row.status}`)}</Chip>
                      {row.needsAttention ? <Chip tone="critical">{t('attention')}</Chip> : null}
                      {row.skipsRemaining > 0 ? <Chip tone="info">{t('skipPending')}</Chip> : null}
                    </span>
                  </td>
                  <td className={tdClass}>
                    <SubscriptionActions row={row} onRun={run(row)} onAudit={() => setAuditId(row.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      )}

      <Dialog
        open={auditId !== null}
        variant="drawer"
        title={t('audit.title')}
        onClose={() => setAuditId(null)}
        footer={
          <button type="button" className={buttonSecondary} onClick={() => setAuditId(null)}>
            {t('audit.close')}
          </button>
        }
      >
        {!audit.data ? (
          <p role="status">{t('loading')}</p>
        ) : audit.data.entries.length === 0 ? (
          <p>{t('audit.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-200">
            {audit.data.entries.map((e) => (
              <li key={`${e.at}-${e.action}`} className="flex flex-col">
                <span className="font-semibold">{t('audit.line', { action: t(`actions.${e.action}`), from: e.from, to: e.to })}</span>
                <span className="text-caption-1 text-text-subdued">{`${shortDate(e.at, locale)}, ${t('audit.by', { by: e.by })}`}</span>
              </li>
            ))}
          </ul>
        )}
      </Dialog>
    </div>
  );
}
