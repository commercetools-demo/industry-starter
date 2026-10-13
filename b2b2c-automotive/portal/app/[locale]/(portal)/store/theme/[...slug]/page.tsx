import { setRequestLocale } from 'next-intl/server';
import { ThemeTabServer } from '@/components/store/ThemeTabServer';
import { titleOf } from '@/lib/portal/page-title';

// Deep paths of the embedded ThemeManager (its router uses `/store/theme` as basename).
export default async function ThemeDeepPage({ params }: { params: Promise<{ locale: string; slug: string[] }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ThemeTabServer locale={locale} />;
}

export const generateMetadata = titleOf(['store.tabs', 'theme'], ['nav.items', 'store']);
