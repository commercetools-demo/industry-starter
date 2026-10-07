import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatMoneyExact } from '@/lib/format';
import { summarizeByMode } from '@/lib/devices/summary';
import type { CartLine, Locale } from '@/lib/types';

/** One line per payment option that occurs in the bundle: how many devices, what is due today and what is paid monthly. */
export function AcquisitionTotals({ lines }: { lines: readonly CartLine[] }): ReactElement | null {
  const t = useTranslations('devices');
  const locale = useLocale() as Locale;
  const totals = summarizeByMode(lines);
  if (totals.length === 0) return null;
  return (
    <section aria-label={t('totals.title')} className="flex flex-col gap-2 rounded-xl bg-brand-100 p-5">
      <h3 className="m-0 font-display text-md font-bold">{t('totals.title')}</h3>
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-md">
        {totals.map((entry) => (
          <li key={entry.mode}>{t('totals.byMode', { mode: t(`mode.${entry.mode}`), count: entry.count, due: formatMoneyExact(entry.dueNow, locale), monthly: formatMoneyExact(entry.monthly, locale) })}</li>
        ))}
      </ul>
    </section>
  );
}
