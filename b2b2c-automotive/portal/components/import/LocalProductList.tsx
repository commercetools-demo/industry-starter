'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { formatEur } from '@/components/bundles/money';
import { Chip, type ChipTone } from '@/components/portal/Chip';
import { cardClass, errorNote, hintClass, sectionTitle, tableMinWidth, tableScroll, tdClass, thClass } from '@/components/portal/kit';
import { useViewer } from '@/context/ViewerContext';
import { useLocalProducts, type LocalProductRow } from '@/hooks/marketingApi';
import { getLocalizedString } from '@/lib/utils';

const TONE: Record<LocalProductRow['status'], ChipTone> = { Live: 'success', 'Awaiting review': 'warning', Rejected: 'critical' };

/** "Local products": the store's own parts with their review state. The row named by `highlightKey` is marked and focused. */
export function LocalProductList({ highlightKey }: { highlightKey?: string }) {
  const t = useTranslations('importPage');
  const locale = useLocale();
  const { storeKey } = useViewer();
  const { data, error, isLoading } = useLocalProducts(storeKey);
  const rows = data?.products ?? [];
  const marked = useRef<HTMLTableRowElement | null>(null);
  useEffect(() => {
    marked.current?.scrollIntoView?.({ block: 'center' });
    marked.current?.focus();
  }, [highlightKey, rows.length]);

  const status = (s: LocalProductRow['status']) => (s === 'Live' ? t('local.live') : s === 'Rejected' ? t('local.rejected') : t('local.awaiting'));
  return (
    <section className={`${cardClass} flex flex-col gap-400`} aria-labelledby="local-list-title">
      <h2 id="local-list-title" className={sectionTitle}>
        {t('local.title')}
      </h2>
      {error ? <p className={errorNote}>{t('local.error')}</p> : null}
      {isLoading ? <p className={hintClass}>{t('local.loading')}</p> : null}
      {!isLoading && !error && rows.length === 0 ? <p className={hintClass}>{t('local.empty')}</p> : null}
      {rows.length > 0 ? (
        <div className={tableScroll} role="group" tabIndex={0} aria-labelledby="local-list-title">
          <table className={`w-full ${tableMinWidth}`}>
            <caption className="sr-only">{t('local.title')}</caption>
            <thead>
              <tr>
                <th scope="col" className={thClass}>
                  {t('local.name')}
                </th>
                <th scope="col" className={thClass}>
                  {t('local.sku')}
                </th>
                <th scope="col" className={thClass}>
                  {t('local.price')}
                </th>
                <th scope="col" className={thClass}>
                  {t('local.status')}
                </th>
                <th scope="col" className={thClass}>
                  {t('local.vehicles')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isMarked = highlightKey !== undefined && r.key === highlightKey;
                return (
                  <tr key={r.key} ref={isMarked ? marked : undefined} tabIndex={isMarked ? -1 : undefined} aria-current={isMarked ? 'true' : undefined} className={`border-t border-border focus-visible:outline-2 focus-visible:outline-border-active ${isMarked ? 'bg-bg-info-subdued' : ''}`}>
                    <td className={tdClass}>{getLocalizedString(r.name, locale) || r.sku}</td>
                    <td className={tdClass}>{r.sku}</td>
                    <td className={tdClass}>{r.priceCents === null ? '—' : formatEur(r.priceCents, locale)}</td>
                    <td className={tdClass}>
                      <Chip tone={TONE[r.status]}>{status(r.status)}</Chip>
                    </td>
                    <td className={tdClass}>
                      {r.claimedVehicles.length === 0 ? (
                        t('local.none')
                      ) : (
                        <ul>
                          {r.claimedVehicles.map((v) => (
                            <li key={v}>{v.split('|').join(' ')}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
