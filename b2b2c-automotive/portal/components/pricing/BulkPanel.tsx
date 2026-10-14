'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/catalog/ConfirmDialog';
import { buttonPrimary, buttonSecondary, cardClass, errorNote, hintClass, inputClass, labelClass, tableMinWidth, tableScroll, tdClass, textareaClass, thClass } from '@/components/catalog/ui';
import { useToast } from '@/context/ToastContext';
import { pricesApi } from '@/hooks/catalogApi';
import { parsePriceInput } from '@/lib/catalog/price-input';
import { formatMoney } from '@/lib/utils';

interface PreviewRow {
  sku: string;
  listCent: number | null;
  newCent: number | null;
  below: number;
  above: number;
  problem?: string;
}

type Mode = 'percentOfList' | 'setTo' | 'csv';

/**
 * Bulk edit and CSV import with a preview: every result with its distance from the Malva list, invalid ones (zero or less, not in
 * the assortment, price pending) flagged. Publishing needs the count and is blocked while any row is invalid (zero writes).
 */
export function BulkPanel({ storeKey, currency, text, onDone }: { storeKey: string; currency: 'EUR' | 'USD'; text: string; onDone: () => Promise<unknown> }) {
  const t = useTranslations('catalog.prices.bulk');
  const locale = useLocale();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>('percentOfList');
  const [value, setValue] = useState('108');
  const [csv, setCsv] = useState('');
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const number = (): number | null => {
    if (mode === 'setTo') {
      const p = parsePriceInput(value);
      return p.kind === 'ok' ? p.centAmount : null;
    }
    const n = Number(value.replace(',', '.'));
    return value.trim() !== '' && Number.isFinite(n) ? n : null;
  };

  async function preview() {
    setProblem('');
    setRows(null);
    setBusy(true);
    if (mode === 'csv') {
      const result = await pricesApi.importPreview(storeKey, currency, csv);
      setBusy(false);
      if (!result.ok) {
        const first = (result.details as { problems?: { line: number; message: string }[] } | undefined)?.problems?.[0];
        return setProblem(first ? t('csvLine', { line: first.line, message: first.message }) : (result.error ?? t('errors.generic')));
      }
      setRows((result.data?.rows ?? []).map((r) => ({ sku: r.sku, listCent: r.listCent, newCent: r.newCent, below: r.belowListPercent, above: r.aboveListPercent, problem: r.problem })));
      return;
    }
    const n = number();
    if (n === null) {
      setBusy(false);
      return setProblem(t('errors.value'));
    }
    const result = await pricesApi.bulkPreview(storeKey, currency, mode, n, { text: text || undefined });
    setBusy(false);
    if (!result.ok) return setProblem(result.error ?? t('errors.generic'));
    setRows((result.data?.rows ?? []).map((r) => ({ sku: r.sku, listCent: r.listCent, newCent: r.newCent, below: r.belowListPercent, above: r.aboveListPercent, problem: r.invalid ? 'INVALID_MONEY' : undefined })));
  }

  async function publish() {
    if (!rows) return;
    setBusy(true);
    const result = mode === 'csv' ? await pricesApi.importPublish(storeKey, currency, csv, rows.length) : await pricesApi.bulkPublish(storeKey, currency, mode, number() ?? 0, { text: text || undefined }, rows.length);
    setBusy(false);
    setConfirming(false);
    if (!result.ok) return setProblem(result.code === 'INVALID_MONEY' ? t('errors.invalid') : (result.error ?? t('errors.generic')));
    toast(t('published'));
    setRows(null);
    setCsv('');
    await onDone();
  }

  const invalid = rows?.filter((r) => r.problem).length ?? 0;
  const percent = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n);

  return (
    <details className={cardClass}>
      <summary className="cursor-pointer text-title-2 font-semibold text-text">{t('title')}</summary>
      <div className="mt-400 flex flex-col gap-400">
        <div role="group" aria-label={t('modeLabel')} className="flex w-max gap-100 rounded-300 bg-bg-surface-subdued p-100">
          {(['percentOfList', 'setTo', 'csv'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => {
                setMode(m);
                setRows(null);
                setProblem('');
              }}
              className={`h-1000 rounded-200 px-300 text-body-2 font-semibold focus-visible:outline-2 focus-visible:outline-border-active ${mode === m ? 'bg-bg-surface text-text shadow-button' : 'text-text-subdued hover:text-text'}`}
            >
              {t(`modes.${m}`)}
            </button>
          ))}
        </div>

        {mode === 'csv' ? (
          <div className="flex flex-col gap-150">
            <label htmlFor="csv-input" className={labelClass}>{t('csvLabel')}</label>
            <textarea id="csv-input" value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={t('csvPlaceholder')} className={`${textareaClass} font-mono`} />
            <label className={`${buttonSecondary} w-max cursor-pointer`}>
              {t('csvFile')}
              <input type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCsv(await f.text()); }} />
            </label>
            <p className={hintClass}>{t('csvHint')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-150">
            <label htmlFor="bulk-value" className={labelClass}>{mode === 'percentOfList' ? t('percentLabel') : t('setToLabel')}</label>
            <input id="bulk-value" value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" className={`${inputClass} max-w-6400`} />
            <p className={hintClass}>{mode === 'percentOfList' ? t('percentHint') : t('setToHint')}</p>
          </div>
        )}

        <div className="flex gap-300">
          <button type="button" className={buttonSecondary} disabled={busy || (mode === 'csv' && csv.trim() === '')} onClick={preview}>
            {t('preview')}
          </button>
        </div>

        {problem ? <p role="alert" className={errorNote}>{problem}</p> : null}

        {rows ? (
          <>
            <div className={tableScroll} role="group" tabIndex={0} aria-label={t('previewTitle')}>
              <table className={`w-full border-collapse ${tableMinWidth}`}>
                <caption className="sr-only">{t('previewTitle')}</caption>
                <thead>
                  <tr className="border-b border-border-subdued">
                    <th scope="col" className={thClass}>{t('columns.sku')}</th>
                    <th scope="col" className={thClass}>{t('columns.list')}</th>
                    <th scope="col" className={thClass}>{t('columns.new')}</th>
                    <th scope="col" className={thClass}>{t('columns.distance')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.sku} className="border-b border-border-subdued last:border-0">
                      <td className={`${tdClass} font-mono text-caption-1`}>{r.sku}</td>
                      <td className={tdClass}>{r.listCent !== null ? formatMoney(r.listCent, currency, locale) : '—'}</td>
                      <td className={tdClass}>{r.newCent !== null ? formatMoney(r.newCent, currency, locale) : t('remove')}</td>
                      <td className={`${tdClass} ${r.problem ? 'font-semibold text-text-critical' : 'text-text-subdued'}`}>
                        {r.problem ? t(`problems.${r.problem}`) : r.below > 0 ? t('below', { percent: percent(r.below) }) : r.above > 0 ? t('above', { percent: percent(r.above) }) : t('atList')}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className={`${tdClass} text-center text-text-subdued`}>{t('none')}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-300">
              {invalid > 0 ? <p role="alert" className="text-body-2 font-semibold text-text-critical">{t('blocked', { count: invalid })}</p> : null}
              <button type="button" className={buttonPrimary} disabled={busy || rows.length === 0 || invalid > 0} onClick={() => setConfirming(true)}>
                {t('publish', { count: rows.length })}
              </button>
            </div>
          </>
        ) : null}
      </div>
      <ConfirmDialog open={confirming} title={t('confirm.title', { count: rows?.length ?? 0 })} confirmLabel={t('confirm.confirm')} cancelLabel={t('confirm.cancel')} busy={busy} onConfirm={publish} onCancel={() => setConfirming(false)}>
        <p>{t('confirm.body', { count: rows?.length ?? 0 })}</p>
      </ConfirmDialog>
    </details>
  );
}
