import { isLocaleKey, marketForLocale } from '@/lib/utils';

/** What the page-builder service needs to localize and price a page. No `store`: "store" in this app is a pickup location. */
export interface PageBuilderMarket {
  locale: string;
  currency: string;
  country: string;
}

/** The market of the URL locale; an unknown locale gets the default market, as everywhere else. */
export function pageBuilderMarket(locale: string): PageBuilderMarket {
  const market = marketForLocale(locale);
  return { locale: isLocaleKey(locale) ? locale : market.locale, currency: market.currency, country: market.country };
}

/** The path the service matches: the URL without its locale segment (`/`, `/category/pods`, `/about`). */
export function pageBuilderPath(segments: readonly string[] = []): string {
  const clean = segments.filter((s) => s !== '');
  return `/${clean.join('/')}`;
}
