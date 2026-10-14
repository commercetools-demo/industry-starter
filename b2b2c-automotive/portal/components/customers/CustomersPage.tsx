/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { KpiTile, StateTabs, TableCard } from '@/components/customers/shared';
import { Chip } from '@/components/portal/Chip';
import { buttonSecondary, errorNote, infoNote, inputClass, tdClass, thClass } from '@/components/portal/kit';
import { useViewer } from '@/context/ViewerContext';
import { useCustomers } from '@/hooks/vApi';
import { Link } from '@/i18n/routing';
import { money, shortDate } from '@/lib/v-format';
import type { CustomerTab } from '@/lib/v-types';

const PAGE = 50;

/** Customers list (V-04): tabs All, Registered and Guests, KPIs, search, table with masked e-mail, 50 per page. */
export function CustomersPage() {
  const t = useTranslations('customers');
  const locale = useLocale();
  const { storeKey } = useViewer();
  const [tab, setTab] = useState<CustomerTab>('all');
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const { data, error } = useCustomers(storeKey, tab, query.trim(), offset);

  const tabs = (['all', 'registered', 'guests'] as const).map((id) => ({ id, label: t(`tabs.${id}`) }));
  const total = data?.total ?? 0;

  return (
    <div className="flex flex-col gap-400">
      <div className="grid grid-cols-1 gap-300 sm:grid-cols-3">
        <KpiTile id="registered" label={t('kpis.registered')} value={data ? new Intl.NumberFormat(locale).format(data.kpis.registered) : '-'} />
        <KpiTile id="guests" label={t('kpis.guests')} value={data ? new Intl.NumberFormat(locale).format(data.kpis.guests) : '-'} />
        <KpiTile id="repeat" label={t('kpis.repeat')} value={data ? `${new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(data.kpis.repeatRate)} %` : '-'} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-300">
        <StateTabs
          ariaLabel={t('tabsLabel')}
          tabs={tabs}
          value={tab}
          onChange={(id) => {
            setTab(id);
            setOffset(0);
          }}
        />
        <div className="w-full max-w-[calc(var(--space-6400)*2)]">
          <label htmlFor="customer-search" className="sr-only">
            {t('searchLabel')}
          </label>
          <input
            id="customer-search"
            type="search"
            className={inputClass}
            placeholder={t('search')}
            value={query}
            autoComplete="off"
            onChange={(e) => {
              setQuery(e.target.value);
              setOffset(0);
            }}
          />
        </div>
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
        <TableCard caption={tab === 'guests' ? t('guestsCaption') : data.truncated ? t('truncated') : undefined}>
          <table className="w-full min-w-[calc(var(--space-6400)*2)] border-collapse">
            <caption className="sr-only">{t('title')}</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className={thClass}>{t('columns.name')}</th>
                <th scope="col" className={thClass}>{t('columns.type')}</th>
                <th scope="col" className={`${thClass} text-right`}>{t('columns.orders')}</th>
                <th scope="col" className={`${thClass} text-right`}>{t('columns.lifetime')}</th>
                <th scope="col" className={thClass}>{t('columns.last')}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id ?? `${row.name}-${row.email}`} className="border-b border-border last:border-b-0">
                  <td className={tdClass}>
                    {row.id ? (
                      <Link href={`/customers/${row.id}`} aria-label={t('open', { name: row.name })} className="inline-flex min-h-600 items-center font-semibold text-text underline focus-visible:outline-2 focus-visible:outline-border-active">
                        {row.name}
                      </Link>
                    ) : (
                      <span className="font-semibold">{row.name}</span>
                    )}
                    <span className="block text-caption-1 text-text-subdued">{row.email}</span>
                  </td>
                  <td className={tdClass}>
                    <Chip tone={row.type === 'Registered' ? 'info' : 'neutral'}>{t(`type.${row.type}`)}</Chip>
                  </td>
                  <td className={`${tdClass} text-right`}>{row.orders}</td>
                  <td className={`${tdClass} text-right`}>{row.orders > 0 ? money(row.lifetimeCents, row.currency, locale) : '-'}</td>
                  <td className={tdClass}>{shortDate(row.lastOrderAt, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      )}

      {data && total > PAGE ? (
        <nav aria-label={t('paging.range', { from: offset + 1, to: Math.min(offset + PAGE, total), total })} className="flex items-center justify-between gap-300">
          <p className="text-body-2 font-medium text-text-subdued">{t('paging.range', { from: offset + 1, to: Math.min(offset + PAGE, total), total })}</p>
          <div className="flex gap-200">
            <button type="button" className={buttonSecondary} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
              {t('paging.prev')}
            </button>
            <button type="button" className={buttonSecondary} disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>
              {t('paging.next')}
            </button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
