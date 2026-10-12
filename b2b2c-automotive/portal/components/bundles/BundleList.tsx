'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Fragment, useState } from 'react';
import { Chip } from '@/components/portal/Chip';
import { buttonSmall, cardClass, errorNote, hintClass, sectionTitle, tableMinWidth, tableScroll, tdClass, thClass } from '@/components/portal/kit';
import { useToast } from '@/context/ToastContext';
import { useViewer } from '@/context/ViewerContext';
import { bundleApi, type BundleView } from '@/hooks/marketingApi';
import { getLocalizedString } from '@/lib/utils';
import { formatEur } from './money';

const KNOWN = ['COMPONENT_NOT_ASSIGNED', 'COMPONENT_PRICE', 'BUNDLE_PRICE'];

export function BundleList({ bundles, loading, failed, onChanged }: { bundles: BundleView[]; loading: boolean; failed: boolean; onChanged: () => void | Promise<unknown> }) {
  const t = useTranslations('bundles');
  const tp = useTranslations('permissions');
  const locale = useLocale();
  const { storeKey } = useViewer();
  const { toast } = useToast();
  const [busyKey, setBusyKey] = useState('');
  const [problem, setProblem] = useState('');

  async function publish(bundle: BundleView) {
    setBusyKey(bundle.key);
    setProblem('');
    const result = await bundleApi.publish(storeKey, bundle.key);
    setBusyKey('');
    if (!result.ok) {
      const sku = typeof result.details?.sku === 'string' ? result.details.sku : '';
      setProblem(result.status === 403 ? tp('insufficient') : result.code && KNOWN.includes(result.code) ? t(`errors.${result.code}` as 'errors.generic', { sku, min: 0, max: 0 }) : t('errors.generic'));
      return;
    }
    toast(t('list.published'));
    await onChanged();
  }

  return (
    <section className={`${cardClass} flex flex-col gap-400`} aria-labelledby="bundle-list-title">
      <h2 id="bundle-list-title" className={sectionTitle}>
        {t('list.title')}
      </h2>
      {problem ? (
        <p role="alert" className={errorNote}>
          {problem}
        </p>
      ) : null}
      {failed ? <p className={errorNote}>{t('list.error')}</p> : null}
      {loading ? <p className={hintClass}>{t('list.loading')}</p> : null}
      {!loading && !failed && bundles.length === 0 ? <p className={hintClass}>{t('list.empty')}</p> : null}
      {bundles.length > 0 ? (
        <div className={tableScroll}>
          <table className={`w-full ${tableMinWidth}`}>
            <thead>
              <tr>
                <th scope="col" className={thClass}>
                  {t('list.bundle')}
                </th>
                <th scope="col" className={thClass}>
                  {t('list.components')}
                </th>
                <th scope="col" className={thClass}>
                  {t('list.componentsPrice')}
                </th>
                <th scope="col" className={thClass}>
                  {t('list.bundlePrice')}
                </th>
                <th scope="col" className={thClass}>
                  {t('list.saving')}
                </th>
                <th scope="col" className={thClass}>
                  {t('list.status')}
                </th>
              </tr>
            </thead>
            <tbody>
              {bundles.map((b) => {
                const label = getLocalizedString(b.name, locale) || b.sku;
                return (
                  <Fragment key={b.key}>
                    <tr className="border-t border-border">
                      <td className={tdClass}>
                        <span className="font-semibold">{label}</span>
                        <span className="block text-caption-1 text-text-subdued">{b.sku}</span>
                      </td>
                      <td className={tdClass}>
                        <ul>
                          {b.components.map((c) => (
                            <li key={c.sku}>
                              {getLocalizedString(c.name, locale) || c.sku} × {c.qty}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className={tdClass}>{formatEur(b.componentsCents, locale)}</td>
                      <td className={tdClass}>{b.bundleCents === null ? t('list.noPrice') : formatEur(b.bundleCents, locale)}</td>
                      <td className={tdClass}>{b.savingCents === null ? '—' : formatEur(b.savingCents, locale)}</td>
                      <td className={tdClass}>
                        <span className="flex flex-wrap items-center gap-200">
                          <Chip tone={b.status === 'Live' ? 'success' : 'neutral'}>{b.status === 'Live' ? t('list.live') : t('list.draft')}</Chip>
                          {b.status === 'Draft' ? (
                            <button type="button" className={buttonSmall} disabled={busyKey === b.key} aria-label={t('list.publishAria', { name: label })} onClick={() => publish(b)}>
                              {t('list.publish')}
                            </button>
                          ) : null}
                        </span>
                      </td>
                    </tr>
                    {b.unavailableSku ? (
                      <tr>
                        <td colSpan={6} className="px-300 pb-300">
                          <Chip tone="warning">{t('list.hidden', { sku: b.unavailableSku })}</Chip>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
