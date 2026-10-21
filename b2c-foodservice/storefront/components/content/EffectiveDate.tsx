import { useLocale, useTranslations } from 'next-intl';

/** `Effective from {date}`. The date is a calendar day, so it is formatted in UTC and never shifts. */
export default function EffectiveDate({ date, locale }: { date: string; locale?: string }) {
  const t = useTranslations('policy');
  const current = useLocale();
  const formatted = new Intl.DateTimeFormat(locale ?? current, { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`),
  );
  return (
    <p className="text-[14px] text-ink-2">
      <time dateTime={date}>{t('effective', { date: formatted })}</time>
    </p>
  );
}
