'use client';

import { useTranslations } from 'next-intl';
import { useState, type ChangeEvent } from 'react';
import { useSWRConfig } from 'swr';
import { Chip } from '@/components/portal/Chip';
import { FormField } from '@/components/portal/FormField';
import { buttonPrimary, buttonSecondary, cardClass, errorNote, hintClass, infoNote, inputClass, sectionTitle, selectClass, successNote, tableMinWidth, tableScroll, tdClass, thClass } from '@/components/portal/kit';
import { useViewer } from '@/context/ViewerContext';
import { importApi, type CatalogResult, type CommitResult, type ValidationReport } from '@/hooks/marketingApi';
import { IMPORT_TARGETS, type ImportTarget, type MappingOverrides } from '@/lib/import/columns';

const CODES = ['EMPTY', 'TOO_LARGE', 'TOO_MANY_ROWS', 'UNTERMINATED_QUOTE', 'NO_HEADER', 'NOTHING_TO_IMPORT'] as const;

/** "CSV import": validate first (nothing is stored), review the mapping and the row issues, then import. The server validates again. */
export function CsvImport() {
  const t = useTranslations('importPage');
  const tp = useTranslations('permissions');
  const { storeKey } = useViewer();
  const { mutate } = useSWRConfig();
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [overrides, setOverrides] = useState<MappingOverrides>({});
  const [busy, setBusy] = useState<'validate' | 'import' | null>(null);
  const [problem, setProblem] = useState('');
  const [result, setResult] = useState<CommitResult | null>(null);

  const failText = (r: CatalogResult<unknown>) => (r.status === 403 ? tp('insufficient') : r.code && (CODES as readonly string[]).includes(r.code) ? t(`csv.errorCodes.${r.code}` as 'csv.errorCodes.EMPTY') : t('errors.generic'));

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setReport(null);
    setResult(null);
    setProblem('');
    setOverrides({});
    if (!file) return setCsv('');
    try {
      setCsv(await file.text());
      setFileName(file.name);
    } catch {
      setCsv('');
      setProblem(t('csv.readError'));
    }
  }

  async function validate(next: MappingOverrides) {
    setBusy('validate');
    setProblem('');
    setResult(null);
    const r = await importApi.validate(storeKey, csv, next);
    setBusy(null);
    if (!r.ok || !r.data) {
      setReport(null);
      return setProblem(failText(r));
    }
    setReport(r.data);
  }

  async function remap(header: string, value: ImportTarget | 'ignore') {
    const next = { ...overrides, [header]: value };
    setOverrides(next);
    await validate(next);
  }

  async function commit() {
    if (!report || report.importable === 0) return;
    setBusy('import');
    setProblem('');
    const r = await importApi.commit(storeKey, csv, overrides);
    setBusy(null);
    if (!r.ok || !r.data) return setProblem(failText(r));
    setResult(r.data);
    await mutate((key) => typeof key === 'string' && key.startsWith('/api/seller/local-products'));
  }

  return (
    <section className={`${cardClass} flex flex-col gap-500`} aria-labelledby="csv-title">
      <h2 id="csv-title" className={sectionTitle}>
        {t('csv.title')}
      </h2>
      <p className={hintClass}>{t('csv.intro')}</p>
      <div className="flex flex-wrap items-end gap-300">
        <div className="min-w-0 flex-1">
          <FormField id="csv-file" label={t('csv.file')}>
            <input id="csv-file" type="file" accept=".csv,text/csv" className={inputClass} onChange={onFile} />
          </FormField>
        </div>
        <button type="button" className={buttonSecondary} disabled={csv === '' || busy !== null} onClick={() => validate(overrides)}>
          {busy === 'validate' ? t('csv.validating') : t('csv.validate')}
        </button>
      </div>
      {fileName && csv ? <p className={hintClass}>{fileName}</p> : null}
      {problem ? (
        <p role="alert" className={errorNote}>
          {problem}
        </p>
      ) : null}

      {report ? (
        <>
          <ul aria-label={t('csv.summaryLabel')} className="flex flex-wrap gap-300">
            <li>
              <Chip tone="neutral">
                {t('csv.rows')} <strong>{report.rows}</strong>
              </Chip>
            </li>
            <li>
              <Chip tone="success">
                {t('csv.valid')} <strong>{report.valid}</strong>
              </Chip>
            </li>
            <li>
              <Chip tone="warning">
                {t('csv.warnings')} <strong>{report.warnings}</strong>
              </Chip>
            </li>
            <li>
              <Chip tone="critical">
                {t('csv.errors')} <strong>{report.errors}</strong>
              </Chip>
            </li>
          </ul>

          <section aria-labelledby="csv-mapping-title" className="flex flex-col gap-300">
            <h3 id="csv-mapping-title" className="text-body-1 font-semibold text-text">
              {t('csv.mappingTitle')}
            </h3>
            <ul className="flex flex-col gap-200">
              {report.mapping.map((m) => (
                <li key={m.header} className="flex flex-wrap items-center justify-between gap-300 rounded-200 border border-border px-300 py-200">
                  <span className="text-body-2 font-semibold text-text">{m.header}</span>
                  {m.target ? (
                    <Chip tone="success">{t('csv.mappedTo', { target: m.target })}</Chip>
                  ) : (
                    <span className="flex flex-wrap items-center gap-300">
                      <Chip tone="neutral">{t('csv.unmapped')}</Chip>
                      {m.warning ? (
                        <span className="text-caption-1 font-semibold text-text">{m.warning}</span>
                      ) : (
                        <select aria-label={t('csv.mapColumn', { header: m.header })} className={`${selectClass} w-auto`} value={overrides[m.header] ?? 'ignore'} disabled={busy !== null} onChange={(e) => remap(m.header, e.target.value as ImportTarget | 'ignore')}>
                          <option value="ignore">{t('csv.ignore')}</option>
                          {IMPORT_TARGETS.map((target) => (
                            <option key={target} value={target}>
                              {target}
                            </option>
                          ))}
                        </select>
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="csv-issues-title" className="flex flex-col gap-300">
            <h3 id="csv-issues-title" className="text-body-1 font-semibold text-text">
              {t('csv.issuesTitle')}
            </h3>
            {report.issues.length === 0 ? (
              <p className={hintClass}>{t('csv.issuesNone')}</p>
            ) : (
              <div className={tableScroll}>
                <table className={`w-full ${tableMinWidth}`}>
                  <thead>
                    <tr>
                      <th scope="col" className={thClass}>
                        {t('csv.colRow')}
                      </th>
                      <th scope="col" className={thClass}>
                        {t('csv.colColumn')}
                      </th>
                      <th scope="col" className={thClass}>
                        {t('csv.colMessage')}
                      </th>
                      <th scope="col" className={thClass}>
                        {t('csv.colEffect')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.issues.map((issue, n) => (
                      <tr key={`${issue.row}-${issue.column ?? ''}-${n}`} className="border-t border-border">
                        <td className={tdClass}>{issue.row}</td>
                        <td className={tdClass}>{issue.column ?? '—'}</td>
                        <td className={tdClass}>{issue.message}</td>
                        <td className={tdClass}>
                          <Chip tone={issue.effect === 'Skipped' ? 'critical' : 'info'}>{issue.effect === 'Skipped' ? t('csv.skipped') : t('csv.defaultUsed')}</Chip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div>
            <button type="button" className={buttonPrimary} disabled={report.importable === 0 || busy !== null || result !== null} onClick={commit}>
              {busy === 'import' ? t('csv.importing') : t('csv.import', { count: report.importable })}
            </button>
          </div>
        </>
      ) : null}

      {result ? (
        <div role="status" className={result.failed.length ? infoNote : successNote}>
          <p>{t('csv.result', { imported: result.imported, failed: result.failed.length })}</p>
          {result.skipped > 0 ? <p>{t('csv.skippedRows', { count: result.skipped })}</p> : null}
          {result.failed.length > 0 ? (
            <>
              <p className="mt-200 font-semibold">{t('csv.failedTitle')}</p>
              <ul className="list-disc pl-600">
                {result.failed.map((f) => (
                  <li key={f.sku}>
                    {f.sku}: {f.error}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
