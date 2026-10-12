'use client';

import { useLocale, useTranslations } from 'next-intl';

export type KpiState = 'loading' | 'ok' | 'unavailable';

/** One KPI: label, value (24 px bold) and a note. An unavailable source reads "Unavailable" and nothing else on the page changes. */
export function KpiCard({ id, label, note, value, state }: { id: string; label: string; note: string; value: number | null; state: KpiState }) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  return (
    <section data-testid={`kpi-${id}`} aria-label={label} className="flex flex-col gap-100 rounded-200 bg-bg-surface p-400 shadow-card">
      <h3 className="text-caption-1 font-semibold text-text-subdued">{label}</h3>
      {state === 'loading' ? (
        <div role="status" aria-label={t('loading')} className="h-800 w-1/2 rounded-100 bg-bg-surface-subdued motion-safe:animate-pulse" />
      ) : state === 'unavailable' || value === null ? (
        <p data-testid={`kpi-${id}-value`} className="text-h5 font-bold text-text-subdued">
          {t('unavailable')}
        </p>
      ) : (
        <p data-testid={`kpi-${id}-value`} className="text-h5 font-bold text-text">
          {new Intl.NumberFormat(locale).format(value)}
        </p>
      )}
      <p className="text-caption-1 font-medium text-text-subdued">{note}</p>
    </section>
  );
}
