import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import defaultMessages from '@/messages/en-US.json';
import { DEFAULT_LOCALE } from '@/lib/utils';
import { mergeMessages, missingMessageHandlers } from './missing-messages';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const catalog = (await import(`../messages/${locale}.json`)).default as Record<string, unknown>;
  return {
    locale,
    // Default-locale text sits underneath, so a missing key shows it in production.
    messages: locale === DEFAULT_LOCALE ? catalog : mergeMessages(defaultMessages, catalog),
    ...missingMessageHandlers,
  };
});
