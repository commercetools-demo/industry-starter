import { getLocale } from 'next-intl/server';
import { ErrorView } from '@/components/errors/ErrorView';
import { isSupportedLocale, DEFAULT_LOCALE } from '@/lib/utils';
import { loadNavItems } from './_shell/loadNavItems';

// Rendered by Next with a 404 status when notFound() is thrown; it sits inside the locale layout, so header and footer are present.
export default async function LocaleNotFound() {
  const current = await getLocale();
  const locale = isSupportedLocale(current) ? current : DEFAULT_LOCALE;
  return <ErrorView kind="not-found" categories={await loadNavItems(locale)} />;
}
