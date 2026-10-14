/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useDeferredValue, useMemo, useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { useViewer } from '@/context/ViewerContext';
import { assortmentApi, useAssortment, useCategories, useRefreshCatalog, type Target } from '@/hooks/catalogApi';
import { usePermissions } from '@/hooks/usePermissions';
import { STATE_UI, type AssortmentState } from '@/lib/catalog/assortment-state';
import type { AssortmentFilter, AssortmentRow, Impact } from '@/lib/catalog/types';
import { formatMoney, getLocalizedString } from '@/lib/utils';
import { Chip } from './Chip';
import { ConfirmDialog } from './ConfirmDialog';
import { buttonSecondary, buttonSmall, cardClass, errorNote, infoNote, inputClass, tableMinWidth, tableScroll, tdClass, thClass } from './ui';

const PAGE = 50;
const FILTERS: AssortmentFilter[] = ['all', 'assigned', 'available', 'blocked'];

type Pending = { target: Target; count: number; label: string; impact: Impact };

const CHIP_KEY: Record<AssortmentState, string> = {
  inherited: 'inherited',
  local: 'local',
  available: 'available',
  withdrawn: 'withdrawn',
  'pre-release': 'preRelease',
  'blocked-upstream': 'blocked',
  'pending-review': 'pendingReview',
};

