import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { formatMoneyExact } from '@/lib/format';
import type { Locale, PriceSchedule as PriceScheduleData, SchedulePeriod } from '@/lib/types';

// Junior design choice (D-068): the prototype draws no price schedule. A bordered box in the plan card, a table per period for a committed
// term, one sentence for month-to-month. Shown before the buyer commits (the bundle page precedes checkout).

const dateFormat = (locale: Locale): Intl.DateTimeFormat => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' });
const day = (formatter: Intl.DateTimeFormat, isoDate: string): string => formatter.format(new Date(`${isoDate}T00:00:00Z`));

export function PriceSchedule({ schedule, locale }: { schedule: PriceScheduleData; locale: Locale }): ReactElement {
  const t = useTranslations('schedule');
  const pricing = useTranslations('pricing.mode');
  const dates = dateFormat(locale);
  const money = (value: { centAmount: number; currencyCode: string }): string => formatMoneyExact(value, locale);
  const hasIntro = schedule.periods.some((period) => period.kind === 'intro');
  const rowLabel = (period: SchedulePeriod): string | null => (period.kind === 'intro' ? t('row.intro') : hasIntro && period.kind === 'standing' ? t('row.standing') : null);

  return (
    <section aria-labelledby={`schedule-${schedule.sku}`} className="rounded-lg border border-neutral-200 p-5">
      <h4 id={`schedule-${schedule.sku}`} className="m-0 mb-3 font-display text-md font-bold">
        {t('title')}
      </h4>
      {schedule.openEnded ? (
        <p className="m-0 text-sm">{t('openEnded')}</p>
      ) : (
        <>
          <p className="m-0 mb-3 text-sm">{pricing('fixed', { months: schedule.termMonths })}</p>
          <div className="max-w-full overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th scope="col" className="py-2 pr-4 font-semibold">
                    {t('col.months')}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-semibold">
                    {t('col.dates')}
                  </th>
                  <th scope="col" className="py-2 text-right font-semibold">
                    {t('col.amount')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {schedule.periods.map((period) => (
                  <tr key={period.index} className="border-b border-neutral-200 align-top">
                    <td className="py-2 pr-4 whitespace-nowrap">{period.months === 1 ? period.fromMonth : t('monthRange', { from: period.fromMonth, to: period.toMonth })}</td>
                    <td className="py-2 pr-4">
                      {day(dates, period.startsOn)} - {day(dates, period.endsOn)}
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <span className="font-semibold">{money(period.monthlyAmount)}</span>
                      {rowLabel(period) ? <span className="block text-xs text-text-muted">{rowLabel(period)}</span> : null}
                    </td>
                  </tr>
                ))}
                <tr className="border-b border-neutral-200">
                  <th scope="row" colSpan={2} className="py-2 pr-4 font-semibold">
                    {t('dueAtOrder')}
                  </th>
                  <td className="py-2 text-right font-semibold whitespace-nowrap">{money(schedule.dueAtOrder)}</td>
                </tr>
                {schedule.totalContractValue ? (
                  <tr>
                    <th scope="row" colSpan={2} className="py-2 pr-4 font-semibold">
                      {t('total', { months: schedule.termMonths })}
                    </th>
                    <td className="py-2 text-right font-semibold whitespace-nowrap">{money(schedule.totalContractValue)}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {schedule.quantity > 1 ? <p className="m-0 mt-2 text-xs text-text-muted">{t('lines', { quantity: schedule.quantity })}</p> : null}
          {schedule.afterTerm ? (
            <p className="m-0 mt-3 text-sm">{t('afterTerm', { months: schedule.termMonths, amount: money(schedule.afterTerm.monthlyAmount), date: day(dates, schedule.afterTerm.startsOn) })}</p>
          ) : null}
        </>
      )}
      <p className="m-0 mt-3 text-xs text-text-muted">{t('provisional')}</p>
    </section>
  );
}
