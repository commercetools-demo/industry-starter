'use client';

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Branches of the store (workstream U-05): list, map with one pin per branch, add, edit, remove, and the stock and price drawer.
// Branches feed the shopper store picker. Admin only: the page gates it and every route checks again.
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Dialog } from '@/components/portal/Dialog';
import { buttonDanger, buttonPrimary, buttonSecondary, buttonSmall, cardClass, errorNote, hintClass, sectionTitle, tableMinWidth, tableScroll, tdClass, thClass } from '@/components/portal/kit';
import { useToast } from '@/context/ToastContext';
import { usePermissions } from '@/hooks/usePermissions';
import { failureText } from '@/hooks/sellerHttp';
import { useBranches, useStoreActions } from '@/hooks/storeApi';
import { WEEKDAYS } from '@/lib/store/schemas';
import type { Branch } from '@/lib/store/types';
import type { MapPoint } from './BranchMap';
import { BranchForm } from './BranchForm';
import { BranchStockDrawer } from './BranchStockDrawer';
import { LazyBranchMap } from './LazyBranchMap';
import { localName } from './local-name';

export function hoursSummary(hours: Branch['openingHours']): { days: number; from: string; to: string } | null {
  const open = WEEKDAYS.map((d) => hours[d]).filter((pair): pair is [string, string] => Array.isArray(pair));
  return open.length === 0 ? null : { days: open.length, from: open[0][0], to: open[0][1] };
}

export function BranchesPanel({ timezone }: { timezone: string }) {
  const t = useTranslations('store.branches');
  const tPickup = useTranslations('store.branches.pickup');
  const locale = useLocale();
  const { toast } = useToast();
  const { can } = usePermissions();
  const editable = can('store.edit');
  const { data, error, isLoading } = useBranches();
  const { removeBranch } = useStoreActions();
  const [form, setForm] = useState<{ branch: Branch | null } | null>(null);
  const [stockFor, setStockFor] = useState<Branch | null>(null);
  const [removing, setRemoving] = useState<Branch | null>(null);
  const [removeError, setRemoveError] = useState('');
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  const branches = useMemo(() => data?.branches ?? [], [data]);
  const points: MapPoint[] = useMemo(
    () => branches.flatMap((b) => (b.geoLocation ? [{ key: b.key, name: localName(b.name, locale, b.key), lat: b.geoLocation.lat, lng: b.geoLocation.lng }] : [])),
    [branches, locale],
  );

  async function onRemove() {
    if (!removing) return;
    setRemoveError('');
    const result = await removeBranch(removing.key);
    if (!result.ok) return setRemoveError(failureText(result, t('removeFailed')));
    toast(t('removed', { name: localName(removing.name, locale, removing.key) }));
    setRemoving(null);
  }

  return (
    <section className={`${cardClass} flex flex-col gap-400`} aria-labelledby="store-branches">
      <div className="flex flex-wrap items-center justify-between gap-300">
        <div>
          <h2 id="store-branches" className={sectionTitle}>
            {t('title')}
          </h2>
          <p className={hintClass}>{t('subtitle')}</p>
        </div>
        <button type="button" onClick={() => setForm({ branch: null })} disabled={!editable} className={buttonPrimary}>
          {t('add')}
        </button>
      </div>
      {error ? <p role="alert" className={errorNote}>{t('loadFailed')}</p> : null}
      {isLoading ? <p role="status" className={hintClass}>{t('loading')}</p> : null}
      {data && branches.length === 0 ? <p className={hintClass}>{t('empty')}</p> : null}
      {branches.length > 0 ? (
        <div className="grid gap-400 xl:grid-cols-[1fr_1fr]">
          <div className={tableScroll} role="group" tabIndex={0} aria-labelledby="store-branches">
            <table className={`w-full ${tableMinWidth}`} aria-labelledby="store-branches">
              <thead>
                <tr>
                  <th scope="col" className={thClass}>{t('name')}</th>
                  <th scope="col" className={thClass}>{t('address')}</th>
                  <th scope="col" className={thClass}>{t('pickupColumn')}</th>
                  <th scope="col" className={thClass}>{t('hoursColumn')}</th>
                  <th scope="col" className={thClass}>
                    <span className="sr-only">{t('actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => {
                  const summary = hoursSummary(b.openingHours);
                  const name = localName(b.name, locale, b.key);
                  return (
                    <tr key={b.key} className={`border-t border-border-subdued ${focusedKey === b.key ? 'bg-bg-surface-subdued' : ''}`}>
                      <td className={`${tdClass} font-semibold`}>
                        <button type="button" onClick={() => setFocusedKey(b.key)} className="text-left font-semibold text-text focus-visible:outline-2 focus-visible:outline-border-active">
                          {name}
                        </button>
                        {b.phone ? <p className={hintClass}>{b.phone}</p> : null}
                      </td>
                      <td className={tdClass}>
                        {[b.address.streetName, b.address.streetNumber].filter(Boolean).join(' ')}
                        <br />
                        {b.address.postalCode} {b.address.city}
                      </td>
                      <td className={tdClass}>{tPickup(b.pickupMode)}</td>
                      <td className={tdClass}>{summary ? t('hoursSummary', summary) : t('closedAllWeek')}</td>
                      <td className={`${tdClass} whitespace-nowrap`}>
                        <div className="flex flex-wrap gap-200">
                          <button type="button" onClick={() => setStockFor(b)} disabled={!editable} className={buttonSmall} aria-label={t('stockFor', { name })}>
                            {t('stockButton')}
                          </button>
                          <button type="button" onClick={() => setForm({ branch: b })} disabled={!editable} className={buttonSmall} aria-label={t('editFor', { name })}>
                            {t('edit')}
                          </button>
                          <button type="button" onClick={() => setRemoving(b)} disabled={!editable} className={buttonSmall} aria-label={t('removeFor', { name })}>
                            {t('remove')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="h-6400 xl:h-auto xl:min-h-6400">
            <LazyBranchMap points={points} focusedKey={focusedKey} onFocus={setFocusedKey} label={t('mapLabel')} />
          </div>
        </div>
      ) : null}
      {editable ? null : <p className={hintClass}>{t('readOnly')}</p>}

      {form ? <BranchForm key={form.branch?.key ?? 'new'} branch={form.branch} others={form.branch ? points.filter((p) => p.key !== form.branch?.key) : points} storeTimezone={timezone} onClose={() => setForm(null)} /> : null}
      {stockFor ? <BranchStockDrawer branch={stockFor} onClose={() => setStockFor(null)} /> : null}
      <Dialog
        open={removing !== null}
        title={t('removeTitle', { name: removing ? localName(removing.name, locale, removing.key) : '' })}
        onClose={() => setRemoving(null)}
        footer={
          <>
            <button type="button" onClick={() => setRemoving(null)} className={buttonSecondary}>
              {t('cancel')}
            </button>
            <button type="button" onClick={onRemove} className={buttonDanger}>
              {t('confirmRemove')}
            </button>
          </>
        }
      >
        <p>{t('removeBody')}</p>
        {removeError ? <p role="alert" className={errorNote}>{removeError}</p> : null}
      </Dialog>
    </section>
  );
}
