'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { DailySales } from '@/lib/dashboard/types';
import { formatMoney } from '@/lib/utils';

const BAR_MIN_PERCENT = 3;

/**
 * Daily sales of one store, one series: thin bars anchored to the baseline with rounded data ends, a 2 px gap, one hue from the
 * admin kit chart tokens, a recessive baseline and mid line, three axis labels, a per-bar hover tooltip, a screen-reader summary
 * and a table view. A single series needs no legend (the card title names it).
 */
export function SalesBars({ daily, currency, fractionDigits }: { daily: DailySales[]; currency: string; fractionDigits: number }) {
  const t = useTranslations('dashboard.store');
  const locale = useLocale();
  const fmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const money = (cents: number) => formatMoney(cents, currency, locale, fractionDigits);
  const max = Math.max(1, ...daily.map((d) => d.sales));
  const total = daily.reduce((n, d) => n + d.sales, 0);
  const label = (d: DailySales) => fmt.format(new Date(`${d.date}T00:00:00Z`));
  const first = daily[0];
  const last = daily[daily.length - 1];
  const mid = daily[Math.floor(daily.length / 2)];
  return (
    <figure data-testid="sales-chart" className="flex flex-col gap-200">
      <figcaption className="text-caption-1 font-semibold text-text-subdued">{t('chartTitle')}</figcaption>
      <div role="img" aria-label={t('chartSummary', { total: money(total) })} className="relative">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-border-subdued" />
        <ul className="relative flex h-3200 items-end gap-050 border-b border-border">
          {daily.map((d) => (
            <li key={d.date} data-testid="sales-bar" className="group relative flex h-full min-w-0 flex-1 items-end">
              {d.sales > 0 ? <div className="w-full rounded-t-100 bg-chart-1" style={{ height: `${Math.max(BAR_MIN_PERCENT, (d.sales / max) * 100)}%` }} /> : null}
              <span className="pointer-events-none invisible absolute bottom-full left-1/2 z-10 mb-100 -translate-x-1/2 whitespace-nowrap rounded-100 bg-bg-surface px-200 py-100 text-caption-2 font-semibold text-text shadow-tooltip group-hover:visible">
                {label(d)} · {money(d.sales)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {first && mid && last ? (
        <div aria-hidden="true" className="flex justify-between font-chart text-caption-2 font-medium text-text-subdued">
          <span>{label(first)}</span>
          <span>{label(mid)}</span>
          <span>{label(last)}</span>
        </div>
      ) : null}
      <details className="text-caption-1 text-text-subdued">
        <summary className="cursor-pointer font-semibold">{t('chartTable')}</summary>
        <table className="mt-200 w-full text-left">
          <caption className="sr-only">{t('chartTable')}</caption>
          <thead>
            <tr>
              <th scope="col" className="font-semibold">{t('date')}</th>
              <th scope="col" className="text-right font-semibold">{t('sales')}</th>
            </tr>
          </thead>
          <tbody>
            {daily.map((d) => (
              <tr key={d.date}>
                <td>{label(d)}</td>
                <td className="text-right">{money(d.sales)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