/** The "Assigned products" tab: filters, search, category, bulk bar, one action per row, and a confirmation before a withdraw. */
export function AssortmentTable() {
  const t = useTranslations('catalog.assortment');
  const tp = useTranslations('permissions');
  const locale = useLocale();
  const { storeKey } = useViewer();
  const { can } = usePermissions();
  const { toast } = useToast();
  const refresh = useRefreshCatalog();
  const canEdit = can('catalog.edit');

  const [filter, setFilter] = useState<AssortmentFilter>('all');
  const [search, setSearch] = useState('');
  const text = useDeferredValue(search.trim());
  const [categoryId, setCategoryId] = useState('');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  const { data, isLoading, error } = useAssortment(storeKey, { state: filter, text, categoryId: categoryId || undefined, offset, limit: PAGE });
  const { data: categories } = useCategories(storeKey);
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const actionOf = (row: AssortmentRow) => STATE_UI[row.state].actionKey;
  const selectable = (row: AssortmentRow) => ['withdraw', 'assign', 'reinstate'].includes(actionOf(row));
  const filterBody = { state: filter, text: text || undefined, categoryId: categoryId || undefined };

  const reset = () => {
    setSelected(new Set());
    setAllMatching(false);
    setOffset(0);
  };

  async function assign(target: Target) {
    setBusy(true);
    setProblem('');
    const result = await assortmentApi.assign(storeKey, target);
    setBusy(false);
    if (!result.ok) return setProblem(result.code === 'BLOCKED_UPSTREAM' ? t('errors.blocked') : result.status === 403 ? tp('insufficient') : t('errors.generic'));
    toast(t('assigned', { count: result.data?.added ?? 0 }));
    setSelected(new Set());
    setAllMatching(false);
    await refresh();
  }

  /** The first withdraw call has no confirmation: the server answers 409 with the count and the open carts, which the dialog shows. */
  async function askWithdraw(target: Target, label: string) {
    setBusy(true);
    setProblem('');
    const result = await assortmentApi.withdraw(storeKey, target, { confirm: false, expectedCount: -1 });
    setBusy(false);
    const d = result.details as { count?: number; openCartCount?: number; branches?: number } | undefined;
    if (result.status === 409 && result.code === 'CONFIRMATION_REQUIRED' && d?.count !== undefined) {
      setPending({ target, count: d.count, label, impact: { count: d.count, openCartCount: d.openCartCount ?? 0, branches: d.branches ?? 0 } });
    } else setProblem(result.status === 403 ? tp('insufficient') : t('errors.generic'));
  }

  async function confirmWithdraw() {
    if (!pending) return;
    setBusy(true);
    const result = await assortmentApi.withdraw(storeKey, pending.target, { confirm: true, expectedCount: pending.count });
    setBusy(false);
    setPending(null);
    if (!result.ok) return setProblem(result.status === 403 ? tp('insufficient') : t('errors.generic'));
    toast(t('withdrawn', { count: result.data?.removed ?? 0 }));
    setSelected(new Set());
    setAllMatching(false);
    await refresh();
  }

  const selectedRows = rows.filter((r) => selected.has(r.productId));
  const withdrawIds = selectedRows.filter((r) => actionOf(r) === 'withdraw').map((r) => r.productId);
  const assignIds = selectedRows.filter((r) => ['assign', 'reinstate'].includes(actionOf(r))).map((r) => r.productId);
  const pageAllSelected = rows.filter(selectable).length > 0 && rows.filter(selectable).every((r) => selected.has(r.productId));
  const total = data?.total ?? 0;

  const reasonOf = (row: AssortmentRow) => {
    if (row.state === 'blocked-upstream') return row.reasonBy ? `${row.reasonBy}: ${row.reason}` : row.reason;
    if (row.state === 'withdrawn') return row.reason && row.reason !== 'Withdrawn by you' ? row.reason : t('reasons.withdrawn');
    if (row.state === 'inherited') return t('reasons.inherited');
    if (row.state === 'local') return t('reasons.local');
    if (row.state === 'pre-release') return t('reasons.preRelease');
    if (row.state === 'pending-review') return t('reasons.pendingReview');
    return t('reasons.available');
  };

  return (
    <section className={`${cardClass} flex flex-col gap-400`} aria-labelledby="assortment-title">
      <div className="flex flex-wrap items-center justify-between gap-300">
        <div>
          <h2 id="assortment-title" className="text-title-1 font-semibold text-text">
            {t('title')}
          </h2>
          <p data-testid="assortment-count" className="text-body-2 font-medium text-text-subdued">
            {data ? t('counter', { assigned: data.assigned, total: data.totalMaster }) : '…'}
          </p>
        </div>
        <div role="group" aria-label={t('filters.label')} className="flex gap-100 rounded-300 bg-bg-surface-subdued p-100">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => {
                setFilter(f);
                reset();
              }}
              className={`h-1000 rounded-200 px-300 text-body-2 font-semibold focus-visible:outline-2 focus-visible:outline-border-active ${filter === f ? 'bg-bg-surface text-text shadow-button' : 'text-text-subdued hover:text-text'}`}
            >
              {t(`filters.${f}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-300">
        <label className="min-w-0 flex-1">
          <span className="sr-only">{t('search')}</span>
          <input type="search" value={search} onChange={(e) => { setSearch(e.target.value); reset(); }} placeholder={t('search')} className={inputClass} />
        </label>
        <label>
          <span className="sr-only">{t('category')}</span>
          <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); reset(); }} className={`${inputClass} w-auto min-w-6400`}>
            <option value="">{t('allCategories')}</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {getLocalizedString(c.name, locale)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!canEdit ? (
        <p role="note" className={infoNote}>
          {tp('insufficient')}
        </p>
      ) : null}
      {problem ? (
        <p role="alert" className={errorNote}>
          {problem}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className={errorNote}>
          {t('errors.load')}
        </p>
      ) : null}
      {data?.capped ? <p className={infoNote}>{t('capped')}</p> : null}

      {selected.size > 0 && canEdit ? (
        <div role="region" aria-label={t('bulk.label')} className="sticky bottom-300 z-10 flex flex-wrap items-center gap-300 rounded-300 bg-bg-brand px-400 py-300 text-text-on shadow-popover">
          <span className="text-body-2 font-semibold">{allMatching ? t('bulk.allMatching', { count: total }) : t('bulk.selected', { count: selected.size })}</span>
          {!allMatching && pageAllSelected && total > rows.length ? (
            <button type="button" className="text-body-2 font-bold underline" onClick={() => setAllMatching(true)}>
              {t('bulk.selectAll', { count: total })}
            </button>
          ) : null}
          <span className="flex-1" />
          <button type="button" className={buttonSmall} disabled={busy || (!allMatching && assignIds.length === 0)} onClick={() => assign(allMatching ? { filter: filterBody } : { productIds: assignIds })}>
            {t('bulk.assign')}
          </button>
          <button
            type="button"
            className={buttonSmall}
            disabled={busy || (!allMatching && withdrawIds.length === 0)}
            onClick={() => askWithdraw(allMatching ? { filter: filterBody } : { productIds: withdrawIds }, t('bulk.selected', { count: allMatching ? total : withdrawIds.length }))}
          >
            {t('bulk.withdraw')}
          </button>
          <button type="button" className={buttonSmall} onClick={() => { setSelected(new Set()); setAllMatching(false); }}>
            {t('bulk.clear')}
          </button>
        </div>
      ) : null}

      <div className={tableScroll} role="region" tabIndex={0} aria-label={t('tableLabel')}>
        <table className={`w-full border-collapse ${tableMinWidth}`}>
          <caption className="sr-only">{t('title')}</caption>
          <thead>
            <tr className="border-b border-border-subdued">
              <th scope="col" className={`${thClass} w-1000`}>
                <input
                  type="checkbox"
                  aria-label={t('selectPage')}
                  disabled={!canEdit || rows.filter(selectable).length === 0}
                  checked={pageAllSelected}
                  onChange={(e) => setSelected(e.target.checked ? new Set(rows.filter(selectable).map((r) => r.productId)) : new Set())}
                />
              </th>
              <th scope="col" className={thClass}>{t('columns.product')}</th>
              <th scope="col" className={thClass}>{t('columns.part')}</th>
              <th scope="col" className={thClass}>{t('columns.list')}</th>
              <th scope="col" className={thClass}>{t('columns.status')}</th>
              <th scope="col" className={thClass}>{t('columns.reason')}</th>
              <th scope="col" className={`${thClass} text-right`}>{t('columns.action')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const ui = STATE_UI[row.state];
              const name = getLocalizedString(row.name, locale);
              return (
                <tr key={row.productId} className="border-b border-border-subdued last:border-0">
                  <td className={tdClass}>
                    <input
                      type="checkbox"
                      aria-label={t('selectRow', { name })}
                      disabled={!canEdit || !selectable(row)}
                      checked={selected.has(row.productId)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(row.productId);
                        else next.delete(row.productId);
                        setSelected(next);
                        setAllMatching(false);
                      }}
                    />
                  </td>
                  <td className={`${tdClass} font-semibold`}>{name}</td>
                  <td className={`${tdClass} font-mono text-caption-1`}>{row.sku}</td>
                  <td className={tdClass}>{row.listPrice ? formatMoney(row.listPrice.centAmount, row.listPrice.currencyCode, locale) : <span className="text-text-subdued">{t('pricePending')}</span>}</td>
                  <td className={tdClass}>
                    <Chip tone={ui.tone}>{t(`chips.${CHIP_KEY[row.state]}`)}</Chip>
                  </td>
                  <td className={`${tdClass} text-text-subdued`}>{reasonOf(row)}</td>
                  <td className={`${tdClass} text-right`}>
                    {ui.actionKey === 'none' ? null : (
                      <button
                        type="button"
                        className={buttonSmall}
                        disabled={!canEdit || busy || ui.actionKey === 'cantReadd'}
                        title={!canEdit ? tp('insufficient') : undefined}
                        onClick={() => (ui.actionKey === 'withdraw' ? askWithdraw({ productIds: [row.productId] }, name) : assign({ productIds: [row.productId] }))}
                      >
                        {t(`actions.${ui.actionKey}`)}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!isLoading && rows.length === 0 ? (
              <tr>
                <td colSpan={7} className={`${tdClass} text-center text-text-subdued`}>
                  {t('empty')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {total > PAGE ? (
        <div className="flex items-center justify-between gap-300">
          <span className="text-body-2 font-medium text-text-subdued">{t('range', { from: offset + 1, to: Math.min(offset + PAGE, total), total })}</span>
          <div className="flex gap-200">
            <button type="button" className={buttonSecondary} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
              {t('previous')}
            </button>
            <button type="button" className={buttonSecondary} disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>
              {t('next')}
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={pending !== null}
        title={t('withdrawDialog.title', { count: pending?.count ?? 0 })}
        confirmLabel={t('withdrawDialog.confirm')}
        cancelLabel={t('withdrawDialog.cancel')}
        busy={busy}
        onConfirm={confirmWithdraw}
        onCancel={() => setPending(null)}
      >
        <p>{pending ? t('withdrawDialog.body', { label: pending.label, count: pending.count }) : null}</p>
        <p data-testid="open-carts">{t('withdrawDialog.openCarts', { count: pending?.impact.openCartCount ?? 0 })}</p>
        <p>{t('withdrawDialog.branches')}</p>
      </ConfirmDialog>
    </section>
  );
}
