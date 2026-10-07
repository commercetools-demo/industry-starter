import type { Locale, Money } from '@/lib/types';

/** The only place that divides a commercetools `centAmount` by 100 (all currencies in use have two fraction digits). */
export function formatMoney(money: Money, locale: Locale): string {
  const whole = money.centAmount % 100 === 0;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currencyCode,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(money.centAmount / 100);
}

/** Exact locale, then the same language in another region, then en-US, then the first non-empty value, then ''. */
export function getLocalizedString(value: Record<string, string> | undefined | null, locale: string): string {
  if (!value) return '';
  const exact = value[locale];
  if (exact) return exact;
  const language = locale.split('-')[0];
  const sameLanguage = Object.keys(value).find((key) => key !== locale && key.split('-')[0] === language && value[key]);
  if (sameLanguage) return value[sameLanguage] as string;
  if (value['en-US']) return value['en-US'];
  return Object.values(value).find((entry) => typeof entry === 'string' && entry !== '') ?? '';
}
