'use client';

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Store & channels, tab Channels (workstream U-05, decisions 9 and 10): status, orders in 30 days, revenue and share of sales per
// sales channel. Attribution comes from the order's sales-channel field and is indicative where absent; the Demo channel is
// info-tinted and labelled as demo data.
import { useLocale, useTranslations } from 'next-intl';
import { Chip } from '@/components/portal/Chip';
import { cardClass, errorNote, hintClass, infoNote, sectionTitle, tableMinWidth, tableScroll, tdClass, thClass } from '@/components/portal/kit';
import { useChannelStats } from '@/hooks/storeApi';

export function ChannelsTable() {
  const t = useTranslations('store.channels');
  const locale = useLocale();
  const { data, error, isLoading } = useChannelStats();
  const money = (cents: number, currency: string) => new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);

  return (
    <section className={`${cardClass} flex flex-col gap-400`} aria-labelledby="store-channels">
      <div>
        <h2 id="store-channels" className={sectionTitle}>
          {t('title')}
        </h2>
        <p className={hintClass}>{t('subtitle', { days: data?.days ?? 30 })}</p>
      </div>
      {error ? <p role="alert" className={errorNote}>{t('loadFailed')}</p> : null}
      {isLoading && !data ? <p role="status" className={hintClass}>{t('loading')}</p> : null}
      {data ? (
        <div className={tableScroll}>
          <table className={`w-full ${tableMinWidth}`}>
            <caption className="sr-only">{t('title')}</caption>
            <thead>
              <tr>
                <th scope="col" className={thClass}>{t('channel')}</th>
                <th scope="col" className={thClass}>{t('status')}</th>
                <th scope="col" className={`${thClass} text-right`}>{t('orders')}</th>
                <th scope="col" className={`${thClass} text-right`}>{t('revenue')}</th>
                <th scope="col" className={`${thClass} text-right`}>{t('share')}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => {
                const demo = row.status === 'Demo';
                return (
                  <tr key={row.id} className="border-t border-border-subdued">
                    <th scope="row" className={`${tdClass} text-left font-semibold`}>
                      {t(`names.${row.id}`)}
                      {row.indicative && !demo ? <span className={`${hintClass} ml-150`}>{t('indicative')}</span> : null}
                    </th>
                    <td className={tdClass}>
                      <Chip tone={demo ? 'info' : 'success'}>{t(demo ? 'demo' : 'live')}</Chip>
                    </td>
                    <td className={`${tdClass} text-right`}>{row.orders}</td>
                    <td className={`${tdClass} text-right`}>
                      {money(row.revenue.centAmount, row.revenue.currencyCode)}
                      {demo ? <span className={`${hintClass} block`}>{t('demoData')}</span> : null}
                    </td>
                    <td className={`${tdClass} text-right`}>{demo ? t('noShare') : `${row.sharePercent}%`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className={infoNote}>{t('note')}</p>
      {data?.truncated ? <p className={infoNote}>{t('truncated')}</p> : null}
    </section>
  );
}
