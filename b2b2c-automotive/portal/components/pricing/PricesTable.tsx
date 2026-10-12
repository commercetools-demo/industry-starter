'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useDeferredValue, useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/catalog/ConfirmDialog';
import { buttonPrimary, buttonSecondary, cardClass, errorNote, hintClass, infoNote, inputClass, tableMinWidth, tableScroll, tdClass, thClass } from '@/components/catalog/ui';
import { useToast } from '@/context/ToastContext';
import { useViewer } from '@/context/ViewerContext';
import { pricesApi, usePrices, useRefreshCatalog } from '@/hooks/catalogApi';
import { usePermissions } from '@/hooks/usePermissions';
import { listDistance } from '@/lib/catalog/margin';
import { formatPriceInput, parsePriceInput } from '@/lib/catalog/price-input';
import type { PriceChange, PriceRow } from '@/lib/catalog/types';
import { formatMoney, getLocalizedString } from '@/lib/utils';
import { BulkPanel } from './BulkPanel';

const PAGE = 50;

/** The "Price overrides" tab: the store's own retail price per assigned part, with the distance from the Malva list as information. */
export function PricesTable() {
  const t = useTranslations('catalog.prices');
  const tp = useTranslations('permissions');
  const locale = useLocale();
  const { storeKey } = useViewer();
  const { can } = usePermissions();
  const { toast } = useToast();
  const refresh = useRefreshCatalog();
  const canEdit = can('price.edit');

  const [currency, setCurrency] = useState<'EUR' | 'USD'>('EUR');
  const [search, setSearch] = useState('');
  const text = useDeferredValue(search.trim());
  const [offset, setOffset] = useState(0);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  const { data, error, isLoading } = usePrices(storeKey, { currency, text, offset, limit: PAGE });
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const currencies = data?.currencies ?? ['EUR'];

  const valueOf = (row: PriceRow) => edits[row.sku] ?? (row.overrideCent !== null ? formatPriceInput(row.overrideCent, locale) : '');
  const parsed = (row: PriceRow) => parsePriceInput(valueOf(row));

  /** Changes against what is stored; an invalid entry is reported instead of silently skipped. */
  const { changes, invalid } = useMemo(() => {
    const list: PriceChange[] = [];
    let bad = 0;
    for (const row of rows) {
      if (edits[row.sku] === undefined) continue;
      const p = parsePriceInput(edits[row.sku]);
      if (p.kind === 'invalid') bad += 1;
      else if (p.kind === 'blank' && row.overrideCent !== null) list.push({ sku: row.sku, centAmount: null });
      else if (p.kind === 'ok' && p.centAmount !== row.overrideCent) list.push({ sku: row.sku, centAmount: p.centAmount });
    }
    return { changes: list, invalid: bad };
  }, [rows, edits]);

  async function publish() {
    setBusy(true);
    setProblem('');
    const result = await pricesApi.publish(storeKey, currency, changes, true);
    setBusy(false);
    setConfirming(false);
    if (!result.ok) {
      setProblem(result.code === 'INVALID_MONEY' ? t('invalid') : result.status === 403 ? tp('insufficient') : t('errors.generic'));
      return;
    }
    toast(t('published'));
    setEdits({});
    await refresh();
  }

  const info = (row: PriceRow) => {
    const p = parsed(row);
    if (p.kind !== 'ok' || row.listCent === null) return null;
    const d = listDistance(p.centAmount, row.listCent);
    if (d.direction === 'equal') return t('atList');
    const percent = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(d.percent);
    return d.direction === 'below' ? t('below', { percent }) : t('above', { percent });
  };

  return (
    <div className="flex flex-col gap-400">
      <section className={`${cardClass} flex flex-col gap-400`} aria-labelledby="prices-title">
        <div className="flex flex-wrap items-start justify-between gap-300">
          <div>
            <h2 id="prices-title" className="text-title-1 font-semibold text-text">
              {t('title')}
            </h2>
            <p data-testid="price-layers" className="text-body-2 font-medium text-text-subdued">
              {t('layers')}
            </p>
          </div>
          {currencies.length > 1 ? (
            <div role="group" aria-label={t('currency')} className="flex gap-100 rounded-300 bg-bg-surface-subdued p-100">
              {currencies.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={currency === c}
                  onClick={() => {
                    setCurrency(c);
                    setEdits({});
                    setOffset(0);
                  }}
                  className={`h-1000 rounded-200 px-300 text-body-2 font-semibold focus-visible:outline-2 focus-visible:outline-border-active ${currency === c ? 'bg-bg-surface text-text shadow-button' : 'text-text-subdued hover:text-text'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <label>
          <span className="sr-only">{t('search')}</span>
          <input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setOffset(0); }} placeholder={t('search')} className={inputClass} />
        </label>

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

        <div className={tableScroll}>
          <table className={`w-full border-collapse ${tableMinWidth}`}>
            <caption className="sr-only">{t('title')}</caption>
            <thead>
              <tr className="border-b border-border-subdued">
                <th scope="col" className={thClass}>{t('columns.product')}</th>
                <th scope="col" className={thClass}>{t('columns.list')}</th>
                <th scope="col" className={thClass}>{t('columns.yours')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const name = getLocalizedString(row.name, locale);
                const pending = row.listCent === null && !row.own;
                const p = parsed(row);
                const bad = p.kind === 'invalid';
                const note = info(row);
                const id = `price-${row.sku}`;
                return (
                  <tr key={row.sku} className="border-b border-border-subdued last:border-0">
                    <td className={tdClass}>
                      <span className="block font-semibold">{name}</span>
                      <span className="font-mono text-caption-1 text-text-subdued">{row.sku}</span>
                    </td>
                    <td className={tdClass}>
                      {row.listCent !== null ? formatMoney(row.listCent, currency, locale) : pending ? <span className="text-text-subdued">{t('pricePending')}</span> : <span className="text-text-subdued">{t('own')}</span>}
                    </td>
                    <td className={`${tdClass} w-6400`}>
                      <input
                        id={id}
                        type="text"
                        inputMode="decimal"
                        aria-label={t('inputLabel', { name })}
                        aria-invalid={bad}
                        aria-describedby={`${id}-note`}
                        disabled={!canEdit || pending}
                        title={!canEdit ? tp('insufficient') : undefined}
                        value={valueOf(row)}
                        placeholder={row.listCent !== null ? formatPriceInput(row.listCent, locale) : ''}
                        onChange={(e) => setEdits({ ...edits, [row.sku]: e.target.value })}
                        className={`${inputClass} ${bad ? 'border-border-critical' : ''}`}
                      />
                      <p id={`${id}-note`} className={`mt-050 ${bad ? 'text-caption-1 font-semibold text-text-critical' : hintClass}`}>
                        {bad ? t('invalid') : note}
                      </p>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className={`${tdClass} text-center text-text-subdued`}>
                    {t('empty')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {(data?.total ?? 0) > PAGE ? (
          <div className="flex items-center justify-between gap-300">
            <span className="text-body-2 font-medium text-text-subdued">{t('range', { from: offset + 1, to: Math.min(offset + PAGE, data?.total ?? 0), total: data?.total ?? 0 })}</span>
            <div className="flex gap-200">
              <button type="button" className={buttonSecondary} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
                {t('previous')}
              </button>
              <button type="button" className={buttonSecondary} disabled={offset + PAGE >= (data?.total ?? 0)} onClick={() => setOffset(offset + PAGE)}>
                {t('next')}
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-300">
          {invalid > 0 ? (
            <p role="alert" className="text-body-2 font-semibold text-text-critical">
              {t('invalid')}
            </p>
          ) : null}
          <button type="button" className={buttonPrimary} disabled={!canEdit || busy || changes.length === 0 || invalid > 0} title={!canEdit ? tp('insufficient') : undefined} onClick={() => setConfirming(true)}>
            {t('publish', { count: changes.length })}
          </button>
        </div>
      </section>

      {canEdit ? <BulkPanel storeKey={storeKey} currency={currency} text={text} onDone={refresh} /> : null}

      <ConfirmDialog open={confirming} title={t('confirm.title', { count: changes.length })} confirmLabel={t('confirm.confirm')} cancelLabel={t('confirm.cancel')} busy={busy} onConfirm={publish} onCancel={() => setConfirming(false)}>
        <p>{t('confirm.body', { count: changes.length })}</p>
        <ul className="list-disc pl-500 text-caption-1 text-text-subdued">
          {changes.slice(0, 5).map((c) => (
            <li key={c.sku}>
              {c.sku}: {c.centAmount === null ? t('confirm.remove') : formatMoney(c.centAmount, currency, locale)}
            </li>
          ))}
        </ul>
      </ConfirmDialog>
    </div>
  );
}
