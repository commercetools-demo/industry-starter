import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LOCALE, isSupportedLocale } from '@/lib/utils';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = isSupportedLocale(requested) ? requested : DEFAULT_LOCALE;
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
